import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_DELETION_REASON, deletionSchema } from "@/lib/account";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to request account deletion." }, { status: 401 });
  if (!deletionSchema.safeParse(await req.json().catch(() => null)).success) {
    return NextResponse.json({ error: "Type DELETE to confirm your request." }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    const userId = session.user.id;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const where = { reporterId: userId, reason: ACCOUNT_DELETION_REASON };
    if (await tx.report.findFirst({ where: { ...where, status: "OPEN" } })) return 409;
    if (await tx.report.count({ where: { ...where, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }) >= 3) return 429;
    // Account requests use the existing administrator queue, with no booking/profile target.
    await tx.report.create({ data: { ...where, details: "The signed-in account owner requested account deletion from Settings. Review active bookings and retained records, then contact the owner before completing deletion." } });
    return 201;
  });
  return NextResponse.json(result === 201 ? { ok: true } : { error: result === 409 ? "Your deletion request is already waiting for review." : "Please wait until tomorrow before submitting another request." }, { status: result });
}
