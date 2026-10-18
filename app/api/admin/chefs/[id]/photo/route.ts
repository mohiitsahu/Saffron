import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Admin: remove a chef's photo (for example, if it is inappropriate).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const profile = await prisma.chefProfile.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Chef not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.chefPhoto.deleteMany({ where: { userId: profile.userId } }),
    prisma.chefProfile.update({ where: { id: params.id }, data: { photoUrl: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
