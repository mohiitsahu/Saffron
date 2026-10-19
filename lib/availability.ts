// Chef availability. A "day" is a calendar day in India, written like "2030-11-02".
// Days are stored as text so there is no timezone maths to get wrong.

export const MAX_BLOCKED_DAYS = 200; // per chef
export const MAX_RANGE_DAYS = 90; // most days that can be added in one go
const MAX_AHEAD_DAYS = 366;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// The Indian calendar day a moment falls on.
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayIST(now: Date = new Date()): string {
  return istDayKey(now);
}

// True only for real calendar days ("2030-02-30" is not one).
export function isRealDay(value: string): boolean {
  const m = DAY_PATTERN.exec(value);
  if (!m) return false;
  const [year, month, day] = m.slice(1).map(Number);
  if (year < 2000) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// The first and last moments of an Indian calendar day.
export function dayStartIST(day: string): Date {
  return new Date(`${day}T00:00:00+05:30`);
}
export function dayEndIST(day: string): Date {
  return new Date(dayStartIST(day).getTime() + DAY_MS - 1);
}

type RangeResult = { ok: true; days: string[] } | { ok: false; error: string };

// Turns "from" and an optional "to" into the list of days between them (inclusive).
export function expandRange(from: string, to: string | undefined, now: Date = new Date()): RangeResult {
  const end = to || from;
  if (!isRealDay(from) || !isRealDay(end)) return { ok: false, error: "Choose real dates." };

  const today = todayIST(now);
  if (from < today) return { ok: false, error: "You can't block a day that has already passed." };
  if (end < from) return { ok: false, error: "The last day must be on or after the first day." };

  const lastAllowed = istDayKey(new Date(now.getTime() + MAX_AHEAD_DAYS * DAY_MS));
  if (end > lastAllowed) return { ok: false, error: "Choose dates within the next year." };

  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  let key = from;
  while (key <= end) {
    days.push(key);
    if (days.length > MAX_RANGE_DAYS) {
      return { ok: false, error: `Block at most ${MAX_RANGE_DAYS} days at a time.` };
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    key = cursor.toISOString().slice(0, 10);
  }
  return { ok: true, days };
}
