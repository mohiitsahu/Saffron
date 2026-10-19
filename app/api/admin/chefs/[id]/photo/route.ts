import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Admin: remove a chef's photo (for example, if it is inappropriate).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const parsed = z.object({ note: z.string().trim().min(5).max(1000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add an admin note (5–1000 characters)." }, { status: 400 });

  const profile = await prisma.chefProfile.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Chef not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.userId}))`;
    await tx.chefPhoto.deleteMany({ where: { userId: profile.userId } });
    await tx.chefProfile.update({ where: { id: params.id }, data: { photoUrl: null } });
    await tx.adminAction.create({ data: { actorId: admin.user.id, targetId: params.id, action: "remove_photo", note: parsed.data.note } });
  });

  return NextResponse.json({ ok: true });
}
