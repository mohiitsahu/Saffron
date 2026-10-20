import type { Prisma } from "@prisma/client";

// Only the other person's actions, or system updates, belong in this inbox.
export function notificationScope(userId: string): Prisma.BookingEventWhereInput {
  return {
    booking: { OR: [{ customerId: userId }, { chefId: userId }] },
    OR: [{ actorId: null }, { actorId: { not: userId } }],
    toStatus: { in: ["REQUESTED", "ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED", "EXPIRED"] },
  };
}

export type NotificationItem = {
  id: string; title: string; message: string; href: string; createdAt: string; unread: boolean;
};
export type NotificationFeed = { items: NotificationItem[]; unread: number; through: string };

export function notificationCopy(kind: string | null, status: string, name: string) {
  switch (kind) {
    case "time_propose": return { title: "A new time to review", message: `${name} suggested a different time. Open the booking to respond.` };
    case "time_accept": return { title: "Suggested time accepted", message: `${name} accepted the new time. Your booking is confirmed.` };
    case "time_decline": return { title: "Suggested time declined", message: `${name} declined the suggested time. The request is now closed.` };
    case "time_withdraw": return { title: "Suggested time withdrawn", message: `${name} withdrew the new time. The original request is still pending.` };
  }
  switch (status) {
    case "REQUESTED": return { title: "New booking request", message: `${name} sent you a request. Take a look when you’re ready.` };
    case "ACCEPTED": return { title: "Your booking is accepted", message: `${name} accepted your request. Contact details are now in the booking.` };
    case "DECLINED": return { title: "Booking request declined", message: `${name} couldn’t take this booking. You can find another chef.` };
    case "CANCELLED": return { title: "Booking cancelled", message: `${name} cancelled the booking. Open it for the details.` };
    case "COMPLETED": return { title: "How was your meal?", message: `${name} marked the meal completed. You can now leave a review.` };
    default: return { title: "Booking request expired", message: "The request’s event time has passed. You can send a new request for another day." };
  }
}
