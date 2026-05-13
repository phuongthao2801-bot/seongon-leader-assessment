import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { managerName, department, email, phone, bookingType, preferredDate, preferredTime, topic, overallScore } = body;

    if (!managerName || !email || !bookingType || !preferredDate || !preferredTime) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const [booking] = await db.insert(bookings).values({
      managerName,
      department,
      email,
      phone,
      bookingType,
      preferredDate,
      preferredTime,
      topic,
      overallScore,
    }).returning();

    return NextResponse.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allBookings = await db.select().from(bookings).orderBy(desc(bookings.createdAt));
  return NextResponse.json({ bookings: allBookings });
}
