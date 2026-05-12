interface Env {
  LYK_DB: D1Database;
  RESEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function generateToken(): string {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, c => c === '+' ? '-' : c === '/' ? '_' : '').slice(0, 24);
}

async function sendInviteEmail(resendKey: string, nv_name: string, nv_email: string, campaign_title: string, token: string) {
  const link = `https://thaoseongon.com/phong-van/?t=${token}`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
  <div style="background:#004aef;padding:28px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#ffce00;margin:0;font-size:20px">🎯 Thảo muốn nghe ý kiến bạn</h1>
  </div>
  <div style="padding:28px;background:#f9f9f9;border-radius:0 0 12px 12px">
    <p>Xin chào <strong>${nv_name}</strong>,</p>
    <p style="margin-top:12px">Thảo đang lập kế hoạch <strong>${campaign_title}</strong> và muốn nghe góc nhìn thực tế từ bạn — người trực tiếp làm việc với khách hàng.</p>
    <p style="margin-top:12px">Một trợ lý AI sẽ hỏi bạn khoảng <strong>6-8 câu</strong> (~10 phút). Không cần chuẩn bị, cứ trả lời thẳng những gì bạn nghĩ là tốt nhất.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#004aef;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
        💬 Bắt đầu trả lời
      </a>
    </div>
    <p style="color:#888;font-size:13px">Link chỉ dành riêng cho bạn. Thời gian hoàn thành: khi nào thuận tiện trong hôm nay.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#999;font-size:12px;text-align:center">SEONGON — từ Ngô Phương Thảo</p>
  </div>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Ngô Phương Thảo <no-reply@thaoseongon.com>',
      to: [nv_email],
      subject: `🎯 Thảo muốn nghe ý kiến bạn về: ${campaign_title}`,
      html,
    }),
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rl:lay-y-kien:${ip}`;
  const count = parseInt(await context.env.RATE_LIMIT_KV.get(key) || '0', 10);
  if (count >= 5) return json({ error: 'Quá nhiều yêu cầu. Thử lại sau.' }, 429);
  await context.env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 3600 });

  try {
    const body = await context.request.json() as any;
    const { title, plan_content, employees } = body;

    if (!title || !plan_content || !employees?.length) return json({ error: 'Thiếu thông tin' }, 400);

    // Create campaign
    const campaign = await context.env.LYK_DB.prepare(
      `INSERT INTO campaigns (title, plan_content, total_invited) VALUES (?, ?, ?)`
    ).bind(String(title).slice(0, 200), String(plan_content).slice(0, 10000), employees.length).run();

    const campaignId = campaign.meta.last_row_id;

    // Create interviews + send emails
    const emailPromises = [];
    for (const emp of employees) {
      if (!emp.name || !emp.email) continue;
      const token = generateToken();
      await context.env.LYK_DB.prepare(
        `INSERT INTO interviews (campaign_id, nv_name, nv_email, token) VALUES (?, ?, ?, ?)`
      ).bind(campaignId, String(emp.name).slice(0, 100), String(emp.email).slice(0, 200).trim(), token).run();

      emailPromises.push(sendInviteEmail(context.env.RESEND_API_KEY, emp.name, emp.email, title, token));
    }

    await Promise.all(emailPromises);

    return json({ success: true, campaign_id: campaignId });
  } catch (err) {
    console.error(err);
    return json({ error: 'Lỗi hệ thống' }, 500);
  }
};
