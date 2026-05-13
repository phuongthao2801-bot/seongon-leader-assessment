"use client";

import { useState, useEffect, useRef } from "react";
import BookingForm from "./BookingForm";

const ROLES = [
  {
    id: 1, color: "#3b82f6", gradient: "linear-gradient(135deg,#3b82f6,#6366f1)",
    title: "Kết nối chiến lược (CEO) và hành động (nhân viên)",
    short: "Kết nối chiến lược",
    questions: [
      "Tôi hiểu rõ chiến lược và mục tiêu của CEO để truyền đạt rõ ràng đến nhân viên",
      "Nhân viên của tôi hiểu rõ ý nghĩa công việc hằng ngày của họ trong việc đóng góp vào mục tiêu lớn",
      "Tôi xác định rõ mục tiêu, chiến lược và kế hoạch hành động cho đội nhóm theo chu kỳ (quý/tháng/tuần)",
      "Tôi kết nối mục tiêu nhóm với chiến lược công ty mỗi khi giao việc",
      "Tôi truyền cảm hứng, thúc đẩy và giúp đội nhóm hiểu ý nghĩa lớn hơn của công việc họ làm",
    ],
  },
  {
    id: 2, color: "#8b5cf6", gradient: "linear-gradient(135deg,#8b5cf6,#a855f7)",
    title: "Chịu trách nhiệm hoàn toàn về mục tiêu chung của đội nhóm",
    short: "Trách nhiệm mục tiêu",
    questions: [
      "Tôi chủ động xác định rõ những công việc quan trọng nhất, ưu tiên cao nhất trong đội nhóm của mình",
      "Khi không đạt mục tiêu, tôi sẵn sàng nhận trách nhiệm và tìm giải pháp cải thiện thay vì đổ lỗi cho người khác",
      "Tôi luôn giữ tinh thần \"đội nhóm không đạt mục tiêu là lỗi của người lãnh đạo\"",
      "Tôi thường xuyên theo dõi tiến độ thực hiện mục tiêu của đội nhóm",
      "Tôi có hành động cụ thể để hỗ trợ đội nhóm khi gặp khó khăn trong quá trình thực hiện mục tiêu",
    ],
  },
  {
    id: 3, color: "#ec4899", gradient: "linear-gradient(135deg,#ec4899,#f43f5e)",
    title: "Chịu trách nhiệm về hiệu suất nhân viên",
    short: "Hiệu suất nhân viên",
    questions: [
      "Tôi dành thời gian để huấn luyện và giúp nhân viên tự tìm giải pháp thay vì làm thay họ",
      "Tôi biết cách giao mục tiêu cụ thể, đo lường được và có thời hạn rõ ràng cho nhân viên",
      "Tôi thường xuyên cung cấp phản hồi mang tính xây dựng để giúp nhân viên cải thiện hiệu suất",
      "Tôi luôn ghi nhận và khen ngợi nhân viên khi họ đạt được kết quả tốt",
      "Tôi xem kết quả công việc của nhân viên là phản ánh năng lực quản lý của chính mình",
    ],
  },
  {
    id: 4, color: "#f59e0b", gradient: "linear-gradient(135deg,#f59e0b,#ef4444)",
    title: "Xây dựng văn hóa làm việc tích cực, chủ động, hiệu suất cao",
    short: "Văn hóa hiệu suất",
    questions: [
      "Đội nhóm của tôi thường xuyên thể hiện sự chủ động, sẵn sàng chịu trách nhiệm khi gặp vấn đề",
      "Tôi nêu gương trong việc chủ động, có trách nhiệm và tích cực trong công việc",
      "Tôi tạo môi trường an toàn để nhân viên dám chia sẻ ý kiến, phản hồi, kể cả phản biện với tôi",
      "Tôi luôn công nhận và lan tỏa những hành vi tích cực trong đội nhóm",
      "Tôi thảo luận với nhân viên về bài học rút ra sau mỗi dự án, kể cả khi thành công hay thất bại",
    ],
  },
  {
    id: 5, color: "#10b981", gradient: "linear-gradient(135deg,#10b981,#06b6d4)",
    title: "Xây dựng văn hóa đội nhóm phù hợp với văn hóa công ty",
    short: "Văn hóa công ty",
    questions: [
      "Các giá trị, nguyên tắc làm việc trong đội nhóm của tôi rõ ràng và đồng bộ với giá trị chung của công ty",
      "Tôi thường xuyên hành động nhất quán với các giá trị cốt lõi mà tôi kỳ vọng nhân viên tuân theo",
      "Tôi truyền đạt rõ cho nhân viên về hành vi nào là phù hợp với văn hóa công ty",
      "Tôi quan sát và phản hồi ngay khi có hành vi không phù hợp với văn hóa công ty",
      "Tôi giúp nhân viên hiểu mối liên hệ giữa văn hóa công ty và sự phát triển bền vững của doanh nghiệp",
    ],
  },
  {
    id: 6, color: "#06b6d4", gradient: "linear-gradient(135deg,#06b6d4,#3b82f6)",
    title: "Kết nối hiệu quả với các phòng ban khác trong công ty",
    short: "Phối hợp liên phòng",
    questions: [
      "Tôi đảm bảo đội nhóm của mình phối hợp hài hòa và hiệu quả với các phòng ban khác",
      "Khi có mâu thuẫn với các phòng ban khác, tôi chủ động giải quyết để duy trì sự hợp tác tốt đẹp",
      "Tôi có mối quan hệ làm việc tích cực và tôn trọng với các trưởng bộ phận khác",
      "Tôi thường xuyên chia sẻ thông tin quan trọng với các phòng ban liên quan đúng thời điểm",
      "Tôi góp phần tạo môi trường hợp tác tích cực giữa đội nhóm của tôi và các bộ phận khác",
    ],
  },
  {
    id: 7, color: "#f97316", gradient: "linear-gradient(135deg,#f97316,#ef4444)",
    title: "Là chính mình và làm gương cho nhân viên",
    short: "Làm gương",
    questions: [
      "Tôi hành xử nhất quán giữa lời nói và hành động trong công việc",
      "Tôi sẵn sàng nhận lỗi khi mình làm chưa tốt, thay vì đổ lỗi cho người khác",
      "Tôi giữ bình tĩnh và tỉnh táo trong những tình huống căng thẳng để làm gương cho nhân viên",
      "Tôi đối xử công bằng và nhất quán với tất cả thành viên trong đội nhóm",
      "Tôi duy trì thái độ tích cực và chủ động dù gặp áp lực hoặc khó khăn",
    ],
  },
];

const SUGGESTIONS: Record<number, { title: string; tips: string[] }> = {
  1: { title: "Kết nối Chiến lược", tips: ["Tổ chức họp đầu tháng/quý để giải thích chiến lược CEO bằng ngôn ngữ thực tế cho đội", "Trước khi giao việc, dành 2–3 phút giải thích \"việc này quan trọng với mục tiêu lớn vì...\"", "Tạo bảng OKR nhóm hiển thị rõ: mục tiêu cá nhân → mục tiêu đội → mục tiêu công ty"] },
  2: { title: "Trách nhiệm Mục tiêu", tips: ["Check-in mục tiêu hằng tuần (15 phút): review tiến độ, xác định bottleneck ngay trong tuần", "Khi KPI trễ, bắt đầu bằng câu hỏi: \"Mình đã thiếu hỗ trợ ở đâu?\" thay vì hỏi lý do", "Dùng dashboard theo dõi mục tiêu real-time để cả đội cùng thấy tiến độ chung"] },
  3: { title: "Hiệu suất Nhân viên", tips: ["Áp dụng lịch 1-on-1 định kỳ 2 tuần/lần: 50% phản hồi, 50% coaching", "Dùng framework GROW (Goal – Reality – Options – Will) khi nhân viên gặp khó khăn", "Lập kế hoạch phát triển cá nhân (IDP) rõ ràng cho từng nhân viên mỗi quý"] },
  4: { title: "Văn hóa Hiệu suất Cao", tips: ["Tạo \"Kudos Board\" nội bộ – mỗi tuần công khai 1–2 hành vi tích cực đáng khen", "Kết thúc dự án bằng Retrospective 30 phút: Làm tốt gì? Cần cải thiện gì?", "Đặt quy tắc đội: ai cũng được nói \"Tôi không đồng ý\" – và giải thích lý do"] },
  5: { title: "Sống Văn hóa Công ty", tips: ["Mỗi tháng chọn 1 giá trị cốt lõi của SEONGON để cả đội thảo luận và ứng dụng thực tế", "Khi khen hoặc phản hồi nhân viên, luôn kết nối với giá trị văn hóa cụ thể", "Phản hồi ngay (trong ngày) khi quan sát hành vi lệch văn hóa – không để qua ngày hôm sau"] },
  6: { title: "Phối hợp Liên phòng", tips: ["Lên lịch gặp đầu tháng với 1–2 trưởng bộ phận liên quan: chia sẻ ưu tiên, xác định điểm phối hợp", "Khi xung đột, tập trung vào mục tiêu chung thay vì bảo vệ lập trường của bộ phận mình", "Tạo kênh Slack/email chung để các bộ phận cập nhật tiến độ dự án cross-team"] },
  7: { title: "Làm gương & Tính Xác thực", tips: ["Mỗi tuần chia sẻ 1 điều bạn đang học hoặc cải thiện – nhân viên sẽ noi gương", "Thực hành \"vulnerability leadership\": dám nói \"Tôi đã sai ở điểm này\" trước đội nhóm", "Tự đánh giá hàng tháng: hành động trong tháng có khớp với giá trị bạn rao giảng không?"] },
};

function verdict(avg: number) {
  if (avg >= 4.5) return { label: "Xuất sắc", cls: "bg-blue-100 text-blue-700" };
  if (avg >= 4.0) return { label: "Tốt", cls: "bg-green-100 text-green-700" };
  if (avg >= 3.5) return { label: "Khá", cls: "bg-yellow-100 text-yellow-800" };
  if (avg >= 2.5) return { label: "Trung bình", cls: "bg-orange-100 text-orange-700" };
  return { label: "Cần cải thiện", cls: "bg-red-100 text-red-700" };
}

type Answers = Record<string, number>;

export default function Survey() {
  const [step, setStep] = useState(0); // 0=info, 1-7=roles, 8=results
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [warnInfo, setWarnInfo] = useState(false);
  const [warnRole, setWarnRole] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  function rate(key: string, val: number) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }

  function startSurvey() {
    if (!name.trim()) { setWarnInfo(true); return; }
    setWarnInfo(false);
    setStep(1);
  }

  function goNext(roleId: number) {
    const role = ROLES.find((r) => r.id === roleId)!;
    const missing = role.questions.some((_, i) => answers[`r${roleId}_q${i}`] === undefined);
    if (missing) { setWarnRole(true); return; }
    setWarnRole(false);
    if (roleId === 7) { setStep(8); return; }
    setStep(roleId + 1);
  }

  function goBack(roleId: number) {
    setWarnRole(false);
    setStep(roleId - 1);
  }

  const roleScores = ROLES.map((role) => {
    let sum = 0;
    role.questions.forEach((_, i) => { sum += answers[`r${role.id}_q${i}`] || 0; });
    const avg = sum / role.questions.length;
    return { roleId: role.id, sum, max: role.questions.length * 5, avg };
  });
  const totalSum = roleScores.reduce((a, b) => a + b.sum, 0);
  const overallAvg = totalSum / 35;

  const allQS = ROLES.flatMap((role) =>
    role.questions.map((q, i) => ({ role, q, score: answers[`r${role.id}_q${i}`] || 0 }))
  ).sort((a, b) => a.score - b.score);
  const lowItems = allQS.filter((x) => x.score <= 3).slice(0, 8);
  const strongRoles = roleScores.filter((rs) => rs.avg >= 4.0).sort((a, b) => b.avg - a.avg);
  const weakRoles = [...roleScores].sort((a, b) => a.avg - b.avg).slice(0, 3);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh" }}>
      <div ref={topRef} />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#1a56db 0%,#6d28d9 100%)", color: "white", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, opacity: 0.7, marginBottom: 6 }}>SEONGON · CÔNG CỤ NỘI BỘ</div>
        <h1 style={{ fontSize: "clamp(18px,4vw,26px)", fontWeight: 800, marginBottom: 6 }}>CHƯƠNG TRÌNH ĐÁNH GIÁ NĂNG LỰC QUẢN LÝ CẤP TRUNG 2026</h1>
        <p style={{ fontSize: 14, opacity: 0.8 }}>được thiết kế dành riêng cho SEONGON · 35 câu hỏi · 7 vai trò</p>
      </div>

      {/* STEP NAV */}
      {step > 0 && step <= 7 && (
        <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "16px 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,.07)" }}>
          <div style={{ display: "flex", alignItems: "center", maxWidth: 720, margin: "0 auto" }}>
            {ROLES.map((role, i) => (
              <div key={role.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                {i > 0 && (
                  <div style={{ flex: 1, height: 2.5, background: step > role.id ? "#22c55e" : "#e5e7eb", margin: "0 4px" }} />
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                    background: step > role.id ? "#22c55e" : step === role.id ? "#1a56db" : "white",
                    color: step >= role.id ? "white" : "#6b7280",
                    border: `2.5px solid ${step > role.id ? "#22c55e" : step === role.id ? "#1a56db" : "#e5e7eb"}`,
                    boxShadow: step === role.id ? "0 0 0 4px rgba(26,86,219,.15)" : "none",
                  }}>
                    {step > role.id ? "✓" : role.id}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", textAlign: "center", maxWidth: 64, display: "none" }} className="sm:block">{role.short}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 80px" }}>

        {/* STEP 0: INFO */}
        {step === 0 && (
          <div style={{ background: "white", borderRadius: 20, padding: "32px 28px", boxShadow: "0 2px 12px rgba(0,0,0,.08)", border: "1px solid #e5e7eb", maxWidth: 560, margin: "0 auto" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: "#1a56db" }}>Xin chào! 👋</h2>
            <p style={{ fontSize: 13.5, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>Bộ câu hỏi này giúp bạn tự đánh giá 7 vai trò cốt lõi của một Leader.<br />Điền thông tin bên dưới để bắt đầu nhé.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Họ và tên *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A"
                style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14.5, background: "#fafafa", color: "#111827" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Phòng / Bộ phận</label>
              <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Phòng Digital Marketing"
                style={{ padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14.5, background: "#fafafa", color: "#111827" }} />
            </div>
            <div style={{ background: "#f0f4ff", border: "1px solid #c7d7fd", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 10 }}>📌 Thang điểm đánh giá</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["#ef4444", "1", "Chưa bao giờ"], ["#f97316", "2", "Hiếm khi"], ["#eab308", "3", "Thỉnh thoảng"], ["#22c55e", "4", "Thường xuyên"], ["#3b82f6", "5", "Luôn luôn"]].map(([c, v, l]) => (
                  <div key={v} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, background: "white", borderRadius: 8, padding: "5px 10px", border: "1px solid #c7d7fd", color: "#1e40af" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: c, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: "white" }}>{v}</div>
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <button onClick={startSurvey} style={{ padding: "13px 32px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", border: "none", color: "white", background: "linear-gradient(135deg,#1a56db,#7c3aed)", boxShadow: "0 4px 14px rgba(0,0,0,.2)" }}>
                Bắt đầu →
              </button>
            </div>
            {warnInfo && <p style={{ fontSize: 13, fontWeight: 600, color: "#d97706", marginTop: 8, textAlign: "center" }}>Vui lòng nhập họ và tên trước khi bắt đầu.</p>}
          </div>
        )}

        {/* ROLE STEPS */}
        {step >= 1 && step <= 7 && (() => {
          const role = ROLES[step - 1];
          const answered = role.questions.filter((_, i) => answers[`r${role.id}_q${i}`] !== undefined).length;
          const pct = (answered / role.questions.length) * 100;
          return (
            <div>
              <div style={{ background: role.gradient, borderRadius: 18, padding: "26px 24px", marginBottom: 20, color: "white", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.2)", border: "2px solid rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, flexShrink: 0 }}>{role.id}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, opacity: 0.75, textTransform: "uppercase" }}>Vai trò {role.id} / 7</div>
                  <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35, marginTop: 2 }}>{role.title}</div>
                  <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>{role.questions.length} câu hỏi</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, background: role.color, width: `${pct}%`, transition: "width .4s ease" }} />
                </div>
                <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{answered} / {role.questions.length}</span>
              </div>

              {/* Questions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {role.questions.map((q, i) => {
                  const key = `r${role.id}_q${i}`;
                  const sel = answers[key];
                  const isAnswered = sel !== undefined;
                  return (
                    <div key={key} style={{ background: "white", borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${isAnswered ? "#bbf7d0" : "#e5e7eb"}`, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: role.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>
                          {ROLES.slice(0, step - 1).reduce((a, r) => a + r.questions.length, 0) + i + 1}
                        </div>
                        <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.55, flex: 1 }}>{q}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                        {[1, 2, 3, 4, 5].map((v) => {
                          const colors: Record<number, { bg: string; border: string; color: string }> = {
                            1: { bg: "#fee2e2", border: "#ef4444", color: "#dc2626" },
                            2: { bg: "#ffedd5", border: "#f97316", color: "#ea580c" },
                            3: { bg: "#fef9c3", border: "#eab308", color: "#ca8a04" },
                            4: { bg: "#dcfce7", border: "#22c55e", color: "#16a34a" },
                            5: { bg: "#dbeafe", border: "#3b82f6", color: "#2563eb" },
                          };
                          const c = colors[v];
                          const isSelected = sel === v;
                          return (
                            <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                              <button onClick={() => rate(key, v)}
                                style={{
                                  width: 44, height: 44, borderRadius: 11, cursor: "pointer",
                                  fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
                                  background: isSelected ? c.bg : "#f9fafb",
                                  border: `2px solid ${isSelected ? c.border : "#e5e7eb"}`,
                                  color: isSelected ? c.color : "#6b7280",
                                  transition: "all .15s",
                                }}>
                                {v}
                              </button>
                              <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.1, textAlign: "center", maxWidth: 44 }}>
                                {["Chưa\nbao giờ", "Hiếm\nkhi", "Thỉnh\nthoảng", "Thường\nxuyên", "Luôn\nluôn"][v - 1]}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {warnRole && <p style={{ fontSize: 13, fontWeight: 600, color: "#d97706", marginBottom: 8, textAlign: "center" }}>⚠️ Vui lòng trả lời đầy đủ tất cả {role.questions.length} câu trước khi tiếp tục.</p>}

              <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => goBack(role.id)} style={{ padding: "12px 22px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "2px solid #e5e7eb", background: "white", color: "#6b7280" }}>
                  ← Quay lại
                </button>
                <button onClick={() => goNext(role.id)} style={{ padding: "13px 32px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", border: "none", color: "white", background: role.gradient, boxShadow: "0 4px 14px rgba(0,0,0,.2)" }}>
                  {role.id === 7 ? "Xem kết quả 🎉" : "Tiếp theo →"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* RESULTS */}
        {step === 8 && (() => {
          const ov = verdict(overallAvg);
          return (
            <div>
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg,#1a56db,#7c3aed)", color: "white", borderRadius: 20, padding: "36px 28px", textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>{name}{dept ? ` · ${dept}` : ""}</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Kết Quả Đánh Giá Vai Trò Leader</h2>
                <div style={{ width: 140, height: 140, borderRadius: "50%", margin: "0 auto 16px", border: "3px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1 }}>{totalSum}</div>
                  <div style={{ fontSize: 15, opacity: 0.7 }}>/175</div>
                </div>
                <span style={{ display: "inline-block", background: "rgba(255,255,255,.2)", border: "1.5px solid rgba(255,255,255,.5)", borderRadius: 99, padding: "6px 20px", fontSize: 15, fontWeight: 700 }}>
                  {ov.label} · TB {overallAvg.toFixed(2)}/5
                </span>
              </div>

              {/* Scores by role */}
              <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 18, border: "1px solid #e5e7eb", boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</span>
                  Điểm theo từng Vai trò
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {roleScores.map((rs, idx) => {
                    const role = ROLES[idx];
                    const v = verdict(rs.avg);
                    const pct = (rs.sum / rs.max) * 100;
                    return (
                      <div key={rs.roleId} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: role.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "white" }}>{role.id}</div>
                          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{role.short}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{rs.avg.toFixed(2)}/5</div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }} className={v.cls}>{v.label}</span>
                        </div>
                        <div style={{ height: 8, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 99, background: role.color, width: `${pct}%`, transition: "width 1s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strengths */}
              {strongRoles.length > 0 && (
                <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 18, border: "1px solid #e5e7eb" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💪</span>
                    Điểm Mạnh Nổi Bật
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {strongRoles.map((rs) => {
                      const role = ROLES.find((r) => r.id === rs.roleId)!;
                      return (
                        <div key={rs.roleId} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#166534", lineHeight: 1.5 }}>
                          ✅ <strong>Vai trò {rs.roleId}: {role.title}</strong> — TB {rs.avg.toFixed(2)}/5. Tiếp tục duy trì và chia sẻ kinh nghiệm với đồng nghiệp.
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Low items */}
              {lowItems.length > 0 && (
                <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 18, border: "1px solid #e5e7eb" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎯</span>
                    Câu hỏi Cần Cải Thiện (điểm thấp nhất)
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {lowItems.map((x, idx) => {
                      const borderColors: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#eab308" };
                      return (
                        <div key={idx} style={{ borderLeft: `4px solid ${borderColors[x.score] || "#9ca3af"}`, padding: "12px 14px", borderRadius: "0 10px 10px 0", background: "#fafafa" }}>
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{x.q}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 10, alignItems: "center" }}>
                            <span>Vai trò {x.role.id}: {x.role.short}</span>
                            <span style={{ fontWeight: 700, fontSize: 12, padding: "2px 7px", borderRadius: 6, background: "#f3f4f6" }}>Điểm: {x.score}/5</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 18, border: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚀</span>
                  Gợi ý Phát Triển Cụ Thể
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {weakRoles.map((rs, idx) => {
                    const sug = SUGGESTIONS[rs.roleId];
                    const icons = ["🎯", "📈", "🔧"];
                    return (
                      <div key={rs.roleId} style={{ display: "flex", gap: 12, background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icons[idx]}</div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#1e3a8a", marginBottom: 4 }}>Vai trò {rs.roleId}: {sug.title} (TB: {rs.avg.toFixed(2)}/5)</div>
                          <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.55 }}>
                            {sug.tips.map((t, i) => <div key={i}><strong>{i + 1}.</strong> {t}</div>)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOOKING SECTION */}
              {!showBooking ? (
                <div style={{ background: "linear-gradient(135deg,#1e3a8a,#4f46e5)", borderRadius: 20, padding: "32px 28px", marginBottom: 18, textAlign: "center", color: "white" }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Đặt lịch tư vấn 1-1 với Sếp Thảo</h3>
                  <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 24, lineHeight: 1.6 }}>
                    Dựa trên kết quả đánh giá, bạn có thể đặt lịch để trao đổi sâu hơn về lộ trình phát triển năng lực lãnh đạo của mình.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={() => setShowBooking(true)}
                      style={{ padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", border: "none", background: "white", color: "#1e3a8a", boxShadow: "0 4px 14px rgba(0,0,0,.2)" }}>
                      ☕ Book lịch cafe tư vấn 1-1
                    </button>
                    <button
                      onClick={() => setShowBooking(true)}
                      style={{ padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", border: "2px solid rgba(255,255,255,.6)", background: "transparent", color: "white" }}>
                      💬 Đặt lịch trao đổi online
                    </button>
                  </div>
                </div>
              ) : (
                <BookingForm
                  managerName={name}
                  department={dept}
                  overallScore={totalSum}
                  onClose={() => setShowBooking(false)}
                />
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                <button onClick={() => window.print()} style={{ padding: "11px 24px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "2px solid #e5e7eb", background: "white", color: "#111827" }}>🖨️ In / Lưu PDF</button>
                <button onClick={() => { setStep(0); setAnswers({}); setName(""); setDept(""); setShowBooking(false); }} style={{ padding: "11px 24px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#1a56db", color: "white", border: "none", boxShadow: "0 3px 10px rgba(26,86,219,.3)" }}>↩ Làm lại từ đầu</button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
