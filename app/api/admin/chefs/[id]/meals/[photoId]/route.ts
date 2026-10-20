import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
export async function DELETE(req: Request, { params }: { params: { id: string; photoId: string } }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const parsed = z.object({ note: z.string().trim().min(5).max(1000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add an admin note (5–1000 characters)." }, { status: 400 });
  const profile = await prisma.chefProfile.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!profile) return NextResponse.json({ error: "Chef not found." }, { status: 404 });
  const removed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.userId}))`;
    const result = await tx.mealPhoto.deleteMany({ where: { id: params.photoId, chefId: params.id } });
    if (!result.count) return false;
    await tx.adminAction.create({ data: { actorId: admin.user.id, targetId: params.id, action: "remove_meal_photo", note: `${parsed.data.note}\nMeal photo: ${params.photoId}` } });
    return true;
  });
  return NextResponse.json(removed ? { ok: true } : { error: "Meal photo not found." }, { status: removed ? 200 : 404 });
}
