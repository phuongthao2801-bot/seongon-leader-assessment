# SEONGON Leader Assessment

Công cụ tự đánh giá năng lực quản lý cấp trung 2026 — dành riêng cho SEONGON.

## Tính năng

- **Survey 35 câu hỏi** đánh giá 7 vai trò cốt lõi của Leader
- **Kết quả chi tiết**: điểm theo vai trò, điểm mạnh, điểm cần cải thiện, gợi ý phát triển
- **Đặt lịch tư vấn 1-1**: book café tư vấn hoặc trao đổi online — lưu vào database thật
- **Trang admin**: xem toàn bộ lịch hẹn (protected bằng secret key)

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL trên Neon (serverless)
- **ORM**: Drizzle ORM
- **Deploy**: Vercel

## Cách chạy local

```bash
npm install
cp .env.example .env.local
# Điền DATABASE_URL và ADMIN_SECRET vào .env.local
npm run db:push   # Tạo bảng trong DB
npm run dev       # Chạy dev server
```

## Cách deploy lên Vercel

1. Push repo lên GitHub
2. Import vào [vercel.com](https://vercel.com)
3. Thêm Environment Variables: `DATABASE_URL`, `ADMIN_SECRET`
4. Deploy

## API

- `POST /api/bookings` — Tạo lịch hẹn mới
- `GET /api/bookings` — Lấy danh sách (yêu cầu header `x-admin-secret`)

## Trang Admin

Truy cập `/admin` — nhập `ADMIN_SECRET` để xem danh sách lịch hẹn.

## Environment Variables

```
DATABASE_URL=postgresql://...   # Neon connection string
ADMIN_SECRET=your-secret-key    # Key bảo vệ trang admin
```
