import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountSchema } from "@/lib/account";
import { fieldErrors } from "@/lib/validation";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to edit your account." }, { status: 401 });
  const parsed = accountSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your account details.", fieldErrors: fieldErrors(parsed.error.issues) }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const userId = session.user.id;
    // Shares the chef-profile lock so phone edits cannot race with profile updates.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    if (!parsed.data.phone && await tx.chefProfile.findUnique({ where: { userId }, select: { id: true } })) return false;
    await tx.user.update({ where: { id: userId }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
    return true;
  });
  if (!result) return NextResponse.json({ error: "Keep a phone number so customers can contact you after acceptance.", fieldErrors: { phone: "A phone number is required for a chef profile." } }, { status: 400 });
  return NextResponse.json({ ok: true });
}
