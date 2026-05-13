"use client";

import { useState } from "react";

type Props = {
  managerName: string;
  department: string;
  overallScore: number;
  onClose: () => void;
};

export default function BookingForm({ managerName, department, overallScore, onClose }: Props) {
  const [form, setForm] = useState({
    email: "",
    phone: "",
    bookingType: "cafe",
    preferredDate: "",
    preferredTime: "",
    topic: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.preferredDate || !form.preferredTime) {
      setError("Vui lòng điền đầy đủ email, ngày và giờ mong muốn.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerName,
          department,
          overallScore,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi không xác định");
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ background: "white", borderRadius: 20, padding: "40px 28px", marginBottom: 18, border: "1px solid #e5e7eb", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#166534", marginBottom: 8 }}>Đặt lịch thành công!</h3>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 }}>
          Cảm ơn <strong>{managerName}</strong>! Chúng tôi sẽ liên hệ với bạn qua email <strong>{form.email}</strong> để xác nhận lịch.
        </p>
        <button onClick={onClose} style={{ padding: "11px 24px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "2px solid #e5e7eb", background: "white", color: "#374151" }}>
          Đóng
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 20, padding: "32px 28px", marginBottom: 18, border: "1px solid #e5e7eb", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1e3a8a" }}>📅 Đặt lịch tư vấn 1-1</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af" }}>✕</button>
      </div>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Điền thông tin bên dưới — chúng tôi sẽ liên hệ xác nhận lịch trong vòng 24h.</p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Booking type */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Hình thức *</label>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { value: "cafe", label: "☕ Cafe tư vấn 1-1", desc: "Gặp trực tiếp tại văn phòng" },
              { value: "online", label: "💬 Trao đổi online", desc: "Google Meet / Zoom" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("bookingType", opt.value)}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${form.bookingType === opt.value ? "#1a56db" : "#e5e7eb"}`,
                  background: form.bookingType === opt.value ? "#eff6ff" : "white",
                  transition: "all .15s",
                }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: form.bookingType === opt.value ? "#1a56db" : "#374151" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Email & Phone */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email *</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              placeholder="your@email.com"
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Số điện thoại</label>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
              placeholder="09xxxxxxxx"
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Date & Time */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Ngày mong muốn *</label>
            <input type="date" value={form.preferredDate} onChange={(e) => set("preferredDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Giờ mong muốn *</label>
            <select value={form.preferredTime} onChange={(e) => set("preferredTime", e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" }}>
              <option value="">-- Chọn giờ --</option>
              {["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Topic */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Chủ đề muốn trao đổi (tuỳ chọn)</label>
          <textarea value={form.topic} onChange={(e) => set("topic", e.target.value)}
            placeholder="Ví dụ: Tôi muốn trao đổi về cách cải thiện kỹ năng kết nối chiến lược với đội nhóm..."
            rows={3}
            style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, background: "#fafafa", color: "#111827", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>

        {error && <p style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", background: "#fee2e2", borderRadius: 8, padding: "10px 14px" }}>{error}</p>}

        <button type="submit" disabled={loading}
          style={{
            padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
            border: "none", color: "white", background: loading ? "#9ca3af" : "linear-gradient(135deg,#1a56db,#7c3aed)",
            boxShadow: loading ? "none" : "0 4px 14px rgba(0,0,0,.2)", transition: "all .2s",
          }}>
          {loading ? "Đang gửi..." : "📅 Xác nhận đặt lịch"}
        </button>
      </form>
    </div>
  );
}
