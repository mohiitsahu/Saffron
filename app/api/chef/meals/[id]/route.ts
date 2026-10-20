import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mealPhotoOrder, mealPhotoSelect } from "@/lib/meals";

import { mealDetailsSchema } from "@/lib/mealValidation";

async function change(req: Request, id: string, remove: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to manage meal photos." }, { status: 401 });
  const parsed = remove ? null : mealDetailsSchema.safeParse(await req.json().catch(() => null));
  if (parsed && !parsed.success) return NextResponse.json({ error: "Keep dish names within 80 characters and captions within 280 characters." }, { status: 400 });
  const userId = session.user.id;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const profile = await tx.chefProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return { error: "Create your chef profile first.", status: 403 };
    const where = { id, chefId: profile.id };
    const changed = remove ? await tx.mealPhoto.deleteMany({ where }) : await tx.mealPhoto.updateMany({ where, data: parsed?.success ? parsed.data : {} });
    if (!changed.count) return { error: "Meal photo not found.", status: 404 };
    return { photos: await tx.mealPhoto.findMany({ where: { chefId: profile.id }, orderBy: [...mealPhotoOrder], select: mealPhotoSelect }) };
  });
  return NextResponse.json(result, { status: "error" in result ? result.status : 200 });
}
export function PATCH(req: Request, { params }: { params: { id: string } }) { return change(req, params.id, false); }
export function DELETE(req: Request, { params }: { params: { id: string } }) { return change(req, params.id, true); }
