import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const schema = z.object({ action: z.enum(["resolve", "dismiss", "hide_profile"]), note: z.string().trim().min(5).max(1000) });
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a resolution note (5–1000 characters)." }, { status: 400 });
  const { action, note } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id: params.id }, include: { booking: { select: { chefId: true } }, chefProfile: { select: { userId: true } } } });
    if (!report) return 404;
    if (report.status !== "OPEN") return 409;
    const chefUserId = report.chefProfile?.userId ?? report.booking?.chefId;
    if (action === "hide_profile" && !chefUserId) return 400;
    if (action === "hide_profile" && chefUserId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chefUserId}))`;
    }
    const updated = await tx.report.updateMany({ where: { id: report.id, status: "OPEN" }, data: {
      status: action === "dismiss" ? "DISMISSED" : "RESOLVED", resolutionNote: note, resolvedAt: new Date(), resolvedById: admin.user.id,
    } });
    if (!updated.count) return 409;
    if (action === "hide_profile" && chefUserId) await tx.chefProfile.updateMany({ where: { userId: chefUserId }, data: { suspended: true, active: false } });
    await tx.adminAction.create({ data: { actorId: admin.user.id, targetId: report.id, action: `report_${action}`, note } });
    return 200;
  });
  return NextResponse.json(result === 200 ? { ok: true } : { error: result === 404 ? "Report not found." : result === 400 ? "This request has no chef profile to hide." : "This report was already handled. Refresh the page." }, { status: result });
}
