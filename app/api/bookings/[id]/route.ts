import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingSelect, resolveTransition, serializeBooking } from "@/lib/bookings";
import { formatDateTimeIST } from "@/lib/format";
import { bookingActionSchema } from "@/lib/validation";
import { notifyBooking } from "@/lib/notify";
import type { BookingEmailKind } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";

// A chef needs at least this long between two accepted bookings.
const ACCEPT_GAP_MS = 4 * 60 * 60 * 1000;

type Outcome = { ok: true } | { ok: false; status: number; error: string };

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
    select: { id: true, customerId: true, chefId: true, status: true, eventDate: true },
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
    if (parsed.data.action === "accept") {
      // One accept at a time per chef, so two accepts at the same moment can't both pass the check below.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.chefId}))`;

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
      where: { id: booking.id, status: booking.status },
      data: { status: result.status },
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

    return { ok: true };
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

  const fresh = await prisma.booking.findUnique({ where: { id: booking.id }, select: bookingSelect });
  return NextResponse.json({ booking: fresh ? serializeBooking(fresh, userId) : null });
}