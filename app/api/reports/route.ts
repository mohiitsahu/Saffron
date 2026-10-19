import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const schema = z.object({ targetType: z.enum(["chef", "booking"]), targetId: z.string().min(1),
  reason: z.enum(["profile", "no_show", "conduct", "other"]), details: z.string().trim().min(10).max(1500) });
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to report a problem." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a reason and describe what happened (10–1500 characters)." }, { status: 400 });
  const { targetType, targetId, reason, details } = parsed.data;
  const userId = session.user.id;
  if (targetType === "booking") {
    const booking = await prisma.booking.findUnique({ where: { id: targetId }, select: { customerId: true, chefId: true } });
    if (!booking || ![booking.customerId, booking.chefId].includes(userId)) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  } else {
    const chef = await prisma.chefProfile.findUnique({ where: { id: targetId }, select: { active: true, suspended: true, userId: true } });
    if (!chef?.active || chef.suspended || chef.userId === userId) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  // Serialize reports per person to enforce the daily abuse limit as well as deduplication.
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const target = targetType === "booking" ? { bookingId: targetId } : { chefProfileId: targetId };
    if (await tx.report.findFirst({ where: { reporterId: userId, ...target } })) return { status: 409, error: "You already reported this. An administrator can review it." };
    if (await tx.report.count({ where: { reporterId: userId, createdAt: { gt: new Date(Date.now() - 86_400_000) } } }) >= 5) return { status: 429, error: "You have submitted several reports today. Please try again tomorrow." };
    await tx.report.create({ data: { reporterId: userId, reason, details, ...target } });
    return { status: 201, error: null };
  });
  return NextResponse.json(result.error ? { error: result.error } : { ok: true }, { status: result.status });
}
