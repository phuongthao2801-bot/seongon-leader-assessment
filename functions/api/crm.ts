interface Env {
  KH_DB: D1Database;
  CRM_PASSWORD: string;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || '';

  // Auth check (except login)
  if (action !== 'login') {
    const auth = context.request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (token !== context.env.CRM_PASSWORD) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  const db = context.env.KH_DB;

  // Login
  if (action === 'login' && context.request.method === 'POST') {
    const body = await context.request.json() as any;
    if (body.password === context.env.CRM_PASSWORD) {
      return json({ success: true, token: context.env.CRM_PASSWORD });
    }
    return json({ error: 'Sai mật khẩu' }, 401);
  }

  // List customers
  if (action === 'list' && context.request.method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    let query = 'SELECT * FROM khach_hang WHERE 1=1';
    const params: any[] = [];
    if (search) { query += ' AND (ho_ten LIKE ? OR email LIKE ? OR dien_thoai LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (status) { query += ' AND trang_thai = ?'; params.push(status); }
    query += ' ORDER BY id DESC';
    const result = await db.prepare(query).bind(...params).all();
    return json({ success: true, data: result.results });
  }

  // Add customer
  if (action === 'add' && context.request.method === 'POST') {
    const body = await context.request.json() as any;
    const { ho_ten, email, dien_thoai, dich_vu, trang_thai, ghi_chu } = body;
    if (!ho_ten || !email) return json({ error: 'Thiếu thông tin' }, 400);
    const r = await db.prepare(
      `INSERT INTO khach_hang (ho_ten, email, dien_thoai, dich_vu, trang_thai, ghi_chu) VALUES (?,?,?,?,?,?)`
    ).bind(
      String(ho_ten).slice(0,100), String(email).slice(0,200),
      String(dien_thoai||'').slice(0,20), String(dich_vu||'').slice(0,100),
      String(trang_thai||'Mới').slice(0,50), String(ghi_chu||'').slice(0,500)
    ).run();
    return json({ success: true, id: r.meta.last_row_id });
  }

  // Update customer
  if (action === 'update' && context.request.method === 'PUT') {
    const body = await context.request.json() as any;
    const { id, ho_ten, email, dien_thoai, dich_vu, trang_thai, ghi_chu } = body;
    await db.prepare(
      `UPDATE khach_hang SET ho_ten=?,email=?,dien_thoai=?,dich_vu=?,trang_thai=?,ghi_chu=? WHERE id=?`
    ).bind(
      String(ho_ten).slice(0,100), String(email).slice(0,200),
      String(dien_thoai||'').slice(0,20), String(dich_vu||'').slice(0,100),
      String(trang_thai||'Mới').slice(0,50), String(ghi_chu||'').slice(0,500), id
    ).run();
    return json({ success: true });
  }

  // Delete customer
  if (action === 'delete' && context.request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    await db.prepare('DELETE FROM hoat_dong WHERE khach_id=?').bind(id).run();
    await db.prepare('DELETE FROM khach_hang WHERE id=?').bind(id).run();
    return json({ success: true });
  }

  // Add activity
  if (action === 'add_activity' && context.request.method === 'POST') {
    const body = await context.request.json() as any;
    await db.prepare('INSERT INTO hoat_dong (khach_id, noi_dung) VALUES (?,?)').bind(body.khach_id, String(body.noi_dung).slice(0,500)).run();
    return json({ success: true });
  }

  // Get activities
  if (action === 'activities' && context.request.method === 'GET') {
    const khach_id = url.searchParams.get('khach_id');
    const r = await db.prepare('SELECT * FROM hoat_dong WHERE khach_id=? ORDER BY id DESC').bind(khach_id).all();
    return json({ success: true, data: r.results });
  }

  // Export CSV
  if (action === 'export' && context.request.method === 'GET') {
    const r = await db.prepare('SELECT * FROM khach_hang ORDER BY id DESC').all();
    const rows = r.results as any[];
    const csv = ['ID,Họ tên,Email,Điện thoại,Dịch vụ,Trạng thái,Ghi chú,Ngày tạo',
      ...rows.map(row => [row.id, row.ho_ten, row.email, row.dien_thoai, row.dich_vu, row.trang_thai, row.ghi_chu, row.created_at].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','))
    ].join('\n');
    return new Response('﻿' + csv, {
      headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment;filename="khach-hang.csv"' }
    });
  }

  return json({ error: 'Not found' }, 404);
};
