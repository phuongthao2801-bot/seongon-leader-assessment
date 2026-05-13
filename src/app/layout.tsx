import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đánh Giá Năng Lực Quản Lý Cấp Trung 2026 – SEONGON",
  description: "Công cụ tự đánh giá 7 vai trò cốt lõi của Leader tại SEONGON",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
