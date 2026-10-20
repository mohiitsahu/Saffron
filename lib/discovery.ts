import type { Prisma } from "@prisma/client";
import { BOOKING_GAP_MS, dayStartIST, dayEndIST } from "@/lib/availability";
import { validateMealSearch } from "@/lib/mealSearch";

export function discoveryFilter(day: string, time: string, guests: string, now = Date.now()) {
  const where: Prisma.ChefProfileWhereInput = { active: true, suspended: false };
  const { date, error } = validateMealSearch({ date: day, time, guests }, now);
  if (error) return { where, error };
  if (guests) {
    const n = Number(guests);
    where.maxGuests = { gte: n };
  }
  if (day) {
    where.user = {
      blockedDays: { none: { day } },
      // With no time, conservatively exclude the whole accepted-booking day.
      chefBookings: { none: { status: "ACCEPTED", eventDate: date
        ? { gt: new Date(date.getTime() - BOOKING_GAP_MS), lt: new Date(date.getTime() + BOOKING_GAP_MS) }
        : { gte: dayStartIST(day), lte: dayEndIST(day) } } },
    };
  }
  return { where, error };
}
