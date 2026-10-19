import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_PHOTO_BYTES, photoUrlFor, sniffImageType } from "@/lib/photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_COOLDOWN_MS = 10_000;
const MAX_FORM_BYTES = MAX_PHOTO_BYTES + 64 * 1024;

// Upload or replace the signed-in user's chef photo. Expects form-data field "file".
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to upload a photo." }, { status: 401 });
  }

  // This fast rejection is defense in depth, not a substitute for an ingress upload limit.
  const rawLength = req.headers.get("content-length");
  if (rawLength !== null) {
    const declaredLength = Number(rawLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      return NextResponse.json({ error: "Invalid request size." }, { status: 400 });
    }
    if (declaredLength > MAX_FORM_BYTES) {
      return NextResponse.json(
        { error: "That photo is too large. Try a smaller one." },
        { status: 413 }
      );
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload. Try again." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "That photo is too large. Try a smaller one." },
      { status: 413 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json({ error: "Upload a JPEG, PNG or WebP photo." }, { status: 415 });
  }

  const userId = session.user.id;
  // Serialize photo changes per user. This prevents parallel uploads from bypassing
  // the cooldown and keeps the photo URL synchronized with the current photo row.
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const previous = await tx.chefPhoto.findUnique({
      where: { userId },
      select: { createdAt: true },
    });
    if (previous && Date.now() - previous.createdAt.getTime() < UPLOAD_COOLDOWN_MS) {
      return { ok: false as const };
    }

    await tx.chefPhoto.deleteMany({ where: { userId } });
    const photo = await tx.chefPhoto.create({
      data: { userId, contentType, data: bytes },
      select: { id: true },
    });
    const url = photoUrlFor(photo.id);
    await tx.chefProfile.updateMany({ where: { userId }, data: { photoUrl: url } });
    return { ok: true as const, url };
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: "Please wait a few seconds before uploading again." },
      { status: 429 }
    );
  }
  return NextResponse.json({ url: outcome.url });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const userId = session.user.id;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    await tx.chefPhoto.deleteMany({ where: { userId } });
    await tx.chefProfile.updateMany({ where: { userId }, data: { photoUrl: null } });
  });

  return NextResponse.json({ ok: true });
}
