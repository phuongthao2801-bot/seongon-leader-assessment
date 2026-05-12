interface Env {
  BOOKING_DB: D1Database;
  RESEND_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  RATE_LIMIT_KV: KVNamespace;
}

async function checkRateLimit(kv: KVNamespace, ip: string, endpoint: string, max = 10, windowSec = 600): Promise<boolean> {
  const key = `rl:${endpoint}:${ip}`;
  const current = parseInt(await kv.get(key) || '0', 10);
  if (current >= max) return false;
  await kv.put(key, String(current + 1), { expirationTtl: windowSec });
  return true;
}

const WORK_START = 8 * 60 + 30; // 8:30
const WORK_END = 18 * 60;       // 18:00
const SLOT_DURATION = 60;        // minutes
const BUFFER = 30;               // minutes
const MIN_ADVANCE_HOURS = 24;

function toVNTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function generateICS(name: string, start: string, end: string, topic: string, guestEmail: string): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const s = new Date(start);
  const e = new Date(end);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SEONGON//DatLich//VI',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(s)}`,
    `DTEND:${fmt(e)}`,
    `SUMMARY:${topic} - ${name}`,
    `DESCRIPTION:Cuộc họp với ${name} (${guestEmail})\\nNội dung: ${topic}`,
    'ORGANIZER;CN=Ngô Phương Thảo:mailto:ngophuongthao@seongon.com',
    `ATTENDEE;CN=${name}:mailto:${guestEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

async function sendEmail(resendKey: string, to: string, toName: string, subject: string, html: string, icsContent: string, fileName: string) {
  const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Ngô Phương Thảo <no-reply@thaoseongon.com>',
      to: [to],
      subject,
      html,
      attachments: [{ filename: fileName, content: icsBase64 }]
    })
  });
}

async function sendTelegram(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Rate limit: 10 lần / 10 phút / IP
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(context.env.RATE_LIMIT_KV, ip, 'booking');
  if (!allowed) return new Response(JSON.stringify({ error: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.' }), { status: 429, headers: corsHeaders });

  try {
    const body = await context.request.json() as any;
    const { name, email, company, topic, slot_start } = body;

    // Validate inputs
    if (!name || !email || !topic || !slot_start) {
      return new Response(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }), { status: 400, headers: corsHeaders });
    }

    // Sanitize
    const safeName = String(name).slice(0, 100).replace(/[<>]/g, '');
    const safeEmail = String(email).slice(0, 200);
    const safeCompany = String(company || '').slice(0, 100).replace(/[<>]/g, '');
    const safeTopic = String(topic).slice(0, 500).replace(/[<>]/g, '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return new Response(JSON.stringify({ error: 'Email không hợp lệ' }), { status: 400, headers: corsHeaders });
    }

    const startDate = new Date(slot_start);
    const now = new Date();

    // Check 24h advance
    if (startDate.getTime() - now.getTime() < MIN_ADVANCE_HOURS * 3600000) {
      return new Response(JSON.stringify({ error: 'Cần đặt trước ít nhất 24 giờ' }), { status: 400, headers: corsHeaders });
    }

    // Check weekday (VN time)
    const vnDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getDay();
    if (vnDay === 0 || vnDay === 6) {
      return new Response(JSON.stringify({ error: 'Chỉ đặt lịch từ Thứ 2 đến Thứ 6' }), { status: 400, headers: corsHeaders });
    }

    // Check working hours (VN time)
    const vnHour = new Date(startDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getHours();
    const vnMin = new Date(startDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).getMinutes();
    const startMinutes = vnHour * 60 + vnMin;
    if (startMinutes < WORK_START || startMinutes + SLOT_DURATION > WORK_END) {
      return new Response(JSON.stringify({ error: 'Ngoài giờ làm việc (8:30 - 18:00)' }), { status: 400, headers: corsHeaders });
    }

    const endDate = new Date(startDate.getTime() + SLOT_DURATION * 60000);
    const slotEnd = endDate.toISOString();

    // Check conflicts (with buffer)
    const bufferMs = BUFFER * 60000;
    const checkStart = new Date(startDate.getTime() - bufferMs).toISOString();
    const checkEnd = new Date(endDate.getTime() + bufferMs).toISOString();

    const conflict = await context.env.BOOKING_DB.prepare(
      `SELECT id FROM bookings WHERE status = 'confirmed'
       AND slot_start < ? AND slot_end > ?`
    ).bind(checkEnd, checkStart).first();

    if (conflict) {
      return new Response(JSON.stringify({ error: 'Khung giờ này đã có lịch, vui lòng chọn giờ khác' }), { status: 409, headers: corsHeaders });
    }

    // Save booking
    const result = await context.env.BOOKING_DB.prepare(
      `INSERT INTO bookings (name, email, company, topic, slot_start, slot_end) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(safeName, safeEmail, safeCompany, safeTopic, startDate.toISOString(), slotEnd).run();

    const bookingId = result.meta.last_row_id;
    const icsContent = generateICS(safeName, startDate.toISOString(), slotEnd, safeTopic, safeEmail);
    const vnStartStr = toVNTime(startDate.toISOString());

    // Email to guest
    const guestHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#004aef;padding:32px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#ffce00;margin:0;font-size:24px">✅ Đặt lịch thành công!</h1>
  </div>
  <div style="padding:32px;background:#f9f9f9;border-radius:0 0 12px 12px">
    <p style="font-size:16px">Xin chào <strong>${safeName}</strong>,</p>
    <p>Lịch họp với <strong>Ngô Phương Thảo (CCO - SEONGON)</strong> đã được xác nhận:</p>
    <div style="background:#fff;border-left:4px solid #004aef;padding:16px;border-radius:8px;margin:16px 0">
      <p style="margin:4px 0">📅 <strong>${vnStartStr}</strong></p>
      <p style="margin:4px 0">⏱️ Thời lượng: 60 phút</p>
      <p style="margin:4px 0">📝 Nội dung: ${safeTopic}</p>
    </div>
    <p>File <strong>.ics</strong> đính kèm — mở file để tự động thêm vào Calendar của bạn.</p>
    <p style="color:#666;font-size:13px">Nếu cần thay đổi, vui lòng liên hệ: ngophuongthao@seongon.com</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="text-align:center;color:#999;font-size:12px">SEONGON — seongon.com</p>
  </div>
</div>`;

    // Email to Sếp
    const ceoHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#004aef;padding:24px;border-radius:12px 12px 0 0">
    <h2 style="color:#ffce00;margin:0">📅 Lịch hẹn mới #${bookingId}</h2>
  </div>
  <div style="padding:24px;background:#f9f9f9;border-radius:0 0 12px 12px">
    <p>👤 <strong>${safeName}</strong>${safeCompany ? ` — ${safeCompany}` : ''}</p>
    <p>📧 ${safeEmail}</p>
    <p>🕐 ${vnStartStr}</p>
    <p>📝 ${safeTopic}</p>
  </div>
</div>`;

    await Promise.all([
      sendEmail(context.env.RESEND_API_KEY, safeEmail, safeName,
        `✅ Xác nhận lịch họp với Ngô Phương Thảo - SEONGON`, guestHtml, icsContent, 'lich-hop.ics'),
      sendEmail(context.env.RESEND_API_KEY, 'ngophuongthao@seongon.com', 'Ngô Phương Thảo',
        `📅 Lịch hẹn mới: ${safeName} — ${vnStartStr}`, ceoHtml, icsContent, `lich-hop-${bookingId}.ics`),
      sendTelegram(context.env.TELEGRAM_BOT_TOKEN, context.env.TELEGRAM_CHAT_ID,
        `📅 <b>Lịch hẹn mới!</b>\n👤 ${safeName}${safeCompany ? ` (${safeCompany})` : ''}\n📧 ${safeEmail}\n🕐 ${vnStartStr}\n📝 ${safeTopic}`)
    ]);

    return new Response(JSON.stringify({ success: true, booking_id: bookingId }), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Lỗi hệ thống, vui lòng thử lại' }), { status: 500, headers: corsHeaders });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
