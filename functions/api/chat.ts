interface Env {
  LYK_DB: D1Database;
  AI: Ai;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const SYSTEM_PROMPT = (nvName: string, campaignTitle: string, planContent: string) => `
Bạn là trợ lý AI phỏng vấn của CEO Ngô Phương Thảo tại SEONGON — công ty Digital Marketing Agency hàng đầu Việt Nam.

Nhiệm vụ: Phỏng vấn ${nvName} về kế hoạch "${campaignTitle}".

NỘI DUNG KẾ HOẠCH:
${planContent}

CÁCH PHỎNG VẤN:
- Hỏi từng câu một, không bao giờ hỏi 2 câu trong 1 tin nhắn
- Hỏi tổng cộng 6-8 câu, chia đều 2 góc:
  * Góc 1 — Thị trường & khách hàng (3-4 câu): Khách hiện tại có nhu cầu không? Ai mua đầu tiên? Đối thủ đang làm gì? Rào cản nào?
  * Góc 2 — Vận hành & team (3-4 câu): Cần thêm gì để triển khai? Quy trình bán hàng? Năng lực team hiện tại?
- Khi câu trả lời còn chung chung → hỏi thêm 1 câu đào sâu trước khi chuyển chủ đề
- Tiếng Việt, thân thiện, chuyên nghiệp — như đồng nghiệp hỏi đồng nghiệp
- KHÔNG giới thiệu là AI — chỉ xưng là "trợ lý của Thảo"
- KHÔNG hỏi cùng 1 ý 2 lần

KẾT THÚC:
- Sau khi đã hỏi đủ 6-8 câu và nhận câu trả lời đầy đủ → cảm ơn tự nhiên và kết thúc
- Tin nhắn kết thúc PHẢI chứa chính xác chuỗi [DONE] ở cuối (không hiển thị với người dùng)
- Ví dụ câu kết thúc: "Cảm ơn bạn rất nhiều! Những chia sẻ của bạn rất có giá trị cho Thảo và team. Chúc bạn buổi chiều vui vẻ! [DONE]"

BẮT ĐẦU:
- Câu đầu tiên: chào ${nvName} bằng tên, cảm ơn đã dành thời gian, rồi hỏi ngay câu đầu về thị trường
`.trim();

async function sendTelegramSummary(token: string, chatId: string, campaignTitle: string, interviews: any[]) {
  let msg = `🎯 *Đủ phản hồi — "${campaignTitle}"*\n\n`;
  msg += `✅ ${interviews.length} người đã trả lời:\n`;
  interviews.forEach(iv => { msg += `• ${iv.nv_name}\n`; });
  msg += `\n📊 Xem chi tiết: https://thaoseongon.com/lay-y-kien/`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
  });
}

// GET: init interview info
// POST: send message + get AI reply
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const url = new URL(context.request.url);

  // GET: init
  if (context.request.method === 'GET') {
    const token = url.searchParams.get('t') || '';
    if (!token) return json({ success: false, error: 'Missing token' }, 400);

    const iv = await context.env.LYK_DB.prepare(
      `SELECT interviews.*, campaigns.title as campaign_title, campaigns.plan_content
       FROM interviews JOIN campaigns ON interviews.campaign_id = campaigns.id
       WHERE interviews.token = ?`
    ).bind(token).first() as any;

    if (!iv) return json({ success: false, error: 'Token không hợp lệ' }, 404);

    const msgs = await context.env.LYK_DB.prepare(
      `SELECT role, content FROM messages WHERE interview_id = ? ORDER BY id ASC`
    ).bind(iv.id).all();

    return json({
      success: true,
      interview_id: iv.id,
      nv_name: iv.nv_name,
      campaign_title: iv.campaign_title,
      status: iv.status,
      messages: msgs.results,
    });
  }

  // POST: chat
  if (context.request.method === 'POST') {
    const body = await context.request.json() as any;
    const { token, message } = body;

    if (!token) return json({ success: false, error: 'Missing token' }, 400);

    // Load interview + campaign
    const iv = await context.env.LYK_DB.prepare(
      `SELECT interviews.*, campaigns.title as campaign_title, campaigns.plan_content, campaigns.total_invited
       FROM interviews JOIN campaigns ON interviews.campaign_id = campaigns.id
       WHERE interviews.token = ?`
    ).bind(token).first() as any;

    if (!iv) return json({ success: false, error: 'Token không hợp lệ' }, 404);
    if (iv.status === 'done') return json({ success: true, reply: 'Bạn đã hoàn thành phỏng vấn rồi. Cảm ơn bạn!', done: true });

    // Load message history
    const historyResult = await context.env.LYK_DB.prepare(
      `SELECT role, content FROM messages WHERE interview_id = ? ORDER BY id ASC`
    ).bind(iv.id).all();
    const history = historyResult.results as any[];

    // Save user message (unless it's the start trigger)
    const isStart = message === '__START__';
    if (!isStart) {
      await context.env.LYK_DB.prepare(
        `INSERT INTO messages (interview_id, role, content) VALUES (?, 'user', ?)`
      ).bind(iv.id, String(message).slice(0, 2000)).run();
    }

    // Build messages for AI
    const systemMsg = { role: 'system', content: SYSTEM_PROMPT(iv.nv_name, iv.campaign_title, iv.plan_content) };
    const chatHistory = history.map((m: any) => ({ role: m.role, content: m.content }));
    if (!isStart && message) chatHistory.push({ role: 'user', content: message });

    // Call Workers AI
    const aiResult = await context.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
      messages: [systemMsg, ...chatHistory],
      max_tokens: 400,
    }) as any;

    let reply: string = aiResult?.response || 'Xin lỗi, có lỗi xảy ra. Bạn thử lại nhé.';

    // Check if interview is done
    const isDone = reply.includes('[DONE]');
    reply = reply.replace('[DONE]', '').trim();

    // Save AI reply
    await context.env.LYK_DB.prepare(
      `INSERT INTO messages (interview_id, role, content) VALUES (?, 'assistant', ?)`
    ).bind(iv.id, reply).run();

    if (isDone) {
      // Mark interview as done
      await context.env.LYK_DB.prepare(
        `UPDATE interviews SET status = 'done', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(iv.id).run();

      // Update campaign completed count
      await context.env.LYK_DB.prepare(
        `UPDATE campaigns SET completed = completed + 1 WHERE id = ?`
      ).bind(iv.campaign_id).run();

      // Check if all done → notify CEO via Telegram
      const campaign = await context.env.LYK_DB.prepare(
        `SELECT * FROM campaigns WHERE id = ?`
      ).bind(iv.campaign_id).first() as any;

      if (campaign && campaign.completed + 1 >= campaign.total_invited && !campaign.tg_notified) {
        await context.env.LYK_DB.prepare(
          `UPDATE campaigns SET tg_notified = 1 WHERE id = ?`
        ).bind(iv.campaign_id).run();

        const doneInterviews = await context.env.LYK_DB.prepare(
          `SELECT nv_name FROM interviews WHERE campaign_id = ? AND status = 'done'`
        ).bind(iv.campaign_id).all();

        await sendTelegramSummary(
          context.env.TELEGRAM_BOT_TOKEN,
          context.env.TELEGRAM_CHAT_ID,
          campaign.campaign_title || iv.campaign_title,
          doneInterviews.results
        );
      }
    }

    return json({ success: true, reply, done: isDone });
  }

  return json({ error: 'Method not allowed' }, 405);
};
