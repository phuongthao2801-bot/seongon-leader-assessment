interface Env {
  CHI_PHI_DB: D1Database;
  KE_TOAN_PASSWORD: string;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get('action') || '';

  // Auth check (except login)
  if (action !== 'login') {
    const auth = context.request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (token !== context.env.KE_TOAN_PASSWORD) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  // Login
  if (action === 'login' && context.request.method === 'POST') {
    const body = await context.request.json() as any;
    if (body.password === context.env.KE_TOAN_PASSWORD) {
      return json({ success: true, token: context.env.KE_TOAN_PASSWORD });
    }
    return json({ error: 'Sai mật khẩu' }, 401);
  }

  // List all expenses
  if (action === 'list' && context.request.method === 'GET') {
    const status = url.searchParams.get('status') || '';
    const search = url.searchParams.get('search') || '';
    let query = 'SELECT * FROM chi_phi WHERE 1=1';
    const params: any[] = [];
    if (status) { query += ' AND trang_thai = ?'; params.push(status); }
    if (search) { query += ' AND (nv_name LIKE ? OR noi_dung LIKE ? OR chi_cho_ai LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += ' ORDER BY id DESC';
    const result = await context.env.CHI_PHI_DB.prepare(query).bind(...params).all();
    return json({ success: true, data: result.results });
  }

  // Export CSV
  if (action === 'export' && context.request.method === 'GET') {
    const r = await context.env.CHI_PHI_DB.prepare('SELECT * FROM chi_phi ORDER BY id DESC').all();
    const rows = r.results as any[];
    const csv = [
      'ID,Người đề xuất,Email,Nội dung,Chi cho,Số tiền,Trạng thái,Lý do từ chối,Ngày tạo',
      ...rows.map(row => [
        row.id, row.nv_name, row.nv_email, row.noi_dung, row.chi_cho_ai,
        row.so_tien, row.trang_thai, row.ly_do || '', row.created_at
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    return new Response('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': 'attachment;filename="duyet-chi.csv"',
      },
    });
  }

  return json({ error: 'Not found' }, 404);
};
