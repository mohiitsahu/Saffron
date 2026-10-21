import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationCopy, notificationScope } from "@/lib/notifications";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const readSchema = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(30) });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to see notifications." }, { status: 401, headers });
  const userId = session.user.id;
  const scope = notificationScope(userId);
  const unreadScope = { ...scope, reads: { none: { userId } } };
  if (new URL(req.url).searchParams.get("summary") === "1") {
    const unread = await prisma.bookingEvent.findFirst({ where: unreadScope, select: { id: true } });
    return NextResponse.json({ hasUnread: Boolean(unread) }, { headers });
  }
  const select = {
    id: true, actorId: true, kind: true, toStatus: true, createdAt: true,
    reads: { where: { userId }, select: { userId: true } },
    booking: { select: { id: true, customerId: true, customer: { select: { name: true } },
      chef: { select: { name: true, chefProfile: { select: { displayName: true } } } } } },
  } as const;
  const [newEvents, oldEvents, unread] = await prisma.$transaction([
    // Unread first keeps older unread updates reachable beyond the 30-item window.
    prisma.bookingEvent.findMany({ where: unreadScope, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30, select }),
    prisma.bookingEvent.findMany({ where: { ...scope, reads: { some: { userId } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30, select }),
    prisma.bookingEvent.count({ where: unreadScope }),
  ], { isolationLevel: "RepeatableRead" });
  const items = [...newEvents, ...oldEvents].slice(0, 30).map((event) => {
    const customer = event.booking.customerId === userId;
    const name = customer ? event.booking.chef.chefProfile?.displayName ?? event.booking.chef.name ?? "Your chef" : event.booking.customer.name ?? "Your customer";
    return { id: event.id, ...notificationCopy(event.kind, event.toStatus, name, { customer, system: event.actorId === null }),
      createdAt: event.createdAt.toISOString(), unread: event.reads.length === 0,
      href: `/bookings?tab=${customer ? "mine" : "requests"}&booking=${encodeURIComponent(event.booking.id)}` };
  });
  return NextResponse.json({ items, unread }, { headers });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers });
  const parsed = readSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Refresh notifications before marking them read." }, { status: 400, headers });
  const userId = session.user.id;
  const events = await prisma.bookingEvent.findMany({ where: { ...notificationScope(userId), id: { in: parsed.data.ids } }, select: { id: true } });
  // Acknowledge only explicit, authorised IDs; a late commit cannot fall under a time cutoff.
  await prisma.notificationRead.createMany({ data: events.map((event) => ({ userId, eventId: event.id })), skipDuplicates: true });
  return NextResponse.json({ ok: true }, { headers });
}
