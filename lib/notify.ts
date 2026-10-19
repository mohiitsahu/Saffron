import { sendEmail } from "@/lib/email";
import { buildBookingEmail, type BookingEmailKind } from "@/lib/emailTemplates";
import { firstName } from "@/lib/format";

// The people and details an email needs. Nothing private (address, phone) is ever in here.
export type NotifyBooking = {
  eventDate: Date;
  guests: number;
  area: string;
  estimatedTotal: number;
  customer: { name: string | null; email: string | null };
  chef: { name: string | null; email: string | null; chefProfile: { displayName: string } | null };
};

export function siteUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

// Emails the right person about a booking. Safe to call anywhere: it never throws.
export async function notifyBooking(kind: BookingEmailKind, booking: NotifyBooking): Promise<void> {
  try {
    // New requests and customer cancellations go to the chef. Everything else goes to the customer.
    const toChef = kind === "requested" || kind === "cancelledByCustomer" || kind === "proposalAccepted";
    const recipient = toChef ? booking.chef : booking.customer;
    if (!recipient.email) return;

    const chefName = booking.chef.chefProfile?.displayName ?? booking.chef.name ?? "Your chef";
    const message = buildBookingEmail({
      kind,
      recipientName: toChef ? chefName : firstName(booking.customer.name),
      chefName,
      customerName: firstName(booking.customer.name),
      eventDate: booking.eventDate,
      guests: booking.guests,
      area: booking.area,
      total: booking.estimatedTotal,
      siteUrl: siteUrl(),
    });

    await sendEmail({ to: recipient.email, ...message });
  } catch (error) {
    console.error("notifyBooking failed", error);
  }
}
