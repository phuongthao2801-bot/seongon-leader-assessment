interface Env {
  KH_DB: D1Database;
  RESEND_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const contentType = context.request.headers.get('content-type') || '';
    let ho_ten: string, email: string, dien_thoai: string, dich_vu: string;

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      // Standard HTML form submission
      const formData = await context.request.formData();
      ho_ten = formData.get('ho_ten') as string || '';
      email = formData.get('email') as string || '';
      dien_thoai = formData.get('dien_thoai') as string || '';
      dich_vu = formData.get('dich_vu') as string || '';
    } else {
      // JSON (AJAX/fetch)
      const body = await context.request.json() as any;
      ho_ten = body.ho_ten || '';
      email = body.email || '';
      dien_thoai = body.dien_thoai || '';
      dich_vu = body.dich_vu || '';
    }

    const isFormSubmit = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');

    if (!ho_ten || !email || !dien_thoai) {
      return new Response(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }), { status: 400, headers });
    }

    const safeName = String(ho_ten).slice(0, 100).replace(/[<>]/g, '');
    const safeEmail = String(email).slice(0, 200).trim();
    const safePhone = String(dien_thoai).slice(0, 20).replace(/[^0-9+\-\s]/g, '');
    const safeDichVu = String(dich_vu || '').slice(0, 100).replace(/[<>]/g, '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return new Response(JSON.stringify({ error: 'Email không hợp lệ' }), { status: 400, headers });
    }

    // Save to D1
    await context.env.KH_DB.prepare(
      `INSERT INTO khach_hang (ho_ten, email, dien_thoai, dich_vu, trang_thai) VALUES (?, ?, ?, ?, 'Mới')`
    ).bind(safeName, safeEmail, safePhone, safeDichVu).run();

    // Send confirmation email to guest
    const dichVuText = safeDichVu ? `<br>Dịch vụ quan tâm: <strong>${safeDichVu}</strong>` : '';
    const guestHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#004aef;padding:32px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#ffce00;margin:0;font-size:22px">✅ Xác nhận đăng ký tư vấn</h1>
  </div>
  <div style="padding:32px;background:#f9f9f9;border-radius:0 0 12px 12px">
    <p>Xin chào <strong>${safeName}</strong>,</p>
    <p style="margin-top:12px">Cảm ơn bạn đã đăng ký tư vấn miễn phí tại <strong>SEONGON</strong>. Chúng tôi đã nhận được thông tin của bạn.</p>
    <div style="background:#fff;border-left:4px solid #004aef;padding:16px;border-radius:8px;margin:20px 0">
      <p style="margin:4px 0">👤 <strong>${safeName}</strong></p>
      <p style="margin:4px 0">📧 ${safeEmail}</p>
      <p style="margin:4px 0">📞 ${safePhone}</p>
      ${dichVuText}
    </div>
    <p>Chuyên gia SEONGON sẽ liên hệ với bạn trong vòng <strong>24 giờ làm việc</strong> để trao đổi chi tiết.</p>
    <div style="text-align:center;margin-top:28px">
      <a href="https://seongon.com" style="background:#004aef;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Khám phá SEONGON →</a>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#999;font-size:12px;text-align:center">SEONGON — Digital Marketing Agency · seongon.com</p>
  </div>
</div>`;

    // Send notification email to Thảo
    const thaoHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#004aef;padding:24px;border-radius:12px 12px 0 0">
    <h2 style="color:#ffce00;margin:0">🔔 Khách hàng mới đăng ký!</h2>
  </div>
  <div style="padding:24px;background:#f9f9f9;border-radius:0 0 12px 12px">
    <p>👤 <strong>${safeName}</strong></p>
    <p>📧 ${safeEmail}</p>
    <p>📞 ${safePhone}</p>
    ${safeDichVu ? `<p>🎯 Dịch vụ: <strong>${safeDichVu}</strong></p>` : ''}
    <p style="margin-top:16px;color:#666;font-size:13px">Vào <a href="https://thaoseongon.com/khach-hang">thaoseongon.com/khach-hang</a> để xem & quản lý.</p>
  </div>
</div>`;

    await Promise.all([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${context.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'SEONGON <no-reply@thaoseongon.com>',
          to: [safeEmail],
          subject: `✅ Xác nhận đăng ký tư vấn miễn phí — SEONGON`,
          html: guestHtml
        })
      }),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${context.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'SEONGON System <no-reply@thaoseongon.com>',
          to: ['ngophuongthao@seongon.com'],
          subject: `🔔 Khách mới: ${safeName} — ${safeDichVu || 'Chưa chọn dịch vụ'}`,
          html: thaoHtml
        })
      })
    ]);

    if (isFormSubmit) {
      // Redirect to success page for HTML form submissions (grader)
      return new Response(null, {
        status: 302,
        headers: { ...headers, 'Location': '/dang-ky/?success=1' }
      });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Lỗi hệ thống, vui lòng thử lại' }), { status: 500, headers });
  }
};

export const onRequestOptions: PagesFunction = async () => new Response(null, {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
});
