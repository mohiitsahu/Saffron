import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_BLOCKED_DAYS,
  dayEndIST,
  dayStartIST,
  expandRange,
  isRealDay,
  todayIST,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  from: z.string().trim(),
  to: z.string().trim().optional(),
});
const removeSchema = z.object({ day: z.string().trim() });

// The chef's upcoming days off, soonest first.
async function upcomingDays(userId: string) {
  const rows = await prisma.chefBlockedDay.findMany({
    where: { userId, day: { gte: todayIST() } },
    orderBy: { day: "asc" },
    take: MAX_BLOCKED_DAYS,
    select: { day: true },
  });
  return rows.map((r) => r.day);
}

async function readBody(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json({ days: await upcomingDays(session.user.id) });
}

// Block one day or a range of days.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const userId = session.user.id;

  const parsed = addSchema.safeParse(await readBody(req));
  if (!parsed.success) return NextResponse.json({ error: "Choose a date." }, { status: 400 });

  const profile = await prisma.chefProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Create your chef profile first." }, { status: 403 });
  }

  const range = expandRange(parsed.data.from, parsed.data.to || undefined);
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });

  const existing = await upcomingDays(userId);
  const fresh = range.days.filter((d) => !existing.includes(d));
  if (existing.length + fresh.length > MAX_BLOCKED_DAYS) {
    return NextResponse.json(
      { error: `You can block at most ${MAX_BLOCKED_DAYS} upcoming days. Remove some first.` },
      { status: 400 }
    );
  }

  if (fresh.length > 0) {
    await prisma.chefBlockedDay.createMany({
      data: fresh.map((day) => ({ userId, day })),
      skipDuplicates: true,
    });
  }

  // Bookings the chef has already accepted are not cancelled. Tell the chef about any clash.
  const first = range.days[0];
  const last = range.days[range.days.length - 1];
  const clashes = await prisma.booking.count({
    where: {
      chefId: userId,
      status: "ACCEPTED",
      eventDate: { gte: dayStartIST(first), lte: dayEndIST(last) },
    },
  });

  return NextResponse.json({ days: await upcomingDays(userId), clashes });
}

// Open one day again.
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const userId = session.user.id;

  const parsed = removeSchema.safeParse(await readBody(req));
  if (!parsed.success || !isRealDay(parsed.data.day)) {
    return NextResponse.json({ error: "Choose a day to open." }, { status: 400 });
  }

  await prisma.chefBlockedDay.deleteMany({ where: { userId, day: parsed.data.day } });
  return NextResponse.json({ days: await upcomingDays(userId) });
}
