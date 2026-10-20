import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_MEAL_PHOTOS, mealPhotoOrder, mealPhotoSelect } from "@/lib/meals";
import { readMealUpload } from "@/lib/mealUpload";
import { mealOrderSchema } from "@/lib/mealValidation";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to manage meal photos." }, { status: 401 });
  const profile = await prisma.chefProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Create your chef profile first." }, { status: 403 });
  const photos = await prisma.mealPhoto.findMany({ where: { chefId: profile.id }, orderBy: [...mealPhotoOrder], select: mealPhotoSelect });
  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to upload meal photos." }, { status: 401 });
  const userId = session.user.id;
  if (!await prisma.chefProfile.findUnique({ where: { userId }, select: { id: true } })) return NextResponse.json({ error: "Create your chef profile first." }, { status: 403 });
  const upload = await readMealUpload(req);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: upload.status });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const profile = await tx.chefProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return { error: "Chef profile not found.", status: 404 };
    const existing = await tx.mealPhoto.findMany({ where: { chefId: profile.id }, orderBy: [...mealPhotoOrder], select: mealPhotoSelect });
    if (existing.length >= MAX_MEAL_PHOTOS) return { error: "Your gallery is full. Remove a photo before adding another.", status: 409 };
    // Compact gaps left by removals so new uploads always go at the end.
    for (let position = 0; position < existing.length; position++) if (existing[position].position !== position) await tx.mealPhoto.update({ where: { id: existing[position].id }, data: { position } });
    await tx.mealPhoto.create({ data: { chefId: profile.id, ...upload, position: existing.length } });
    return { photos: await tx.mealPhoto.findMany({ where: { chefId: profile.id }, orderBy: [...mealPhotoOrder], select: mealPhotoSelect }) };
  });
  return NextResponse.json(result, { status: "error" in result ? result.status : 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to reorder meal photos." }, { status: 401 });
  const parsed = mealOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the current gallery photo order." }, { status: 400 });
  const userId = session.user.id;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const profile = await tx.chefProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return { error: "Create your chef profile first.", status: 403 };
    const current = await tx.mealPhoto.findMany({ where: { chefId: profile.id }, select: { id: true } });
    const ids = parsed.data.ids;
    if (new Set(ids).size !== ids.length || ids.length !== current.length || current.some((photo) => !ids.includes(photo.id))) return { error: "Your gallery changed. Reload it before reordering.", status: 409 };
    for (let position = 0; position < ids.length; position++) await tx.mealPhoto.update({ where: { id: ids[position] }, data: { position } });
    return { photos: await tx.mealPhoto.findMany({ where: { chefId: profile.id }, orderBy: [...mealPhotoOrder], select: mealPhotoSelect }) };
  });
  return NextResponse.json(result, { status: "error" in result ? result.status : 200 });
}
