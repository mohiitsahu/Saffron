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
export const runtime = "nodejs";

const addSchema = z.object({ from: z.string().trim(), to: z.string().trim().optional() });
const removeSchema = z.object({ day: z.string().trim() });

async function upcomingDays(userId: string) {
  const rows = await prisma.chefBlockedDay.findMany({
    where: { userId, day: { gte: todayIST() } },
    orderBy: { day: "asc" },
    take: MAX_BLOCKED_DAYS,
    select: { day: true },
  });
  return rows.map((row) => row.day);
}

async function readBody(req: Request): Promise<unknown> {
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const userId = session.user.id;

  const parsed = addSchema.safeParse(await readBody(req));
  if (!parsed.success) return NextResponse.json({ error: "Choose a date." }, { status: 400 });

  const range = expandRange(parsed.data.from, parsed.data.to || undefined);
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    // Shares the chef lock with booking creation; a block and a booking request
    // can't both pass their availability checks at the same instant.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const profile = await tx.chefProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return { ok: false as const, status: 403, error: "Create your chef profile first." };

    const rows = await tx.chefBlockedDay.findMany({
      where: { userId, day: { gte: todayIST() } },
      select: { day: true },
      take: MAX_BLOCKED_DAYS + 1,
    });
    const existing = new Set(rows.map((row) => row.day));
    const fresh = range.days.filter((day) => !existing.has(day));
    if (existing.size + fresh.length > MAX_BLOCKED_DAYS) {
      return {
        ok: false as const,
        status: 400,
        error: `You can block at most ${MAX_BLOCKED_DAYS} upcoming days. Remove some first.`,
      };
    }

    if (fresh.length) {
      await tx.chefBlockedDay.createMany({
        data: fresh.map((day) => ({ userId, day })),
        skipDuplicates: true,
      });
    }
    // Blocking a day doesn't cancel previously accepted bookings. Warn the chef.
    const clashes = await tx.booking.count({
      where: {
        chefId: userId,
        status: "ACCEPTED",
        eventDate: {
          gte: dayStartIST(range.days[0]),
          lte: dayEndIST(range.days[range.days.length - 1]),
        },
      },
    });
    return { ok: true as const, clashes };
  }, { maxWait: 10_000, timeout: 15_000 });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ days: await upcomingDays(userId), clashes: result.clashes });
}

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
