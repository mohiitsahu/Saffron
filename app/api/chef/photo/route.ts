import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_PHOTO_BYTES, photoUrlFor, sniffImageType } from "@/lib/photos";

export const dynamic = "force-dynamic";

const UPLOAD_COOLDOWN_MS = 10_000;

// Upload (or replace) the signed-in person's photo. Expects multipart form data with a "file" field.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to upload a photo." }, { status: 401 });
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
    return NextResponse.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json({ error: "Upload a JPEG, PNG or WebP photo." }, { status: 415 });
  }

  const userId = session.user.id;

  // A short pause between uploads, so the endpoint can't be hammered.
  const previous = await prisma.chefPhoto.findUnique({ where: { userId }, select: { createdAt: true } });
  if (previous && Date.now() - previous.createdAt.getTime() < UPLOAD_COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait a few seconds before uploading again." }, { status: 429 });
  }

  // One photo per person: the old one is replaced. The new row gets a new id,
  // which changes the URL, so nobody sees a stale cached copy.
  const photo = await prisma.$transaction(async (tx) => {
    await tx.chefPhoto.deleteMany({ where: { userId } });
    return tx.chefPhoto.create({
      data: { userId, contentType, data: bytes },
      select: { id: true },
    });
  });

  const url = photoUrlFor(photo.id);

  // If the chef profile already exists, the new photo goes live straight away.
  await prisma.chefProfile.updateMany({ where: { userId }, data: { photoUrl: url } });

  return NextResponse.json({ url });
}

// Remove the signed-in person's photo.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const userId = session.user.id;
  await prisma.$transaction([
    prisma.chefPhoto.deleteMany({ where: { userId } }),
    prisma.chefProfile.updateMany({ where: { userId }, data: { photoUrl: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
