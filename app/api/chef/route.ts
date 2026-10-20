import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chefProfileSchema } from "@/lib/validation";
import { photoIdFromUrl, photoUrlFor } from "@/lib/photos";
import { readPortraitDraft } from "@/lib/portraitDraft";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const [profile, user] = await Promise.all([
    prisma.chefProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true } }),
  ]);

  return NextResponse.json({ profile, phone: user?.phone ?? null });
}

async function save(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: unknown;
  let portrait: { data: Buffer; contentType: string } | undefined;
  try {
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const upload = await readPortraitDraft(req);
      if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: upload.status });
      body = upload.body; portrait = upload.portrait;
    } else body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = chefProfileSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: "Some details need fixing. Check the highlighted fields.", fieldErrors },
      { status: 400 }
    );
  }

  const { phone, ...data } = parsed.data;
  const userId = session.user.id;

  // A photo link may only point at a photo this person uploaded themselves.
  const photoId = data.photoUrl ? photoIdFromUrl(data.photoUrl) : null;
  // Ownership, portrait replacement and profile writes share the same lock/transaction.
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    if (photoId && !portrait) {
      const own = await tx.chefPhoto.findFirst({ where: { id: photoId, userId }, select: { id: true } });
      if (!own) {
        return {
          error: "Some details need fixing. Check the highlighted fields.",
          fieldErrors: { photoUrl: "That photo isn't yours. Upload your own photo." },
        };
      }
    }
    if (portrait) {
      await tx.chefPhoto.deleteMany({ where: { userId } });
      const uploaded = await tx.chefPhoto.create({ data: { userId, ...portrait }, select: { id: true } });
      data.photoUrl = photoUrlFor(uploaded.id);
    } else if (!data.photoUrl) {
      await tx.chefPhoto.deleteMany({ where: { userId } });
    }
    const existing = await tx.chefProfile.findUnique({ where: { userId }, select: { suspended: true } });
    const safeData = existing?.suspended ? { ...data, active: false } : data;
    const saved = await tx.chefProfile.upsert({
      where: { userId },
      create: { userId, ...safeData },
      update: safeData,
    });
    await tx.user.update({ where: { id: userId }, data: { phone } });
    await tx.user.updateMany({ where: { id: userId, role: "CUSTOMER" }, data: { role: "CHEF" } });
    return { profile: saved };
  });

  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}

export { save as POST, save as PUT };
