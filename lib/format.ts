export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateIST(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}

export function formatDateTimeIST(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}

// datetime-local has no timezone. Booking forms send these values as IST,
// regardless of where the customer's browser is located.
export function bookingDateLimits(now = Date.now()) {
  const minute = 60_000;
  const day = 24 * 60 * minute;
  const input = (timestamp: number) => new Date(timestamp + 5.5 * 60 * minute).toISOString().slice(0, 16);
  return {
    min: input(Math.ceil((now + day) / minute) * minute),
    max: input(Math.floor((now + 365 * day) / minute) * minute),
  };
}

export function menuLines(menu: string) {
  return menu
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "Customer";
}
