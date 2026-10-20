import { dayEndIST, dayStartIST, isRealDay } from "@/lib/availability";

export type MealSearch = { date: string; time: string; guests: string };

// Shared by the picker and discovery, so invalid details stay in the editor.
export function validateMealSearch(meal: MealSearch, now = Date.now()) {
  const { date: day, time, guests } = meal;
  let error = "";
  let date: Date | null = null;
  if (guests && (!Number.isInteger(Number(guests)) || Number(guests) < 1 || Number(guests) > 100)) error = "Choose 1 to 100 guests.";
  if (day) {
    if (!isRealDay(day)) return { date, error: "Choose a valid date." };
    if (time) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || Number(day.slice(0, 4)) < 2000) return { date, error: "Choose a valid time." };
      date = new Date(`${day}T${time}:00+05:30`);
      if (!Number.isFinite(date.getTime())) return { date: null, error: "Choose a valid time." };
    }
    if (dayEndIST(day).getTime() - now < 86_400_000 || dayStartIST(day).getTime() - now > 365 * 86_400_000 ||
      (date && (date.getTime() - now < 86_400_000 || date.getTime() - now > 365 * 86_400_000))) {
      error = "Choose a time at least 24 hours ahead and within one year.";
    }
  } else if (time) error = "Choose a date as well as a time.";
  return { date, error };
}

export function mealSearchLabel(meal: MealSearch) {
  const parts: string[] = [];
  if (isRealDay(meal.date)) {
    parts.push(new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${meal.date}T00:00:00+05:30`)));
  }
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(meal.time)) {
    const [hour, minute] = meal.time.split(":").map(Number);
    parts.push(`${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"} IST`);
  }
  if (meal.guests) parts.push(`${meal.guests} ${meal.guests === "1" ? "guest" : "guests"}`);
  return parts.join(" · ");
}
