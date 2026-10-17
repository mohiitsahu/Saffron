import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingSelect, resolveTransition, serializeBooking } from "@/lib/bookings";
import { bookingActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

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

  // Only update if the status is still what we just checked, so two clicks can't both win.
  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status },
    data: { status: result.status },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "This booking was just updated. Refresh the page and try again." },
      { status: 409 }
    );
  }

  const fresh = await prisma.booking.findUnique({ where: { id: booking.id }, select: bookingSelect });
  return NextResponse.json({ booking: fresh ? serializeBooking(fresh, userId) : null });
}