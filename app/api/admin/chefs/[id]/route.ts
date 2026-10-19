import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ verified: z.boolean().optional(), active: z.boolean().optional(), note: z.string().trim().min(5).max(1000) })
  .refine((v) => v.verified !== undefined || v.active !== undefined, "Nothing to change.");

// Admin: verify / unverify a chef, or hide / show their profile.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose an action and add an admin note (5–1000 characters)." }, { status: 400 });
  }

  const profile = await prisma.chefProfile.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!profile) return NextResponse.json({ error: "Chef not found." }, { status: 404 });
  const { note, ...changes } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.userId}))`;
    const updated = await tx.chefProfile.updateMany({
      where: { id: params.id }, data: { ...changes, ...(changes.active !== undefined ? { suspended: !changes.active } : {}) },
    });
    if (updated.count) await tx.adminAction.create({ data: { actorId: admin.user.id, targetId: params.id, action: JSON.stringify(changes), note } });
    return updated;
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Chef not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
