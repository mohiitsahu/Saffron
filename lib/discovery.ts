import type { Prisma } from "@prisma/client";
import { bookingCreateSchema } from "@/lib/validation";
import { BOOKING_GAP_MS, isRealDay, dayStartIST, dayEndIST } from "@/lib/availability";

export function discoveryFilter(day: string, time: string, guests: string, now = Date.now()) {
  const where: Prisma.ChefProfileWhereInput = { active: true, suspended: false };
  let error = "";
  if (guests) {
    const n = Number(guests);
    if (!Number.isInteger(n) || n < 1 || n > 100) error = "Choose 1 to 100 guests.";
    else where.maxGuests = { gte: n };
  }
  if (day) {
    if (!isRealDay(day)) return { where, error: "Choose a valid date." };
    const parsed = time ? bookingCreateSchema.shape.eventDate.safeParse(`${day}T${time}`) : null;
    if (time && !parsed?.success) return { where, error: "Choose a valid time." };
    const date = parsed?.success ? parsed.data : null;
    if (dayEndIST(day).getTime() - now < 86_400_000 || dayStartIST(day).getTime() - now > 365 * 86_400_000 ||
      (date && (date.getTime() - now < 86_400_000 || date.getTime() - now > 365 * 86_400_000))) {
      error = "Choose a time at least 24 hours ahead and within one year.";
    }
    where.user = {
      blockedDays: { none: { day } },
      // With no time, conservatively exclude the whole accepted-booking day.
      chefBookings: { none: { status: "ACCEPTED", eventDate: date
        ? { gt: new Date(date.getTime() - BOOKING_GAP_MS), lt: new Date(date.getTime() + BOOKING_GAP_MS) }
        : { gte: dayStartIST(day), lte: dayEndIST(day) } } },
    };
  } else if (time) error = "Choose a date as well as a time.";
  return { where, error };
}
