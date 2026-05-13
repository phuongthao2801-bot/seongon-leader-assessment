"use client";

import { useState } from "react";

type Booking = {
  id: number;
  managerName: string;
  department: string | null;
  email: string;
  phone: string | null;
  bookingType: string;
  preferredDate: string;
  preferredTime: string;
  topic: string | null;
  overallScore: number | null;
  createdAt: string;
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);

  async function fetchBookings() {
    if (!secret.trim()) { setError("Nhập secret key trước."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", { headers: { "x-admin-secret": secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unauthorized");
      setBookings(data.bookings);
      setAuthed(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  const typeLabel: Record<string, string> = { cafe: "☕ Cafe 1-1", online: "💬 Online" };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg,#1a56db,#6d28d9)", color: "white", padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, opacity: 0.7, marginBottom: 4 }}>SEONGON · ADMIN</div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Danh sách đặt lịch tư vấn</h1>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px" }}>
        {!authed ? (
          <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 480, margin: "0 auto", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: "#1a56db" }}>🔐 Xác thực Admin</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Admin Secret Key</label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchBookings()}
                placeholder="Nhập secret key..."
                style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, background: "#fafafa" }}
              />
            </div>
            {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
            <button onClick={fetchBookings} disabled={loading}
              style={{ width: "100%", padding: "13px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", border: "none", color: "white", background: "linear-gradient(135deg,#1a56db,#7c3aed)" }}>
              {loading ? "Đang tải..." : "Xem danh sách →"}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: "#6b7280" }}>Tổng cộng: <strong style={{ color: "#111827" }}>{bookings.length} lịch hẹn</strong></p>
              <button onClick={fetchBookings} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #e5e7eb", background: "white", color: "#374151" }}>
                🔄 Làm mới
              </button>
            </div>

            {bookings.length === 0 ? (
              <div style={{ background: "white", borderRadius: 16, padding: 40, textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p>Chưa có lịch hẹn nào.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {bookings.map((b) => (
                  <div key={b.id} style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{b.managerName}</div>
                        {b.department && <div style={{ fontSize: 13, color: "#6b7280" }}>{b.department}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: b.bookingType === "cafe" ? "#fef9c3" : "#dbeafe", color: b.bookingType === "cafe" ? "#92400e" : "#1e40af" }}>
                          {typeLabel[b.bookingType] || b.bookingType}
                        </span>
                        {b.overallScore && (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#f0fdf4", color: "#166534" }}>
                            {b.overallScore}/175 điểm
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8, fontSize: 13, color: "#374151", marginBottom: b.topic ? 12 : 0 }}>
                      <div>📧 {b.email}</div>
                      {b.phone && <div>📱 {b.phone}</div>}
                      <div>📅 {b.preferredDate} lúc {b.preferredTime}</div>
                      <div style={{ color: "#9ca3af", fontSize: 12 }}>Đặt lúc: {new Date(b.createdAt).toLocaleString("vi-VN")}</div>
                    </div>
                    {b.topic && (
                      <div style={{ background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#374151", marginTop: 8 }}>
                        💬 {b.topic}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
