interface Env {
  DU_AN_DB: D1Database;
  AI: Ai;
  DU_AN_PASS: string;
  DU_AN_CSV_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function parseCSVRecords(text: string): string[][] {
  // Proper CSV parser that handles quoted multiline fields
  const records: string[][] = [];
  let cur = '', inQ = false, fields: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; } // escaped quote
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      fields.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQ) {
      if (ch === '\r') i++; // skip \n after \r
      fields.push(cur.trim().replace(/^"|"$/g, ''));
      records.push(fields);
      fields = []; cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur || fields.length) { fields.push(cur.trim().replace(/^"|"$/g, '')); records.push(fields); }
  return records;
}

function parseCSV(text: string): Record<string, string>[] {
  const records = parseCSVRecords(text.trim());
  // Find the header record: first record whose first non-empty field is "TT"
  let headerIdx = -1;
  for (let i = 0; i < records.length; i++) {
    const firstField = records[i].find(f => f.trim()) || '';
    if (firstField.trim() === 'TT') { headerIdx = i; break; }
  }
  if (headerIdx < 0 || headerIdx + 1 >= records.length) return [];
  const headers = records[headerIdx].map(h => h.trim());
  return records.slice(headerIdx + 1)
    .map(fields => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (fields[i] || '').trim(); });
      return row;
    })
    .filter(r => Object.values(r).some(v => v));
}

function detectChanges(prev: Record<string, string>[], curr: Record<string, string>[]): string[] {
  const changes: string[] = [];
  const prevMap: Record<string, Record<string, string>> = {};
  prev.forEach(r => { if (r['TT']) prevMap[r['TT']] = r; });

  curr.forEach(r => {
    const id = r['TT'];
    if (!id) return;
    const p = prevMap[id];
    if (!p) {
      changes.push(`➕ Thêm mới: ${r['KR'] || r['Hạng mục']} (${r['Tình trạng']})`);
    } else if (p['Tình trạng'] !== r['Tình trạng']) {
      changes.push(`🔄 #${id} "${r['KR']?.slice(0, 40)}": ${p['Tình trạng']} → ${r['Tình trạng']}`);
    } else if (p['Tiến độ'] !== r['Tiến độ'] && r['Tiến độ']) {
      changes.push(`📝 #${id} "${r['KR']?.slice(0, 40)}": cập nhật tiến độ "${r['Tiến độ']}"`);
    }
  });
  return changes;
}

async function sendTelegram(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Pass' } });
  }

  const url = new URL(request.url);
  const pass = request.headers.get('X-Admin-Pass') || '';
  const authed = pass === env.DU_AN_PASS;

  // GET /api/du-an?action=status — dashboard data (auth required)
  if (request.method === 'GET') {
    if (!authed) return json({ error: 'Sai mật khẩu' }, 401);

    const project = await env.DU_AN_DB.prepare(`SELECT * FROM projects WHERE id = 1`).first() as any;
    const reports = await env.DU_AN_DB.prepare(`SELECT id, fetched_at, summary, changes_json FROM reports ORDER BY id DESC LIMIT 10`).all();

    let tasks: Record<string, string>[] = [];
    if (project?.last_snapshot) {
      try { tasks = JSON.parse(project.last_snapshot); } catch {}
    }

    return json({
      success: true,
      project: project ? {
        name: project.name,
        launch_date: project.launch_date,
        last_fetched_at: project.last_fetched_at,
      } : null,
      tasks,
      reports: reports.results,
    });
  }

  // POST /api/du-an — fetch new report
  if (request.method === 'POST') {
    if (!authed) return json({ error: 'Sai mật khẩu' }, 401);

    const csvUrl = env.DU_AN_CSV_URL;
    if (!csvUrl) return json({ error: 'Chưa cấu hình CSV URL' }, 500);

    // Fetch CSV
    let csvText = '';
    try {
      const resp = await fetch(csvUrl, { redirect: 'follow' });
      csvText = await resp.text();
    } catch (e) {
      return json({ error: 'Không fetch được CSV: ' + String(e) }, 500);
    }

    const currTasks = parseCSV(csvText);
    if (!currTasks.length) return json({ error: 'CSV rỗng hoặc sai format' }, 400);

    // Load previous snapshot
    const project = await env.DU_AN_DB.prepare(`SELECT * FROM projects WHERE id = 1`).first() as any;
    let prevTasks: Record<string, string>[] = [];
    if (project?.last_snapshot) {
      try { prevTasks = JSON.parse(project.last_snapshot); } catch {}
    }

    const changes = detectChanges(prevTasks, currTasks);
    const isFirstFetch = !project || !prevTasks.length;

    // Stats
    const total = currTasks.length;
    const done = currTasks.filter(t => t['Tình trạng'] === 'Hoàn thành').length;
    const inprog = currTasks.filter(t => ['Triển khai', 'Đang làm', 'Đang triển khai'].includes(t['Tình trạng'])).length;
    const notstart = currTasks.filter(t => t['Tình trạng'] === 'Chưa bắt đầu').length;
    const cancelled = currTasks.filter(t => t['Tình trạng'] === 'Hủy').length;

    const pctDone = Math.round((done / total) * 100);
    const launchDate = project?.launch_date || '2026-05-27';
    const daysLeft = Math.ceil((new Date(launchDate).getTime() - Date.now()) / 86400000);

    // AI summary
    const aiPrompt = isFirstFetch
      ? `Dự án "Ra mắt GEO" có ${total} đầu việc. Hoàn thành: ${done}/${total} (${pctDone}%). Đang triển khai: ${inprog}. Chưa bắt đầu: ${notstart}. Còn ${daysLeft} ngày đến ngày ra mắt 27/5/2026. Tóm tắt tình hình dự án trong đúng 5 dòng ngắn gọn, thẳng thắn. Tiếng Việt.`
      : `Dự án "Ra mắt GEO" vừa có cập nhật. Tổng tiến độ: ${done}/${total} (${pctDone}%). Còn ${daysLeft} ngày đến ra mắt. Thay đổi mới:\n${changes.join('\n') || 'Không có thay đổi đáng kể'}\nTóm tắt trong đúng 5 dòng ngắn gọn. Tiếng Việt.`;

    const aiResult = await (env.AI as any).run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'Bạn là trợ lý tóm tắt tiến độ dự án cho CEO. Trả lời đúng 5 dòng, tiếng Việt, thẳng thắn.' },
        { role: 'user', content: aiPrompt }
      ],
      max_tokens: 300,
    }) as any;

    const summary = aiResult?.response || 'Không tóm tắt được.';

    // Save snapshot
    const snapshotJson = JSON.stringify(currTasks);
    const changesJson = JSON.stringify(changes);
    const now = new Date().toISOString();

    if (!project) {
      await env.DU_AN_DB.prepare(
        `INSERT INTO projects (id, name, csv_url, launch_date, last_snapshot, last_fetched_at) VALUES (1, ?, ?, ?, ?, ?)`
      ).bind('Ra mắt GEO', csvUrl, launchDate, snapshotJson, now).run();
    } else {
      await env.DU_AN_DB.prepare(
        `UPDATE projects SET last_snapshot = ?, last_fetched_at = ? WHERE id = 1`
      ).bind(snapshotJson, now).run();
    }

    await env.DU_AN_DB.prepare(
      `INSERT INTO reports (project_id, fetched_at, summary, snapshot, changes_json) VALUES (1, ?, ?, ?, ?)`
    ).bind(now, summary, snapshotJson, changesJson).run();

    // Send Telegram
    const tgMsg = `📊 <b>Báo cáo Ra mắt GEO</b> — ${new Date().toLocaleDateString('vi-VN')}\n\n${summary}\n\n⏱ Còn <b>${daysLeft} ngày</b> đến ra mắt | ✅ ${done}/${total} (${pctDone}%)\n\n<i>Xem dashboard: thaoseongon.com/theo-doi-du-an</i>`;
    await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, tgMsg);

    return json({ success: true, summary, changes, stats: { total, done, inprog, notstart, cancelled, pctDone, daysLeft } });
  }

  return json({ error: 'Method not allowed' }, 405);
};
