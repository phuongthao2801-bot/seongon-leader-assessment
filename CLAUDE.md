# SEONGON Leader Assessment — Context cho Claude Code

## Project là gì
Web app đánh giá năng lực quản lý cấp trung của SEONGON. Full-stack: Next.js 14 + Postgres (Neon) + Drizzle ORM.

## Cấu trúc quan trọng
- `src/app/page.tsx` — trang chính, render Survey component
- `src/components/Survey.tsx` — toàn bộ logic survey 35 câu hỏi / 7 vai trò
- `src/components/BookingForm.tsx` — form đặt lịch tư vấn, POST lên /api/bookings
- `src/app/api/bookings/route.ts` — API endpoint POST (tạo lịch) và GET (admin xem)
- `src/app/admin/page.tsx` — trang admin xem danh sách lịch hẹn
- `src/db/schema.ts` — Drizzle schema, bảng `bookings`
- `src/db/index.ts` — Neon DB connection

## Env vars cần thiết
- `DATABASE_URL` — Neon Postgres connection string
- `ADMIN_SECRET` — key bảo vệ GET /api/bookings và trang /admin

## Lưu ý
- Chạy `npm run db:push` sau khi có DATABASE_URL để tạo bảng
- Deploy trên Vercel, DB trên Neon (free tier)
