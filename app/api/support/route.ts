import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ topic: z.enum(["support", "privacy"]), details: z.string().trim().min(10).max(1500) }).strict();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Sign in to contact Saffron." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a topic and write 10–1500 characters." }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const userId = session.user.id;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    if (await tx.report.count({ where: { reporterId: userId, reason: { in: ["support", "privacy"] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }) >= 3) return false;
    await tx.report.create({ data: { reporterId: userId, reason: parsed.data.topic, details: parsed.data.details } });
    return true;
  });
  return NextResponse.json(result ? { ok: true } : { error: "You have sent three messages today. Check your existing replies or try again tomorrow." }, { status: result ? 201 : 429 });
}
