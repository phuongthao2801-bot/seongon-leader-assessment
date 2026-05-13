import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  managerName: text("manager_name").notNull(),
  department: text("department"),
  email: text("email").notNull(),
  phone: text("phone"),
  bookingType: text("booking_type").notNull(), // "online" | "cafe"
  preferredDate: text("preferred_date").notNull(),
  preferredTime: text("preferred_time").notNull(),
  topic: text("topic"),
  overallScore: integer("overall_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
