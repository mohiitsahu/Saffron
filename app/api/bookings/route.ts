import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingSelect, getBookingsFor, serializeBooking, settleStaleBookings } from "@/lib/bookings";
import { bookingCreateSchema, fieldErrors } from "@/lib/validation";
import { istDayKey } from "@/lib/availability";
import { notifyBooking } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_NOTICE_MS = 24 * 60 * 60 * 1000;
const MAX_ADVANCE_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_OPEN_REQUESTS = 5;
const MAX_REQUESTS_PER_HOUR = 10;

type ErrorResult = {
  ok: false;
  status: number;
  error: string;
  fieldErrors?: Record<string, string>;
};

function refused(status: number, error: string, fieldErrors?: Record<string, string>): ErrorResult {
  return { ok: false, status, error, ...(fieldErrors ? { fieldErrors } : {}) };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to see your bookings." }, { status: 401 });
  }
  return NextResponse.json(await getBookingsFor(session.user.id));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to request a chef." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Some details need fixing. Check the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error.issues),
      },
      { status: 400 }
    );
  }

  const { chefProfileId, eventDate, guests, area, address, phone, notes } = parsed.data;
  const customerId = session.user.id;

  // Expire old requests before the transactional quota check.
  await settleStaleBookings({ customerId });

  const chef = await prisma.chefProfile.findUnique({
    where: { id: chefProfileId },
    select: {
      userId: true,
      displayName: true,
      city: true,
      active: true,
      suspended: true,
      maxGuests: true,
      pricePerPerson: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!chef || !chef.active || chef.suspended) {
    return NextResponse.json({ error: "This chef isn't taking requests right now." }, { status: 404 });
  }
  if (chef.userId === customerId) {
    return NextResponse.json({ error: "You can't book your own profile." }, { status: 400 });
  }

  // Validate inexpensive rules before we lock database rows.
  const issues: Record<string, string> = {};
  if (guests > chef.maxGuests) {
    issues.guests = `${chef.displayName} can cook for up to ${chef.maxGuests} guests. Lower the number and try again.`;
  }
  const advanceMs = eventDate.getTime() - Date.now();
  if (advanceMs < MIN_NOTICE_MS) {
    issues.eventDate = "Choose a time at least 24 hours from now.";
  } else if (advanceMs > MAX_ADVANCE_MS) {
    issues.eventDate = "Choose a date within the next year.";
  }
  if (Object.keys(issues).length > 0) {
    return NextResponse.json(
      { error: "Some details need fixing. Check the highlighted fields.", fieldErrors: issues },
      { status: 400 }
    );
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Serialize creates for a customer (quota enforcement), and any chef's booking
      // against that chef's blocked-day writes. Sorting avoids cross-user deadlocks.
      for (const id of [customerId, chef.userId].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      }

      // Re-check chef activity and capacity after obtaining the chef lock.
      const currentChef = await tx.chefProfile.findUnique({
        where: { id: chefProfileId },
        select: { active: true, suspended: true, maxGuests: true, pricePerPerson: true, city: true },
      });
      if (!currentChef?.active || currentChef.suspended) {
        return refused(404, "This chef isn't taking requests right now.");
      }
      if (guests > currentChef.maxGuests) {
        return refused(400, "Some details need fixing. Check the highlighted fields.", {
          guests: `${chef.displayName} can cook for up to ${currentChef.maxGuests} guests. Lower the number and try again.`,
        });
      }
      const now = Date.now();
      if (eventDate.getTime() - now < MIN_NOTICE_MS || eventDate.getTime() - now > MAX_ADVANCE_MS) {
        return refused(400, "Some details need fixing. Check the highlighted fields.", {
          eventDate: "Choose a date at least 24 hours away and within the next year.",
        });
      }

      const [openRequests, recentRequests, existing, blockedDay, clash] = await Promise.all([
        tx.booking.count({ where: { customerId, status: "REQUESTED" } }),
        tx.booking.count({
          where: { customerId, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
        }),
        tx.booking.findFirst({
          where: { customerId, chefId: chef.userId, status: { in: ["REQUESTED", "ACCEPTED"] } },
          select: { status: true },
        }),
        tx.chefBlockedDay.findUnique({
          where: { userId_day: { userId: chef.userId, day: istDayKey(eventDate) } },
          select: { id: true },
        }),
        tx.booking.findFirst({ where: { chefId: chef.userId, status: "ACCEPTED", eventDate: {
          gt: new Date(eventDate.getTime() - 14_400_000), lt: new Date(eventDate.getTime() + 14_400_000),
        } }, select: { id: true } }),
      ]);

      if (openRequests >= MAX_OPEN_REQUESTS) {
        return refused(429, `You already have ${MAX_OPEN_REQUESTS} requests waiting for an answer. Wait for a chef to reply, or cancel one, before sending another.`);
      }
      if (recentRequests >= MAX_REQUESTS_PER_HOUR) {
        return refused(429, "You've sent a lot of requests in the last hour. Please try again a little later.");
      }
      if (existing) {
        return refused(
          409,
          existing.status === "REQUESTED"
            ? "You already have a pending request with this chef. Check My bookings for their answer."
            : "You already have an accepted booking with this chef. See it under My bookings."
        );
      }
      if (blockedDay || clash) {
        return refused(400, "Some details need fixing. Check the highlighted fields.", {
          eventDate: `${chef.displayName} isn't available on that day. Choose another day.`,
        });
      }

      const estimatedTotal = guests * currentChef.pricePerPerson;
      const created = await tx.booking.create({
        data: {
          customerId,
          chefId: chef.userId,
          eventDate,
          guests,
          city: currentChef.city,
          area,
          address,
          phone,
          notes: notes || null,
          estimatedTotal,
        },
        select: bookingSelect,
      });
      await tx.bookingEvent.create({
        data: { bookingId: created.id, actorId: customerId, fromStatus: null, toStatus: "REQUESTED" },
      });
      return { ok: true as const, booking: created, estimatedTotal };
    }, { maxWait: 10_000, timeout: 15_000 });

    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error, ...(outcome.fieldErrors ? { fieldErrors: outcome.fieldErrors } : {}) },
        { status: outcome.status }
      );
    }

    // Notification is best effort; a failed email must never undo a saved booking.
    await notifyBooking("requested", {
      eventDate,
      guests,
      area,
      estimatedTotal: outcome.estimatedTotal,
      customer: { name: session.user.name ?? null, email: session.user.email ?? null },
      chef: {
        name: chef.user.name,
        email: chef.user.email,
        chefProfile: { displayName: chef.displayName },
      },
    });

    return NextResponse.json({ booking: serializeBooking(outcome.booking, customerId) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "You already have an open request with this chef. Check My bookings." },
        { status: 409 }
      );
    }
    // Transaction conflicts/timeouts are temporary; returning 503 avoids falsely
    // telling the customer that their booking was definitely saved.
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028"].includes(error.code)) {
      return NextResponse.json(
        { error: "We're handling several requests right now. Check My bookings before trying again." },
        { status: 503 }
      );
    }
    throw error;
  }
}
