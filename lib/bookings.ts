import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const bookingSelect = {
  id: true,
  customerId: true,
  chefId: true,
  eventDate: true,
  proposedEventDate: true,
  guests: true,
  city: true,
  area: true,
  address: true,
  phone: true,
  notes: true,
  estimatedTotal: true,
  status: true,
  createdAt: true,
  customer: { select: { name: true } },
  chef: {
    select: {
      name: true,
      phone: true,
      chefProfile: { select: { id: true, displayName: true } },
    },
  },
  review: { select: { rating: true } },
  // The latest cancellation, so each side can see who cancelled.
  events: {
    where: { toStatus: "CANCELLED" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { actorId: true },
  },
} as const;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

export type BookingView = {
  id: string;
  role: "customer" | "chef";
  status: BookingStatus;
  createdAt: string;
  eventDate: string;
  proposedEventDate: string | null;
  eventPassed: boolean;
  guests: number;
  city: string;
  area: string;
  notes: string | null;
  estimatedTotal: number;
  counterpartName: string;
  chefProfileId: string | null;
  address: string | null;
  contactPhone: string | null;
  contactRevealed: boolean;
  reviewRating: number | null;
  cancelledBy: "you" | "other" | null;
};

// Private details are shared only once the chef has accepted.
const REVEAL_STATUSES: BookingStatus[] = ["ACCEPTED", "COMPLETED"];

// The privacy rules live here, on the server. Anything not returned never reaches the browser.
export function serializeBooking(booking: BookingRow, viewerId: string): BookingView {
  if (booking.customerId !== viewerId && booking.chefId !== viewerId) {
    throw new Error("Viewer is not a party to this booking.");
  }

  const role = booking.customerId === viewerId ? "customer" : "chef";
  const revealed = REVEAL_STATUSES.includes(booking.status);
  const chefName = booking.chef.chefProfile?.displayName ?? booking.chef.name ?? "Chef";
  const cancelActor = booking.events[0]?.actorId ?? null;

  return {
    id: booking.id,
    role,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    eventDate: booking.eventDate.toISOString(),
    proposedEventDate: booking.status === "REQUESTED" ? booking.proposedEventDate?.toISOString() ?? null : null,
    eventPassed: Math.max(booking.eventDate.getTime(), booking.status === "REQUESTED" ? booking.proposedEventDate?.getTime() ?? 0 : 0) <= Date.now(),
    guests: booking.guests,
    city: booking.city,
    area: booking.area,
    notes: booking.notes,
    estimatedTotal: booking.estimatedTotal,
    counterpartName: role === "customer" ? chefName : booking.customer.name ?? "Customer",
    chefProfileId: booking.chef.chefProfile?.id ?? null,
    // Customers always see their own address. Chefs see it only after acceptance.
    address: role === "customer" ? booking.address : revealed ? booking.address : null,
    // Each side gets the other's phone only after acceptance.
    contactPhone: revealed ? (role === "customer" ? booking.chef.phone : booking.phone) : null,
    contactRevealed: revealed,
    reviewRating: booking.review?.rating ?? null,
    cancelledBy:
      booking.status === "CANCELLED" && cancelActor
        ? cancelActor === viewerId
          ? "you"
          : "other"
        : null,
  };
}

// An accepted booking the chef never marked as completed closes itself this long after the event.
const AUTO_COMPLETE_AFTER_MS = 72 * 60 * 60 * 1000;

// Tidies up bookings that nobody answered or closed, so they can't block anyone forever:
// - A request still waiting when its event time passes becomes EXPIRED.
// - An accepted booking becomes COMPLETED 72 hours after the event if the chef never closed it.
// Runs when pages load. Safe to call often and from two places at once.
export async function settleStaleBookings(scope: Prisma.BookingWhereInput = {}) {
  try {
    const now = Date.now();
    const stale = await prisma.booking.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { status: "REQUESTED", eventDate: { lte: new Date(now) }, OR: [{ proposedEventDate: null }, { proposedEventDate: { lte: new Date(now) } }] },
              { status: "ACCEPTED", eventDate: { lte: new Date(now - AUTO_COMPLETE_AFTER_MS) } },
            ],
          },
        ],
      },
      select: { id: true, status: true, version: true },
      take: 200,
    });
    if (stale.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const booking of stale) {
        const next: BookingStatus = booking.status === "REQUESTED" ? "EXPIRED" : "COMPLETED";
        // Only change it if nobody else changed it first.
        const result = await tx.booking.updateMany({
          where: { id: booking.id, status: booking.status, version: booking.version },
          data: { status: next, proposedEventDate: null, version: { increment: 1 } },
        });
        if (result.count === 1) {
          await tx.bookingEvent.create({
            data: { bookingId: booking.id, actorId: null, fromStatus: booking.status, toStatus: next },
          });
        }
      }
    });
  } catch (error) {
    // Tidying up must never break the page that triggered it.
    console.error("settleStaleBookings failed", error);
  }
}

export type BookingAction = "accept" | "decline" | "cancel" | "complete";

type Transition =
  | { ok: true; status: BookingStatus }
  | { ok: false; error: string; httpStatus: number };

function fail(httpStatus: number, error: string): Transition {
  return { ok: false, error, httpStatus };
}

// REQUESTED -> ACCEPTED -> COMPLETED.
// Chef: accepts or declines a new request, then can cancel or complete an accepted booking.
// Customer: can cancel (withdraw) a requested or accepted booking.
export function resolveTransition(
  action: BookingAction,
  booking: { status: BookingStatus; eventDate: Date; proposedEventDate?: Date | null },
  role: "customer" | "chef",
  now: Date = new Date()
): Transition {
  switch (action) {
    case "accept": {
      if (role !== "chef") return fail(403, "Only the chef can accept a request.");
      if (booking.status !== "REQUESTED") {
        return fail(409, "This request has already been answered or cancelled.");
      }
      if (booking.eventDate.getTime() <= now.getTime()) {
        return fail(400, "The event time has already passed, so this can't be accepted.");
      }
      return { ok: true, status: "ACCEPTED" };
    }
    case "decline": {
      if (role !== "chef") return fail(403, "Only the chef can decline a request.");
      if (booking.status !== "REQUESTED") {
        return fail(409, "This request has already been answered or cancelled.");
      }
      return { ok: true, status: "DECLINED" };
    }
    case "cancel": {
      if (booking.status !== "REQUESTED" && booking.status !== "ACCEPTED") {
        return fail(409, "Only requested or accepted bookings can be cancelled.");
      }
      // Once the event time has passed, a booking is closed by completing it, not cancelling it.
      if (Math.max(booking.eventDate.getTime(), booking.proposedEventDate?.getTime() ?? 0) <= now.getTime()) {
        return fail(409, "The event time has passed, so this can't be cancelled.");
      }
      // A chef answers a new request with Accept or Decline. Cancel is only for accepted bookings.
      if (role === "chef" && booking.status === "REQUESTED") {
        return fail(409, "Decline this request instead of cancelling it.");
      }
      return { ok: true, status: "CANCELLED" };
    }
    case "complete": {
      if (role !== "chef") return fail(403, "Only the chef can mark a booking as completed.");
      if (booking.status !== "ACCEPTED") {
        return fail(409, "Only accepted bookings can be marked as completed.");
      }
      if (booking.eventDate.getTime() > now.getTime()) {
        return fail(400, "You can mark a booking as completed after the event time.");
      }
      return { ok: true, status: "COMPLETED" };
    }
    default:
      return fail(400, "Unknown action.");
  }
}

export async function getBookingsFor(userId: string) {
  await settleStaleBookings({ OR: [{ customerId: userId }, { chefId: userId }] });

  const scope: Prisma.BookingWhereInput = { OR: [{ customerId: userId }, { chefId: userId }] };
  const actionable: Prisma.BookingWhereInput = { OR: [
    { status: { in: ["REQUESTED", "ACCEPTED"] } },
    { customerId: userId, status: "COMPLETED", review: { is: null } },
  ] };
  // History has a bounded initial window; pending work must never share its cutoff.
  // A batch transaction preserves the shared snapshot without the interactive
  // transaction's five-second lifetime (which includes database/network delays).
  const [activeRows, historyRows] = await prisma.$transaction([
    prisma.booking.findMany({ where: { AND: [scope, actionable] },
      orderBy: [{ eventDate: "asc" }, { id: "asc" }], select: bookingSelect }),
    prisma.booking.findMany({ where: { AND: [scope, { NOT: actionable }] },
      orderBy: [{ eventDate: "desc" }, { id: "desc" }], take: 100, select: bookingSelect }),
  ], { isolationLevel: "RepeatableRead" });
  const rows = [...activeRows, ...historyRows];

  const views = rows.map((row) => serializeBooking(row, userId));

  // Active bookings first (soonest event first), then the rest (newest first).
  const isActive = (v: BookingView) => v.status === "REQUESTED" || v.status === "ACCEPTED";
  const active = views.filter(isActive).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const past = views.filter((v) => !isActive(v)).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const ordered = [...active, ...past];

  return {
    asCustomer: ordered.filter((v) => v.role === "customer"),
    asChef: ordered.filter((v) => v.role === "chef"),
  };
}
