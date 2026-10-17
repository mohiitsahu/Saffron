import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { countPendingRequests } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const pendingRequests = session?.user ? await countPendingRequests(session.user.id) : 0;
  return NextResponse.json({ pendingRequests }, { headers: { "Cache-Control": "no-store" } });
}