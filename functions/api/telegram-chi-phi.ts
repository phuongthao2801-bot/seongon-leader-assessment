interface Env {
  CHI_PHI_DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  RESEND_API_KEY: string;
  ABS_MA_BAI: string;
  KE_TOAN_EMAIL: string;
  TELEGRAM_WEBHOOK_SECRET: string;
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

async function editTgMessage(token: string, chatId: string, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' }),
  });
}

async function answerCallback(token: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function sendEmail(resendKey: string, to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SEONGON Finance <no-reply@thaoseongon.com>',
      to: [to],
      subject,
      html,
    }),
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Verify Telegram webhook secret — reject anyone who doesn't know the secret
  const incomingSecret = context.request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (incomingSecret !== context.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = await context.request.json() as any;

    // Handle callback_query (inline button tap)
    if (update.callback_query) {
      const cbq = update.callback_query;
      const data: string = cbq.data || '';
      const token = context.env.TELEGRAM_BOT_TOKEN;
      const chatId = context.env.TELEGRAM_CHAT_ID;

      // Parse callback data
      // approve_<id> or reject_<reason>_<id>
      let chiPhiId: number | null = null;
      let action: 'approve' | 'reject' | null = null;
      let reasonCode: string | null = null;

      if (data.startsWith('approve_')) {
        action = 'approve';
        chiPhiId = parseInt(data.replace('approve_', ''), 10);
      } else if (data.startsWith('reject_')) {
        action = 'reject';
        const parts = data.split('_'); // ['reject', '1', '123']
        reasonCode = parts[1];
        chiPhiId = parseInt(parts[2], 10);
      }

      if (!chiPhiId || !action) {
        await answerCallback(token, cbq.id, '❓ Không xác định được hành động');
        return new Response('OK');
      }

      // Get expense from DB
      const row = await context.env.CHI_PHI_DB.prepare(
        'SELECT * FROM chi_phi WHERE id = ?'
      ).bind(chiPhiId).first() as any;

      if (!row) {
        await answerCallback(token, cbq.id, '❌ Không tìm thấy đề xuất #' + chiPhiId);
        return new Response('OK');
      }

      if (row.trang_thai !== 'pending') {
        await answerCallback(token, cbq.id, `⚠️ Đề xuất #${chiPhiId} đã được ${row.trang_thai === 'approved' ? 'duyệt' : 'từ chối'} rồi`);
        return new Response('OK');
      }

      const now = new Date().toISOString();

      if (action === 'approve') {
        // Update DB
        await context.env.CHI_PHI_DB.prepare(
          `UPDATE chi_phi SET trang_thai = 'approved', updated_at = ? WHERE id = ?`
        ).bind(now, chiPhiId).run();

        // Answer Telegram
        await answerCallback(token, cbq.id, '✅ Đã duyệt!');

        // Edit original message
        if (row.tg_message_id) {
          await editTgMessage(
            token, chatId, row.tg_message_id,
            `✅ *DUYỆT — #${chiPhiId}*\n\n👤 ${row.nv_name}\n📋 ${row.noi_dung}\n💵 ${formatMoney(row.so_tien)}\n\n_Đã duyệt lúc ${new Date().toLocaleString('vi-VN')}_`
          );
        }

        // Log ABS: ceo-duyet
        await logABS(context.env.ABS_MA_BAI, 'ceo-duyet', { id: chiPhiId, so_tien: row.so_tien });

        // Notify accountant (kt-nhan-tin)
        const ktEmail = context.env.KE_TOAN_EMAIL || 'ngophuongthao@seongon.com';
        await sendEmail(
          context.env.RESEND_API_KEY,
          ktEmail,
          `💰 [Đã duyệt] Chi phí #${chiPhiId} — ${formatMoney(row.so_tien)} — ${row.noi_dung}`,
          `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
            <div style="background:#004aef;padding:24px;border-radius:12px 12px 0 0">
              <h2 style="color:#ffce00;margin:0">💰 Khoản chi đã được duyệt</h2>
            </div>
            <div style="padding:24px;background:#f9f9f9;border-radius:0 0 12px 12px">
              <p>👤 <strong>Người đề xuất:</strong> ${row.nv_name} (${row.nv_email})</p>
              <p>📋 <strong>Nội dung:</strong> ${row.noi_dung}</p>
              <p>🏢 <strong>Chi cho:</strong> ${row.chi_cho_ai}</p>
              <p>💵 <strong>Số tiền:</strong> <strong style="color:#004aef">${formatMoney(row.so_tien)}</strong></p>
              <p>🏦 <strong>Thông tin nhận tiền:</strong><br><pre style="background:#fff;padding:12px;border-radius:6px;font-size:13px">${row.thong_tin_nhan}</pre></p>
              <p style="margin-top:16px;color:#666;font-size:13px">Xem chi tiết tại <a href="https://thaoseongon.com/ke-toan">thaoseongon.com/ke-toan</a></p>
            </div>
          </div>`
        );

        // Log ABS: kt-nhan-tin
        await logABS(context.env.ABS_MA_BAI, 'kt-nhan-tin', { id: chiPhiId });

        // Send email to NV
        await sendEmail(
          context.env.RESEND_API_KEY,
          row.nv_email,
          `✅ Đề xuất chi phí #${chiPhiId} đã được duyệt`,
          `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
            <div style="background:#004aef;padding:28px;border-radius:12px 12px 0 0;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:20px">✅ Đề xuất chi phí được duyệt</h1>
            </div>
            <div style="padding:28px;background:#f9f9f9;border-radius:0 0 12px 12px">
              <p>Xin chào <strong>${row.nv_name}</strong>,</p>
              <p style="margin-top:12px">Đề xuất chi phí <strong>#${chiPhiId}</strong> của bạn đã được <strong style="color:#22aa55">DUYỆT</strong>.</p>
              <div style="background:#fff;border-left:4px solid #22aa55;padding:16px;border-radius:8px;margin:20px 0">
                <p style="margin:4px 0">📋 <strong>Nội dung:</strong> ${row.noi_dung}</p>
                <p style="margin:4px 0">🏢 <strong>Chi cho:</strong> ${row.chi_cho_ai}</p>
                <p style="margin:4px 0">💵 <strong>Số tiền:</strong> ${formatMoney(row.so_tien)}</p>
              </div>
              <p>Kế toán sẽ xử lý thanh toán theo thông tin bạn đã cung cấp.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
              <p style="color:#999;font-size:12px;text-align:center">SEONGON Finance System</p>
            </div>
          </div>`
        );

      } else if (action === 'reject' && reasonCode) {
        const lyDo = REJECTION_REASONS[reasonCode] || 'Không đạt yêu cầu';

        // Update DB
        await context.env.CHI_PHI_DB.prepare(
          `UPDATE chi_phi SET trang_thai = 'rejected', ly_do = ?, updated_at = ? WHERE id = ?`
        ).bind(lyDo, now, chiPhiId).run();

        // Answer Telegram
        await answerCallback(token, cbq.id, '❌ Đã từ chối');

        // Edit original message
        if (row.tg_message_id) {
          await editTgMessage(
            token, chatId, row.tg_message_id,
            `❌ *TỪ CHỐI — #${chiPhiId}*\n\n👤 ${row.nv_name}\n📋 ${row.noi_dung}\n💵 ${formatMoney(row.so_tien)}\n\n📝 *Lý do:* ${lyDo}\n_Từ chối lúc ${new Date().toLocaleString('vi-VN')}_`
          );
        }

        // Send email to NV
        await sendEmail(
          context.env.RESEND_API_KEY,
          row.nv_email,
          `❌ Đề xuất chi phí #${chiPhiId} chưa được duyệt`,
          `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
            <div style="background:#c0392b;padding:28px;border-radius:12px 12px 0 0;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:20px">❌ Đề xuất chi phí chưa được duyệt</h1>
            </div>
            <div style="padding:28px;background:#f9f9f9;border-radius:0 0 12px 12px">
              <p>Xin chào <strong>${row.nv_name}</strong>,</p>
              <p style="margin-top:12px">Đề xuất chi phí <strong>#${chiPhiId}</strong> chưa được duyệt lần này.</p>
              <div style="background:#fff;border-left:4px solid #c0392b;padding:16px;border-radius:8px;margin:20px 0">
                <p style="margin:4px 0">📋 <strong>Nội dung:</strong> ${row.noi_dung}</p>
                <p style="margin:4px 0">🏢 <strong>Chi cho:</strong> ${row.chi_cho_ai}</p>
                <p style="margin:4px 0">💵 <strong>Số tiền:</strong> ${formatMoney(row.so_tien)}</p>
                <p style="margin:12px 0 4px 0">📝 <strong>Lý do:</strong> <span style="color:#c0392b">${lyDo}</span></p>
              </div>
              <p>Nếu cần bổ sung hoặc có thắc mắc, hãy liên hệ trực tiếp với Thảo.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
              <p style="color:#999;font-size:12px;text-align:center">SEONGON Finance System</p>
            </div>
          </div>`
        );
      }

      return new Response('OK');
    }

    return new Response('OK');
  } catch (err) {
    console.error(err);
    return new Response('OK');
  }
};
