import { formatDateTimeIST, formatINR } from "@/lib/format";

export type BookingEmailKind =
  | "requested" // to the chef: a new request
  | "accepted" // to the customer
  | "declined" // to the customer
  | "cancelledByCustomer" // to the chef
  | "cancelledByChef" // to the customer
  | "completed"; // to the customer: invite a review

export type BookingEmailData = {
  kind: BookingEmailKind;
  recipientName: string;
  chefName: string;
  customerName: string;
  eventDate: Date;
  guests: number;
  area: string;
  total: number;
  siteUrl: string; // like "https://saffron.example", no trailing slash
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Copy = { subject: string; heading: string; body: string; button: string; path: string; showArea: boolean };

function copyFor(d: BookingEmailData): Copy {
  const when = formatDateTimeIST(d.eventDate);
  switch (d.kind) {
    case "requested":
      return {
        subject: `New booking request for ${when}`,
        heading: "You have a new booking request",
        body: `${d.customerName} would like to book you. Accept or decline it in My bookings. Their address and phone number are shared only after you accept.`,
        button: "Review the request",
        path: "/bookings",
        showArea: true,
      };
    case "accepted":
      return {
        subject: `${d.chefName} accepted your booking`,
        heading: "Your booking is accepted",
        body: `${d.chefName} will cook for you. Their phone number is now in My bookings, so you can sort out the details.`,
        button: "See your booking",
        path: "/bookings?tab=mine",
        showArea: true,
      };
    case "declined":
      return {
        subject: `${d.chefName} couldn't take your booking`,
        heading: "Your request was declined",
        body: `${d.chefName} can't take this booking. Nothing was charged. There are other chefs who might be free on that day.`,
        button: "Find another chef",
        path: "/chefs",
        showArea: false,
      };
    case "cancelledByCustomer":
      return {
        subject: `${d.customerName} cancelled the booking for ${when}`,
        heading: "A booking was cancelled",
        body: `${d.customerName} cancelled their booking. That day is free again.`,
        button: "See your bookings",
        path: "/bookings",
        showArea: false,
      };
    case "cancelledByChef":
      return {
        subject: `${d.chefName} cancelled your booking`,
        heading: "Your booking was cancelled",
        body: `${d.chefName} had to cancel this booking. Nothing was charged. You can find another chef for that day.`,
        button: "Find another chef",
        path: "/chefs",
        showArea: false,
      };
    case "completed":
      return {
        subject: `How was your meal with ${d.chefName}?`,
        heading: "How did it go?",
        body: `${d.chefName} marked your booking as completed. A short review helps other families choose a chef.`,
        button: "Leave a review",
        path: "/bookings?tab=mine",
        showArea: false,
      };
  }
}

export function buildBookingEmail(d: BookingEmailData): { subject: string; text: string; html: string } {
  const copy = copyFor(d);
  const url = `${d.siteUrl}${copy.path}`;

  const details: [string, string][] = [
    ["When", formatDateTimeIST(d.eventDate)],
    ["Guests", String(d.guests)],
  ];
  if (copy.showArea) details.push(["Area", d.area]);
  details.push(["Estimated total", formatINR(d.total)]);

  const privacy =
    "For your privacy, addresses and phone numbers are never sent by email. They appear in My bookings once a booking is accepted.";

  const text = [
    `Hi ${d.recipientName},`,
    "",
    copy.heading,
    "",
    copy.body,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    `${copy.button}: ${url}`,
    "",
    privacy,
    "Saffron never holds or moves your money.",
  ].join("\n");

  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5b6b66;font-size:14px;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#0F332C;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F7F2E6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8DCC4;">
    <div style="background:#123F36;padding:16px 24px;color:#C49A45;font-size:20px;font-weight:800;letter-spacing:0.5px;">Saffron</div>
    <div style="padding:24px;color:#0F332C;">
      <p style="margin:0 0 12px;font-size:15px;">Hi ${escapeHtml(d.recipientName)},</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(copy.heading)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(copy.body)}</p>
      <table style="border-collapse:collapse;margin:0 0 20px;">${rows}</table>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#2A6B5C;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${escapeHtml(copy.button)}</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#5b6b66;">${escapeHtml(privacy)} Saffron never holds or moves your money.</p>
    </div>
  </div>
</body></html>`;

  return { subject: copy.subject, text, html };
}
