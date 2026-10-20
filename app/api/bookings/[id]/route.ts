import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingSelect, resolveTransition, serializeBooking, type BookingView } from "@/lib/bookings";
import { formatDateTimeIST } from "@/lib/format";
import { istDayKey } from "@/lib/availability";
import { bookingActionSchema } from "@/lib/validation";
import { notifyBooking } from "@/lib/notify";
import type { BookingEmailKind } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A chef needs at least this long between two accepted bookings.
const ACCEPT_GAP_MS = 4 * 60 * 60 * 1000;

type Outcome = { ok: true; booking: BookingView } | { ok: false; status: number; error: string };

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bookingActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const userId = session.user.id;
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { id: true, customerId: true, chefId: true, status: true, eventDate: true, proposedEventDate: true, version: true, guests: true },
  });

  // Strangers get the same answer as a missing booking.
  if (!booking || (booking.customerId !== userId && booking.chefId !== userId)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const role = booking.customerId === userId ? "customer" : "chef";
  const result = resolveTransition(parsed.data.action, booking, role);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }

  const outcome: Outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.chefId}))`;
    if (parsed.data.action === "accept" && booking.proposedEventDate) {
      return { ok: false, status: 409, error: "Withdraw the proposed time first, or wait for the customer's answer." };
    }
    if (parsed.data.action === "accept") {
      const profile = await tx.chefProfile.findUnique({ where: { userId: booking.chefId }, select: { suspended: true, maxGuests: true } });
      if (!profile) return { ok: false, status: 409, error: "This chef profile is no longer available." };
      if (profile.suspended) return { ok: false, status: 409, error: "An administrator has hidden this chef profile. This request cannot be accepted." };
      if (booking.guests > profile.maxGuests) return { ok: false, status: 409, error: `This request has ${booking.guests} guests, but your current limit is ${profile.maxGuests}. Update your capacity before accepting.` };
      // One accept at a time per chef, so two accepts at the same moment can't both pass the check below.

      // The chef may have blocked this day after the customer sent the request.
      // Share the same lock as day-blocking and booking creation.
      const blocked = await tx.chefBlockedDay.findUnique({
        where: { userId_day: { userId: booking.chefId, day: istDayKey(booking.eventDate) } },
        select: { id: true },
      });
      if (blocked) {
        return { ok: false, status: 409, error: "You marked this day unavailable. Open the day before accepting this booking." };
      }
      if (booking.eventDate.getTime() <= Date.now()) {
        return { ok: false, status: 409, error: "This event time has passed. Refresh your bookings." };
      }

      const clash = await tx.booking.findFirst({
        where: {
          chefId: booking.chefId,
          status: "ACCEPTED",
          id: { not: booking.id },
          eventDate: {
            gt: new Date(booking.eventDate.getTime() - ACCEPT_GAP_MS),
            lt: new Date(booking.eventDate.getTime() + ACCEPT_GAP_MS),
          },
        },
        select: { eventDate: true },
      });

      if (clash) {
        return {
          ok: false,
          status: 409,
          error: `You already have an accepted booking on ${formatDateTimeIST(clash.eventDate)}. Keep at least 4 hours between bookings, or cancel one of them first.`,
        };
      }
    }

    // Only update if the status is still what we just checked, so two clicks can't both win.
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status, version: booking.version },
      data: { status: result.status, proposedEventDate: null, version: { increment: 1 } },
    });
    if (updated.count === 0) {
      return {
        ok: false,
        status: 409,
        error: "This booking was just updated. Refresh the page and try again.",
      };
    }

    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        actorId: userId,
        fromStatus: booking.status,
        toStatus: result.status,
      },
    });

    // Build the response before commit so a failed read/serialization rolls back the action.
    const fresh = await tx.booking.findUniqueOrThrow({ where: { id: booking.id }, select: bookingSelect });
    return { ok: true, booking: serializeBooking(fresh, userId) };
  }, { maxWait: 10_000, timeout: 15_000 }).catch((error: unknown): Outcome => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034", "P2024"].includes(error.code)) {
      return { ok: false, status: 503, error: "This booking could not be updated right now. Refresh My bookings before trying again." };
    }
    throw error;
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  // Tell the other person what happened. This never fails the request.
  const kinds: Record<string, BookingEmailKind> = {
    accept: "accepted",
    decline: "declined",
    complete: "completed",
    cancel: role === "customer" ? "cancelledByCustomer" : "cancelledByChef",
  };
  try {
    const mail = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        eventDate: true,
        guests: true,
        area: true,
        estimatedTotal: true,
        customer: { select: { name: true, email: true } },
        chef: { select: { name: true, email: true, chefProfile: { select: { displayName: true } } } },
      },
    });
    if (mail) await notifyBooking(kinds[parsed.data.action], mail);

  } catch {
    // The booking is committed. Email preparation must not change its successful response.
    console.error("Booking email could not be prepared.");
  }

  return NextResponse.json({ booking: outcome.booking });
}
