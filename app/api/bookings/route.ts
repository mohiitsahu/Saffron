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

const MIN_NOTICE_MS = 24 * 60 * 60 * 1000;
const MAX_ADVANCE_MS = 365 * 24 * 60 * 60 * 1000;
// Limits that stop one person flooding chefs with requests.
const MAX_OPEN_REQUESTS = 5;
const MAX_REQUESTS_PER_HOUR = 10;

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
  const userId = session.user.id;

  const chef = await prisma.chefProfile.findUnique({
    where: { id: chefProfileId },
    select: {
      userId: true,
      displayName: true,
      city: true,
      active: true,
      maxGuests: true,
      pricePerPerson: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!chef || !chef.active) {
    return NextResponse.json({ error: "This chef isn't taking requests right now." }, { status: 404 });
  }
  if (chef.userId === userId) {
    return NextResponse.json({ error: "You can't book your own profile." }, { status: 400 });
  }

  // Old unanswered requests expire first, so they don't block this one or count towards the limits.
  await settleStaleBookings({ customerId: userId });

  const [openRequests, recentRequests] = await Promise.all([
    prisma.booking.count({ where: { customerId: userId, status: "REQUESTED" } }),
    prisma.booking.count({ where: { customerId: userId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } }),
  ]);
  if (openRequests >= MAX_OPEN_REQUESTS) {
    return NextResponse.json(
      {
        error: `You already have ${MAX_OPEN_REQUESTS} requests waiting for an answer. Wait for a chef to reply, or cancel one, before sending another.`,
      },
      { status: 429 }
    );
  }
  if (recentRequests >= MAX_REQUESTS_PER_HOUR) {
    return NextResponse.json(
      { error: "You've sent a lot of requests in the last hour. Please try again a little later." },
      { status: 429 }
    );
  }

  // One open request per chef: only pending or accepted requests block a new one.
  // Declined, completed and cancelled bookings don't, so customers can book a chef again.
  const existing = await prisma.booking.findFirst({
    where: {
      customerId: userId,
      chefId: chef.userId,
      status: { in: ["REQUESTED", "ACCEPTED"] },
    },
    select: { status: true },
  });
  if (existing) {
    const message =
      existing.status === "REQUESTED"
        ? "You already have a pending request with this chef. Check My bookings for their answer."
        : "You already have an accepted booking with this chef. See it under My bookings.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const problems: Record<string, string> = {};
  if (guests > chef.maxGuests) {
    problems.guests = `${chef.displayName} can cook for up to ${chef.maxGuests} guests. Lower the number and try again.`;
  }
  if (eventDate.getTime() - Date.now() < MIN_NOTICE_MS) {
    problems.eventDate = "Choose a time at least 24 hours from now.";
  } else if (eventDate.getTime() - Date.now() > MAX_ADVANCE_MS) {
    problems.eventDate = "Choose a date within the next year.";
  }
  // The chef may have marked this day as unavailable.
  if (!problems.eventDate) {
    const blockedDay = await prisma.chefBlockedDay.findUnique({
      where: { userId_day: { userId: chef.userId, day: istDayKey(eventDate) } },
      select: { id: true },
    });
    if (blockedDay) {
      problems.eventDate = `${chef.displayName} isn't available on that day. Choose another day.`;
    }
  }
  if (Object.keys(problems).length > 0) {
    return NextResponse.json(
      { error: "Some details need fixing. Check the highlighted fields.", fieldErrors: problems },
      { status: 400 }
    );
  }

  // The total is always calculated here, never taken from the browser.
  const estimatedTotal = guests * chef.pricePerPerson;

  try {
    // The booking and its first log entry are saved together or not at all.
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          customerId: userId,
          chefId: chef.userId,
          eventDate,
          guests,
          city: chef.city,
          area,
          address,
          phone,
          notes: notes || null,
          estimatedTotal,
        },
        select: bookingSelect,
      });

      await tx.bookingEvent.create({
        data: { bookingId: created.id, actorId: userId, fromStatus: null, toStatus: "REQUESTED" },
      });

      return created;
    });

    // Tell the chef. This never fails the request: if email is down, the booking still stands.
    await notifyBooking("requested", {
      eventDate,
      guests,
      area,
      estimatedTotal,
      customer: { name: session.user.name ?? null, email: session.user.email ?? null },
      chef: {
        name: chef.user.name,
        email: chef.user.email,
        chefProfile: { displayName: chef.displayName },
      },
    });

    return NextResponse.json({ booking: serializeBooking(booking, userId) }, { status: 201 });
  } catch (error) {
    // Two clicks at once: the database rule lets only one open request through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "You already have an open request with this chef. Check My bookings." },
        { status: 409 }
      );
    }
    throw error;
  }
}