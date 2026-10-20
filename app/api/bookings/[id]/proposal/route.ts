import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookingCreateSchema } from "@/lib/validation";
import { bookingSelect, serializeBooking } from "@/lib/bookings";
import { istDayKey } from "@/lib/availability";
import { notifyBooking } from "@/lib/notify";

export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose"), eventDate: bookingCreateSchema.shape.eventDate }),
  z.object({ action: z.enum(["accept", "decline", "withdraw"]), expectedDate: z.iso.datetime() }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid action and time." }, { status: 400 });
  const input = parsed.data;
  const userId = session.user.id;
  const found = await prisma.booking.findUnique({ where: { id: params.id }, select: { chefId: true, customerId: true } });
  if (!found || ![found.chefId, found.customerId].includes(userId)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.chefId}))`;
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: params.id } });
    if (booking.status !== "REQUESTED") return { error: "This request has already been answered.", status: 409 };
    const chefAction = input.action === "propose" || input.action === "withdraw";
    if (userId !== (chefAction ? booking.chefId : booking.customerId)) return { error: "You cannot perform this action.", status: 403 };
    // A stale browser can submit without loading the page that normally expires
    // old requests. Check the existing deadlines before considering a new one.
    if (Math.max(booking.eventDate.getTime(), booking.proposedEventDate?.getTime() ?? 0) <= Date.now()) {
      const expired = await tx.booking.updateMany({ where: { id: booking.id, status: "REQUESTED", version: booking.version }, data: { status: "EXPIRED", proposedEventDate: null, version: { increment: 1 } } });
      if (expired.count) await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: null, fromStatus: "REQUESTED", toStatus: "EXPIRED" } });
      return { error: "This request has expired. The customer needs to send a new request.", status: 409 };
    }
    if (input.action !== "propose" && booking.proposedEventDate?.toISOString() !== input.expectedDate) {
      return { error: "The proposed time changed. Refresh before answering.", status: 409 };
    }
    if (input.action === "propose" || input.action === "accept") {
      const date = input.action === "propose" ? input.eventDate : booking.proposedEventDate!;
      const advance = date.getTime() - Date.now();
      if (input.action === "propose" && date.getTime() === booking.eventDate.getTime()) return { error: "Choose a different time from the original request.", status: 400 };
      if (input.action === "propose" && await tx.bookingEvent.count({ where: { bookingId: booking.id, kind: "time_propose", createdAt: { gt: new Date(Date.now() - 3_600_000) } } }) >= 5) {
        return { error: "Too many suggestions for this booking. Please wait before sending another.", status: 429 };
      }
      if (advance < (input.action === "propose" ? 86_400_000 : 0) || advance > 365 * 86_400_000) {
        return { error: "Propose a time at least 24 hours ahead and within a year. Past proposals cannot be accepted.", status: 400 };
      }
      const profile = await tx.chefProfile.findUnique({ where: { userId: booking.chefId } });
      if (!profile?.active || profile.suspended || profile.maxGuests < booking.guests) {
        return { error: "This chef cannot take this booking right now.", status: 409 };
      }
      const blocked = await tx.chefBlockedDay.findUnique({ where: { userId_day: { userId: booking.chefId, day: istDayKey(date) } } });
      const clash = await tx.booking.findFirst({ where: {
        chefId: booking.chefId, status: "ACCEPTED", id: { not: booking.id },
        eventDate: { gt: new Date(date.getTime() - 14_400_000), lt: new Date(date.getTime() + 14_400_000) },
      } });
      if (blocked || clash) return { error: "The chef is unavailable at this time. Choose another time.", status: 409 };
    }
    const next = input.action === "accept" ? "ACCEPTED" : input.action === "decline" ? "DECLINED" : "REQUESTED";
    const changed = await tx.booking.updateMany({ where: { id: booking.id, status: "REQUESTED", version: booking.version }, data: {
      status: next, version: { increment: 1 },
      proposedEventDate: input.action === "propose" ? input.eventDate : null,
      ...(input.action === "accept" ? { eventDate: booking.proposedEventDate! } : {}),
    } });
    if (!changed.count) return { error: "This request was updated. Refresh before answering.", status: 409 };
    const updated = await tx.booking.findUniqueOrThrow({ where: { id: booking.id }, select: bookingSelect });
    await tx.bookingEvent.create({ data: {
      bookingId: booking.id, actorId: userId, fromStatus: booking.status, toStatus: next,
      kind: `time_${input.action}`,
    } });
    return { booking: updated };
  }, { maxWait: 10_000, timeout: 15_000 });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (input.action === "propose" || input.action === "accept") {
    try {
      const mail = await prisma.booking.findUnique({ where: { id: params.id }, select: {
        eventDate: true, proposedEventDate: true, guests: true, area: true, estimatedTotal: true,
        customer: { select: { name: true, email: true } },
        chef: { select: { name: true, email: true, chefProfile: { select: { displayName: true } } } },
      } });
      if (mail) await notifyBooking(input.action === "propose" ? "rescheduled" : "proposalAccepted", {
        ...mail, eventDate: mail.proposedEventDate ?? mail.eventDate,
      });
    } catch {
      console.error("Booking time email could not be prepared.");
    }
  }
  return NextResponse.json({ booking: serializeBooking(result.booking, userId) });
}
