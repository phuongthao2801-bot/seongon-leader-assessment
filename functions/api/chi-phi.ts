interface Env {
  CHI_PHI_DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  RESEND_API_KEY: string;
  ABS_MA_BAI: string;
  RATE_LIMIT_KV: KVNamespace;
}

async function checkRateLimit(kv: KVNamespace, ip: string, endpoint: string, max = 10, windowSec = 600): Promise<boolean> {
  const key = `rl:${endpoint}:${ip}`;
  const current = parseInt(await kv.get(key) || '0', 10);
  if (current >= max) return false;
  await kv.put(key, String(current + 1), { expirationTtl: windowSec });
  return true;
}

async function logABS(maBai: string, buoc: string, payload?: object) {
  try {
    await fetch('https://abs.agentboss.vn/api/bai-14/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ma_bai: maBai, buoc, ...(payload ? { payload } : {}) }),
    });
  } catch (_) {}
}

const REJECTION_REASONS: Record<string, string> = {
  '1': 'Sai ngân sách / Vượt hạn mức',
  '2': 'Cần bổ sung thông tin',
  '3': 'Hoãn lại — chưa phù hợp thời điểm',
};

function formatMoney(n: number): string {
  return n.toLocaleString('vi-VN') + ' đ';
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (context.request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Rate limit: 10 lần / 10 phút / IP
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(context.env.RATE_LIMIT_KV, ip, 'chi-phi');
  if (!allowed) return json({ error: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.' }, 429);

  try {
    const body = await context.request.json() as any;
    const { nv_name, nv_email, noi_dung, chi_cho_ai, so_tien, thong_tin_nhan } = body;

    if (!nv_name || !nv_email || !noi_dung || !chi_cho_ai || !so_tien || !thong_tin_nhan) {
      return json({ error: 'Thiếu thông tin bắt buộc' }, 400);
    }

    const soTienNum = parseInt(String(so_tien).replace(/\D/g, ''), 10);
    if (isNaN(soTienNum) || soTienNum <= 0) return json({ error: 'Số tiền không hợp lệ' }, 400);

    // Save to D1
    const result = await context.env.CHI_PHI_DB.prepare(
      `INSERT INTO chi_phi (nv_name, nv_email, noi_dung, chi_cho_ai, so_tien, thong_tin_nhan, trang_thai)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      String(nv_name).slice(0, 100),
      String(nv_email).slice(0, 200).trim(),
      String(noi_dung).slice(0, 500),
      String(chi_cho_ai).slice(0, 200),
      soTienNum,
      String(thong_tin_nhan).slice(0, 500),
    ).run();

    const chiPhiId = result.meta.last_row_id;

    // Send Telegram to CEO with inline buttons
    const tgText = `💰 *Đề xuất chi phí mới #${chiPhiId}*\n\n` +
      `👤 *Người đề xuất:* ${nv_name}\n` +
      `📋 *Nội dung:* ${noi_dung}\n` +
      `🏢 *Chi cho:* ${chi_cho_ai}\n` +
      `💵 *Số tiền:* ${formatMoney(soTienNum)}\n` +
      `🏦 *Thông tin nhận tiền:*\n${thong_tin_nhan}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '✅ Duyệt', callback_data: `approve_${chiPhiId}` }],
        [{ text: '❌ Sai ngân sách / Vượt hạn mức', callback_data: `reject_1_${chiPhiId}` }],
        [{ text: '❌ Cần bổ sung thông tin', callback_data: `reject_2_${chiPhiId}` }],
        [{ text: '❌ Hoãn lại — chưa phù hợp thời điểm', callback_data: `reject_3_${chiPhiId}` }],
      ],
    };

    const tgRes = await fetch(
      `https://api.telegram.org/bot${context.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: context.env.TELEGRAM_CHAT_ID,
          text: tgText,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }),
      }
    );
    const tgData = await tgRes.json() as any;

    // Save telegram message_id for later editing
    if (tgData.ok) {
      await context.env.CHI_PHI_DB.prepare(
        `UPDATE chi_phi SET tg_message_id = ? WHERE id = ?`
      ).bind(tgData.result.message_id, chiPhiId).run();
    }

    // Log ABS: nv-nop
    await logABS(context.env.ABS_MA_BAI, 'nv-nop', { id: chiPhiId, so_tien: soTienNum });

    return json({ success: true, id: chiPhiId });
  } catch (err) {
    console.error(err);
    return json({ error: 'Lỗi hệ thống' }, 500);
  }
};
