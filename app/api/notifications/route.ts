import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationCopy, notificationScope } from "@/lib/notifications";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to see notifications." }, { status: 401, headers });
  const userId = session.user.id;
  const through = new Date();
  const scope = { ...notificationScope(userId), createdAt: { lte: through } };
  if (new URL(req.url).searchParams.get("summary") === "1") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationsReadAt: true } });
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 401, headers });
    // The dot only needs existence, not 30 joined bookings and an exact count.
    const unread = await prisma.bookingEvent.findFirst({ where: { ...scope,
      createdAt: { lte: through, ...(user.notificationsReadAt ? { gt: user.notificationsReadAt } : {}) },
    }, select: { id: true } });
    return NextResponse.json({ hasUnread: Boolean(unread) }, { headers });
  }
  const data = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { notificationsReadAt: true } });
    if (!user) return null;
    const [events, unread] = await Promise.all([
      tx.bookingEvent.findMany({ where: scope, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30,
        select: { id: true, kind: true, toStatus: true, createdAt: true, booking: { select: {
          id: true, customerId: true, customer: { select: { name: true } },
          chef: { select: { name: true, chefProfile: { select: { displayName: true } } } },
        } } } }),
      tx.bookingEvent.count({ where: { ...scope, createdAt: { lte: through, ...(user.notificationsReadAt ? { gt: user.notificationsReadAt } : {}) } } }),
    ]);
    return { events, unread, readAt: user.notificationsReadAt };
  }, { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 15_000 });
  if (!data) return NextResponse.json({ error: "Account not found." }, { status: 401, headers });
  const items = data.events.map((event) => {
    const customer = event.booking.customerId === userId;
    const name = customer ? event.booking.chef.chefProfile?.displayName ?? event.booking.chef.name ?? "Your chef" : event.booking.customer.name ?? "Your customer";
    return { id: event.id, ...notificationCopy(event.kind, event.toStatus, name), createdAt: event.createdAt.toISOString(), unread: !data.readAt || event.createdAt > data.readAt,
      href: `/bookings?tab=${customer ? "mine" : "requests"}&booking=${encodeURIComponent(event.booking.id)}` };
  });
  return NextResponse.json({ items, unread: data.unread, through: through.toISOString() }, { headers });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers });
  const body = await req.json().catch(() => null);
  const through = typeof body?.through === "string" ? new Date(body.through) : null;
  if (!through || !Number.isFinite(through.getTime()) || through.getTime() > Date.now()) {
    return NextResponse.json({ error: "Refresh notifications before marking them read." }, { status: 400, headers });
  }
  // Never move the read boundary backward, including across tabs/devices.
  await prisma.user.updateMany({ where: { id: session.user.id, OR: [{ notificationsReadAt: null }, { notificationsReadAt: { lt: through } }] }, data: { notificationsReadAt: through } });
  return NextResponse.json({ ok: true }, { headers });
}
