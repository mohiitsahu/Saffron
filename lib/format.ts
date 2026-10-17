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

export function menuLines(menu: string) {
  return menu
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "Customer";
}