import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ verified: z.boolean().optional(), active: z.boolean().optional() })
  .refine((v) => v.verified !== undefined || v.active !== undefined, "Nothing to change.");

// Admin: verify / unverify a chef, or hide / show their profile.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const result = await prisma.chefProfile.updateMany({
    where: { id: params.id },
    data: parsed.data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Chef not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
