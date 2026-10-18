import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const bookingSelect = {
  id: true,
  customerId: true,
  chefId: true,
  eventDate: true,
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
    eventPassed: booking.eventDate.getTime() <= Date.now(),
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
  booking: { status: BookingStatus; eventDate: Date },
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
  const rows = await prisma.booking.findMany({
    where: { OR: [{ customerId: userId }, { chefId: userId }] },
    orderBy: { eventDate: "desc" },
    take: 100,
    select: bookingSelect,
  });

  const views = rows.map((row) => serializeBooking(row, userId));

  // Active bookings first (soonest event first), then the rest (newest first).
  const isActive = (v: BookingView) => v.status === "REQUESTED" || v.status === "ACCEPTED";
  const active = views.filter(isActive).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const past = views.filter((v) => !isActive(v));
  const ordered = [...active, ...past];

  return {
    asCustomer: ordered.filter((v) => v.role === "customer"),
    asChef: ordered.filter((v) => v.role === "chef"),
  };
}