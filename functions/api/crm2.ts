// SEONGON CRM v2 — Bài 19 Agent Boss Starter
interface Env {
  KH_DB: D1Database;
  RESEND_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
function json(d: any, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } }); }
function esc(s: any) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}
function rndHex(n = 32) { return [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2,'0')).join(''); }

async function getUser(req: Request, db: D1Database) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ','').trim();
  if (!token) return null;
  return db.prepare(
    `SELECT s.user_id, u.ho_ten, u.email, u.role, u.team_id, u.is_active
     FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id
     WHERE s.token=? AND s.expires_at>datetime('now')`
  ).bind(token).first() as Promise<any>;
}

async function autoAssign(loai: string, city: string, val: number, db: D1Database): Promise<number|null> {
  const { results } = await db.prepare(`SELECT * FROM crm_rules WHERE is_active=1 ORDER BY thu_tu`).all();
  for (const r of results as any[]) {
    if (r.loai_khach && r.loai_khach !== loai) continue;
    if (r.thanh_pho && r.thanh_pho !== city) continue;
    if (r.gia_tri_min && val < r.gia_tri_min) continue;
    return r.team_id;
  }
  return null;
}

async function tg(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

async function mail(apiKey: string, to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'SEONGON <no-reply@seongon.com>', to, subject, html })
  });
  return r.ok;
}

const STAGE_LABELS: Record<string,string> = { tiem_nang:'Tiềm năng', dam_phan:'Đang đàm phán', bao_gia:'Báo giá', chot:'Chốt ✅' };
const ORDER_LABELS: Record<string,string> = { cho_xu_ly:'Đã nhận đơn', dang_xu_ly:'Đang xử lý', da_giao:'Đã giao', hoan_thanh:'Hoàn thành ✅' };

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.KH_DB;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  // ── Public: Login ─────────────────────────────────────────────────────────
  if (action === 'login' && request.method === 'POST') {
    const { email, password } = await request.json() as any;
    const u = await db.prepare(`SELECT * FROM crm_users WHERE email=? AND is_active=1`).bind(String(email||'').toLowerCase().trim()).first() as any;
    if (!u || !u.password_hash) return json({ error: 'Email không tồn tại hoặc chưa kích hoạt' }, 401);
    const h = await sha256(`${u.salt}:${password}`);
    if (h !== u.password_hash) return json({ error: 'Sai mật khẩu' }, 401);
    const token = rndHex(32);
    const exp = new Date(Date.now() + 7*864e5).toISOString().slice(0,19);
    await db.prepare(`INSERT INTO crm_sessions (token,user_id,expires_at) VALUES (?,?,?)`).bind(token, u.id, exp).run();
    return json({ success:true, token, user:{ id:u.id, ho_ten:u.ho_ten, email:u.email, role:u.role, team_id:u.team_id } });
  }

  // ── Public: Accept Invite ─────────────────────────────────────────────────
  if (action === 'accept-invite' && request.method === 'POST') {
    const { token, password, ho_ten } = await request.json() as any;
    const inv = await db.prepare(`SELECT * FROM crm_invitations WHERE token=? AND used=0 AND expires_at>datetime('now')`).bind(token).first() as any;
    if (!inv) return json({ error: 'Link mời không hợp lệ hoặc đã hết hạn' }, 400);
    if (!password || password.length < 8) return json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, 400);
    const salt = rndHex(16);
    const hash = await sha256(`${salt}:${password}`);
    const name = ho_ten || inv.ho_ten;
    // Check if user already exists (re-invite case)
    const existing = await db.prepare(`SELECT id FROM crm_users WHERE email=?`).bind(inv.email).first() as any;
    if (existing) {
      await db.prepare(`UPDATE crm_users SET ho_ten=?,password_hash=?,salt=?,role=?,team_id=?,is_active=1 WHERE id=?`).bind(name, hash, salt, inv.role, inv.team_id, existing.id).run();
    } else {
      await db.prepare(`INSERT INTO crm_users (ho_ten,email,password_hash,salt,role,team_id) VALUES (?,?,?,?,?,?)`).bind(name, inv.email, hash, salt, inv.role, inv.team_id).run();
    }
    await db.prepare(`UPDATE crm_invitations SET used=1 WHERE id=?`).bind(inv.id).run();
    return json({ success: true });
  }

  // ── Public: Get Invite Info ───────────────────────────────────────────────
  if (action === 'invite-info' && request.method === 'GET') {
    const token = url.searchParams.get('token');
    const inv = await db.prepare(`SELECT email, ho_ten, role, team_id FROM crm_invitations WHERE token=? AND used=0 AND expires_at>datetime('now')`).bind(token).first();
    if (!inv) return json({ error: 'Link không hợp lệ' }, 404);
    return json({ success: true, data: inv });
  }

  // ── Auth Check ────────────────────────────────────────────────────────────
  const user = await getUser(request, db);
  if (!user) return json({ error: 'Chưa đăng nhập' }, 401);
  const uid = user.user_id;

  // ── GET ───────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    if (action === 'me') {
      const team = user.team_id ? await db.prepare(`SELECT id,ten,mau FROM crm_teams WHERE id=?`).bind(user.team_id).first() : null;
      return json({ ...user, team });
    }

    if (action === 'leads') {
      const stage = url.searchParams.get('stage') || '';
      const search = url.searchParams.get('search') || '';
      const teamFilter = url.searchParams.get('team_id') || '';
      let q = `SELECT l.*,u.ho_ten as bd_name,t.ten as team_name FROM crm_leads l
               LEFT JOIN crm_users u ON u.id=l.assigned_to LEFT JOIN crm_teams t ON t.id=l.team_id WHERE 1=1`;
      const p: any[] = [];
      if (user.role === 'bd') { q += ` AND l.assigned_to=?`; p.push(uid); }
      else if (user.role === 'truong_nhom') { q += ` AND l.team_id=?`; p.push(user.team_id); }
      if (stage) { q += ` AND l.stage=?`; p.push(stage); }
      if (search) { q += ` AND (l.ho_ten LIKE ? OR l.cong_ty LIKE ? OR l.email LIKE ? OR l.dien_thoai LIKE ?)`; p.push(...Array(4).fill(`%${search}%`)); }
      if (teamFilter && user.role === 'admin') { q += ` AND l.team_id=?`; p.push(teamFilter); }
      q += ` ORDER BY l.updated_at DESC LIMIT 500`;
      const { results } = await db.prepare(q).bind(...p).all();
      return json({ success: true, data: results });
    }

    if (action === 'lead') {
      const id = url.searchParams.get('id');
      const lead = await db.prepare(`SELECT l.*,u.ho_ten as bd_name,t.ten as team_name FROM crm_leads l LEFT JOIN crm_users u ON u.id=l.assigned_to LEFT JOIN crm_teams t ON t.id=l.team_id WHERE l.id=?`).bind(id).first();
      if (!lead) return json({ error: 'Không tìm thấy' }, 404);
      const acts = await db.prepare(`SELECT a.*,u.ho_ten as author FROM crm_activities a LEFT JOIN crm_users u ON u.id=a.user_id WHERE a.lead_id=? ORDER BY a.created_at DESC LIMIT 50`).bind(id).all();
      return json({ success: true, lead, activities: acts.results });
    }

    if (action === 'users') {
      if (user.role === 'bd') return json({ error: 'Không có quyền' }, 403);
      let q = `SELECT u.id,u.ho_ten,u.email,u.role,u.team_id,u.is_active,t.ten as team_name FROM crm_users u LEFT JOIN crm_teams t ON t.id=u.team_id WHERE 1=1`;
      if (user.role === 'truong_nhom') q += ` AND u.team_id=${user.team_id}`;
      q += ` ORDER BY u.role,u.ho_ten`;
      const { results } = await db.prepare(q).all();
      return json({ success: true, data: results });
    }

    if (action === 'teams') {
      const { results } = await db.prepare(`SELECT t.*,COUNT(u.id) as so_nv FROM crm_teams t LEFT JOIN crm_users u ON u.team_id=t.id AND u.is_active=1 GROUP BY t.id ORDER BY t.id`).all();
      return json({ success: true, data: results });
    }

    if (action === 'rules') {
      if (user.role !== 'admin') return json({ error: 'Không có quyền' }, 403);
      const { results } = await db.prepare(`SELECT r.*,t.ten as team_name FROM crm_rules r JOIN crm_teams t ON t.id=r.team_id ORDER BY r.thu_tu`).all();
      return json({ success: true, data: results });
    }

    if (action === 'stats') {
      const p: any[] = [];
      let f = '';
      if (user.role === 'bd') { f = 'AND assigned_to=?'; p.push(uid); }
      else if (user.role === 'truong_nhom') { f = 'AND team_id=?'; p.push(user.team_id); }
      const pipeline = await db.prepare(`SELECT stage,COUNT(*) as cnt,COALESCE(SUM(gia_tri),0) as total FROM crm_leads WHERE 1=1 ${f} GROUP BY stage`).bind(...p).all();
      const recent = await db.prepare(`SELECT l.id,l.ho_ten,l.cong_ty,l.stage,l.gia_tri,l.created_at,u.ho_ten as bd_name FROM crm_leads l LEFT JOIN crm_users u ON u.id=l.assigned_to WHERE 1=1 ${f} ORDER BY l.created_at DESC LIMIT 6`).bind(...p).all();
      const alerts = await db.prepare(`SELECT COUNT(*) as cnt FROM crm_leads WHERE stage!='chot' AND last_contact_at<datetime('now','-7 days') AND gia_tri>=200000000 ${f}`).bind(...p).first() as any;
      return json({ success: true, pipeline: pipeline.results, recent: recent.results, alert_count: alerts?.cnt || 0 });
    }

    if (action === 'alerts') {
      const p: any[] = [];
      let f = '';
      if (user.role === 'bd') { f = 'AND l.assigned_to=?'; p.push(uid); }
      else if (user.role === 'truong_nhom') { f = 'AND l.team_id=?'; p.push(user.team_id); }
      const { results } = await db.prepare(`SELECT l.*,u.ho_ten as bd_name,t.ten as team_name FROM crm_leads l LEFT JOIN crm_users u ON u.id=l.assigned_to LEFT JOIN crm_teams t ON t.id=l.team_id WHERE l.stage!='chot' AND l.last_contact_at<datetime('now','-7 days') AND l.gia_tri>=200000000 ${f} ORDER BY l.gia_tri DESC`).bind(...p).all();
      return json({ success: true, data: results });
    }
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (request.method === 'POST') {
    const body = await request.json() as any;
    const act = body.action || action;

    if (act === 'logout') {
      const token = (request.headers.get('Authorization')||'').replace('Bearer ','');
      await db.prepare(`DELETE FROM crm_sessions WHERE token=?`).bind(token).run();
      return json({ success: true });
    }

    // ── Lead CRUD ──────────────────────────────────────────────────────────
    if (act === 'lead:create') {
      const { ho_ten, email, dien_thoai, cong_ty, chuc_vu, loai_khach, thanh_pho, nguon, gia_tri, ghi_chu } = body;
      if (!ho_ten?.trim()) return json({ error: 'Thiếu tên khách hàng' }, 400);
      // Dedup
      if (email || dien_thoai) {
        const dup = await db.prepare(`SELECT id FROM crm_leads WHERE (email!='' AND email=?) OR (dien_thoai!='' AND dien_thoai=?) LIMIT 1`).bind(email||'', dien_thoai||'').first() as any;
        if (dup) return json({ error: 'Khách hàng đã tồn tại (trùng email hoặc SĐT)', dup_id: dup.id }, 409);
      }
      const lk = loai_khach || 'sme', city = thanh_pho || 'HCM', val = Math.round(Number(gia_tri)||0);
      const teamId = await autoAssign(lk, city, val, db);
      const r = await db.prepare(
        `INSERT INTO crm_leads (ho_ten,email,dien_thoai,cong_ty,chuc_vu,loai_khach,thanh_pho,nguon,gia_tri,ghi_chu,team_id,last_contact_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
      ).bind(esc(ho_ten).slice(0,100), String(email||'').slice(0,200), String(dien_thoai||'').slice(0,20), esc(cong_ty||'').slice(0,200), esc(chuc_vu||'').slice(0,100), lk, city, nguon||'manual', val, esc(ghi_chu||'').slice(0,500), teamId).run();
      const newId = r.meta.last_row_id;
      await db.prepare(`INSERT INTO crm_activities (lead_id,user_id,loai,noi_dung) VALUES (?,?,?,?)`).bind(newId, uid, 'tao_moi', `Tạo lead từ ${nguon||'manual'}`).run();
      return json({ success: true, id: newId, team_id: teamId });
    }

    if (act === 'lead:update') {
      const { id, ho_ten, email, dien_thoai, cong_ty, chuc_vu, loai_khach, thanh_pho, gia_tri, ghi_chu } = body;
      await db.prepare(`UPDATE crm_leads SET ho_ten=?,email=?,dien_thoai=?,cong_ty=?,chuc_vu=?,loai_khach=?,thanh_pho=?,gia_tri=?,ghi_chu=?,updated_at=datetime('now') WHERE id=?`)
        .bind(esc(ho_ten).slice(0,100), String(email||'').slice(0,200), String(dien_thoai||'').slice(0,20), esc(cong_ty||'').slice(0,200), esc(chuc_vu||'').slice(0,100), loai_khach||'sme', thanh_pho||'HCM', Math.round(Number(gia_tri)||0), esc(ghi_chu||'').slice(0,500), id).run();
      await db.prepare(`UPDATE crm_leads SET last_contact_at=datetime('now') WHERE id=?`).bind(id).run();
      await db.prepare(`INSERT INTO crm_activities (lead_id,user_id,loai,noi_dung) VALUES (?,?,?,?)`).bind(id, uid, 'cap_nhat', 'Cập nhật thông tin').run();
      return json({ success: true });
    }

    if (act === 'lead:delete') {
      if (user.role !== 'admin') return json({ error: 'Không có quyền' }, 403);
      await db.prepare(`DELETE FROM crm_activities WHERE lead_id=?`).bind(body.id).run();
      await db.prepare(`DELETE FROM crm_leads WHERE id=?`).bind(body.id).run();
      return json({ success: true });
    }

    if (act === 'lead:move') {
      const { id, stage } = body;
      if (!['tiem_nang','dam_phan','bao_gia','chot'].includes(stage)) return json({ error: 'Stage không hợp lệ' }, 400);
      const old = await db.prepare(`SELECT stage FROM crm_leads WHERE id=?`).bind(id).first() as any;
      await db.prepare(`UPDATE crm_leads SET stage=?,updated_at=datetime('now'),last_contact_at=datetime('now') WHERE id=?`).bind(stage, id).run();
      await db.prepare(`INSERT INTO crm_activities (lead_id,user_id,loai,noi_dung) VALUES (?,?,?,?)`).bind(id, uid, 'doi_stage', `${STAGE_LABELS[old?.stage||'tiem_nang']} → ${STAGE_LABELS[stage]}`).run();
      return json({ success: true });
    }

    if (act === 'lead:assign') {
      if (user.role === 'bd') return json({ error: 'Không có quyền' }, 403);
      const { id, user_id } = body;
      const bd = await db.prepare(`SELECT ho_ten FROM crm_users WHERE id=?`).bind(user_id).first() as any;
      await db.prepare(`UPDATE crm_leads SET assigned_to=?,updated_at=datetime('now') WHERE id=?`).bind(user_id, id).run();
      await db.prepare(`INSERT INTO crm_activities (lead_id,user_id,loai,noi_dung) VALUES (?,?,?,?)`).bind(id, uid, 'phan_cong', `Phân công cho ${bd?.ho_ten||'BD'}`).run();
      return json({ success: true });
    }

    if (act === 'lead:activity') {
      const { id, loai, noi_dung } = body;
      if (!noi_dung?.trim()) return json({ error: 'Thiếu nội dung' }, 400);
      await db.prepare(`INSERT INTO crm_activities (lead_id,user_id,loai,noi_dung) VALUES (?,?,?,?)`).bind(id, uid, loai||'ghi_chu', esc(noi_dung).slice(0,500)).run();
      await db.prepare(`UPDATE crm_leads SET last_contact_at=datetime('now'),updated_at=datetime('now') WHERE id=?`).bind(id).run();
      return json({ success: true });
    }

    if (act === 'lead:order-status') {
      const { id, status } = body;
      if (!ORDER_LABELS[status]) return json({ error: 'Trạng thái không hợp lệ' }, 400);
      const lead = await db.prepare(`SELECT * FROM crm_leads WHERE id=?`).bind(id).first() as any;
      if (!lead) return json({ error: 'Không tìm thấy' }, 404);
      await db.prepare(`UPDATE crm_leads SET trang_thai_don=?,updated_at=datetime('now') WHERE id=?`).bind(status, id).run();
      await db.prepare(`INSERT INTO crm_activities (lead_id,user_id,loai,noi_dung) VALUES (?,?,?,?)`).bind(id, uid, 'don_hang', `Đơn hàng: ${ORDER_LABELS[status]}`).run();
      let emailSent = false;
      if (lead.email) {
        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#0dd1ff;padding:20px;border-radius:8px 8px 0 0"><h1 style="color:#000;margin:0;font-size:18px">SEONGON — Cập nhật đơn hàng</h1></div>
          <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
            <p>Kính gửi <b>${esc(lead.ho_ten)}</b>,</p>
            <p>Đơn hàng của bạn tại SEONGON vừa được cập nhật:</p>
            <div style="background:#0dd1ff22;border-left:4px solid #0dd1ff;padding:12px 16px;margin:16px 0;border-radius:4px;font-size:18px;font-weight:bold">${ORDER_LABELS[status]}</div>
            <p>Mọi thắc mắc vui lòng liên hệ nhân viên phụ trách hoặc phản hồi email này.</p>
            <p>Trân trọng,<br><b>SEONGON Team</b></p>
          </div>
          <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px">seongon.com</p>
        </div>`;
        emailSent = await mail(env.RESEND_API_KEY, lead.email, `[SEONGON] Đơn hàng: ${ORDER_LABELS[status]}`, html);
      }
      return json({ success: true, email_sent: emailSent });
    }

    if (act === 'lead:import') {
      const { rows } = body;
      if (!Array.isArray(rows)) return json({ error: 'Dữ liệu không hợp lệ' }, 400);
      let imported = 0, skipped = 0;
      for (const row of rows.slice(0,500)) {
        if (!row.ho_ten?.trim()) { skipped++; continue; }
        if (row.email || row.dien_thoai) {
          const dup = await db.prepare(`SELECT id FROM crm_leads WHERE (email!='' AND email=?) OR (dien_thoai!='' AND dien_thoai=?)`).bind(row.email||'', row.dien_thoai||'').first();
          if (dup) { skipped++; continue; }
        }
        const lk = row.loai_khach || 'sme', city = row.thanh_pho || 'HCM';
        const teamId = await autoAssign(lk, city, 0, db);
        await db.prepare(`INSERT INTO crm_leads (ho_ten,email,dien_thoai,cong_ty,loai_khach,thanh_pho,nguon,team_id,last_contact_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))`)
          .bind(esc(row.ho_ten).slice(0,100), String(row.email||'').slice(0,200), String(row.dien_thoai||'').slice(0,20), esc(row.cong_ty||'').slice(0,200), lk, city, 'excel', teamId).run();
        imported++;
      }
      return json({ success: true, imported, skipped });
    }

    // ── User Management ────────────────────────────────────────────────────
    if (act === 'user:invite') {
      if (user.role === 'bd') return json({ error: 'Không có quyền' }, 403);
      const { email, ho_ten, role, team_id } = body;
      if (!email || !ho_ten || !role) return json({ error: 'Thiếu thông tin' }, 400);
      const assignTeam = user.role === 'truong_nhom' ? user.team_id : (team_id || null);
      const token = rndHex(32);
      const exp = new Date(Date.now() + 3*864e5).toISOString().slice(0,19);
      await db.prepare(`INSERT OR REPLACE INTO crm_invitations (email,ho_ten,role,team_id,token,expires_at,used) VALUES (?,?,?,?,?,?,0)`)
        .bind(email.toLowerCase().trim(), ho_ten, role, assignTeam, token, exp).run();
      const invUrl = `https://thaoseongon.com/crm?invite=${token}`;
      const roleName = role === 'admin' ? 'Admin' : role === 'truong_nhom' ? 'Trưởng nhóm' : 'BD';
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0dd1ff;padding:20px;border-radius:8px 8px 0 0"><h1 style="color:#000;margin:0;font-size:18px">SEONGON CRM — Lời mời tham gia</h1></div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Xin chào <b>${esc(ho_ten)}</b>,</p>
          <p>Bạn được mời tham gia CRM SEONGON với vai trò <b>${roleName}</b>.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${invUrl}" style="background:#0dd1ff;color:#000;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Kích hoạt tài khoản</a>
          </div>
          <p style="color:#6b7280;font-size:13px">Link hiệu lực 3 ngày.</p>
        </div>
      </div>`;
      await mail(env.RESEND_API_KEY, email, 'Kích hoạt tài khoản SEONGON CRM', html);
      return json({ success: true, invite_url: invUrl });
    }

    if (act === 'user:deactivate') {
      if (user.role !== 'admin') return json({ error: 'Không có quyền' }, 403);
      await db.prepare(`UPDATE crm_users SET is_active=0 WHERE id=? AND role!='admin'`).bind(body.id).run();
      return json({ success: true });
    }

    if (act === 'user:activate') {
      if (user.role !== 'admin') return json({ error: 'Không có quyền' }, 403);
      await db.prepare(`UPDATE crm_users SET is_active=1 WHERE id=?`).bind(body.id).run();
      return json({ success: true });
    }

    // ── Rules ──────────────────────────────────────────────────────────────
    if (act === 'rule:save') {
      if (user.role !== 'admin') return json({ error: 'Không có quyền' }, 403);
      const { id, ten, loai_khach, thanh_pho, gia_tri_min, team_id, thu_tu, is_active } = body;
      if (id) {
        await db.prepare(`UPDATE crm_rules SET ten=?,loai_khach=?,thanh_pho=?,gia_tri_min=?,team_id=?,thu_tu=?,is_active=? WHERE id=?`)
          .bind(ten, loai_khach||null, thanh_pho||null, gia_tri_min||null, team_id, thu_tu||0, is_active!==false?1:0, id).run();
      } else {
        await db.prepare(`INSERT INTO crm_rules (ten,loai_khach,thanh_pho,gia_tri_min,team_id,thu_tu,is_active) VALUES (?,?,?,?,?,?,1)`)
          .bind(ten, loai_khach||null, thanh_pho||null, gia_tri_min||null, team_id, thu_tu||0).run();
      }
      return json({ success: true });
    }

    if (act === 'rule:delete') {
      if (user.role !== 'admin') return json({ error: 'Không có quyền' }, 403);
      await db.prepare(`DELETE FROM crm_rules WHERE id=?`).bind(body.id).run();
      return json({ success: true });
    }

    // ── Alerts: Send Telegram ──────────────────────────────────────────────
    if (act === 'alerts:send') {
      const { results } = await db.prepare(
        `SELECT l.ho_ten,l.cong_ty,l.gia_tri,l.last_contact_at,u.ho_ten as bd_name,t.ten as team_name
         FROM crm_leads l LEFT JOIN crm_users u ON u.id=l.assigned_to LEFT JOIN crm_teams t ON t.id=l.team_id
         WHERE l.stage!='chot' AND l.last_contact_at<datetime('now','-7 days') AND l.gia_tri>=200000000 ORDER BY l.gia_tri DESC`
      ).all();
      if (!results.length) return json({ success: true, sent: 0 });
      const lines = (results as any[]).map(d => {
        const days = Math.floor((Date.now() - new Date(d.last_contact_at).getTime()) / 864e5);
        const val = d.gia_tri >= 1e9 ? `${(d.gia_tri/1e9).toFixed(1)}B` : `${Math.round(d.gia_tri/1e6)}M`;
        return `⚠️ <b>${d.ho_ten}</b> (${d.cong_ty||'?'}) — ${val} — im ${days} ngày — ${d.bd_name||'chưa phân'} (${d.team_name||'?'})`;
      });
      await tg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID,
        `🚨 <b>CRM Alert — ${results.length} deal rủi ro</b>\n\n${lines.join('\n')}\n\n<i>thaoseongon.com/crm</i>`);
      return json({ success: true, sent: results.length });
    }
  }

  return json({ error: 'Not found' }, 404);
};
