import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chefProfileSchema } from "@/lib/validation";
import { photoIdFromUrl } from "@/lib/photos";

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
  try {
    body = await req.json();
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
  if (photoId) {
    const own = await prisma.chefPhoto.findFirst({ where: { id: photoId, userId }, select: { id: true } });
    if (!own) {
      return NextResponse.json(
        {
          error: "Some details need fixing. Check the highlighted fields.",
          fieldErrors: { photoUrl: "That photo isn't yours. Upload your own photo." },
        },
        { status: 400 }
      );
    }
  }

  // One transaction: save the profile, store the phone, and upgrade
  // CUSTOMER to CHEF. ADMIN and existing CHEF roles are left alone.
  const [profile] = await prisma.$transaction([
    prisma.chefProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    }),
    prisma.user.update({ where: { id: userId }, data: { phone } }),
    prisma.user.updateMany({ where: { id: userId, role: "CUSTOMER" }, data: { role: "CHEF" } }),
  ]);

  return NextResponse.json({ profile });
}

export { save as POST, save as PUT };