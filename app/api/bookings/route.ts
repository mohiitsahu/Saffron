import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingSelect, getBookingsFor, serializeBooking } from "@/lib/bookings";
import { bookingCreateSchema, fieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MIN_NOTICE_MS = 24 * 60 * 60 * 1000;

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
    },
  });

  if (!chef || !chef.active) {
    return NextResponse.json({ error: "This chef isn't taking requests right now." }, { status: 404 });
  }
  if (chef.userId === userId) {
    return NextResponse.json({ error: "You can't book your own profile." }, { status: 400 });
  }

  // One request per chef: pending, accepted and declined requests all block a new one.
  // Completed and cancelled bookings don't, so customers can book a chef again later.
  const existing = await prisma.booking.findFirst({
    where: {
      customerId: userId,
      chefId: chef.userId,
      status: { in: ["REQUESTED", "ACCEPTED", "DECLINED"] },
    },
    select: { status: true },
  });
  if (existing) {
    const message =
      existing.status === "REQUESTED"
        ? "You already have a pending request with this chef. Check My bookings for their answer."
        : existing.status === "ACCEPTED"
          ? "You already have an accepted booking with this chef. See it under My bookings."
          : "This chef declined your earlier request, so you can't send another one.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const problems: Record<string, string> = {};
  if (guests > chef.maxGuests) {
    problems.guests = `${chef.displayName} can cook for up to ${chef.maxGuests} guests. Lower the number and try again.`;
  }
  if (eventDate.getTime() - Date.now() < MIN_NOTICE_MS) {
    problems.eventDate = "Choose a time at least 24 hours from now.";
  }
  if (Object.keys(problems).length > 0) {
    return NextResponse.json(
      { error: "Some details need fixing. Check the highlighted fields.", fieldErrors: problems },
      { status: 400 }
    );
  }

  // The total is always calculated here, never taken from the browser.
  const estimatedTotal = guests * chef.pricePerPerson;

  const booking = await prisma.booking.create({
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

  return NextResponse.json({ booking: serializeBooking(booking, userId) }, { status: 201 });
}