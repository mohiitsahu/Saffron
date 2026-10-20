import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const cache = "private, no-cache, max-age=0, must-revalidate";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const photo = await prisma.mealPhoto.findUnique({ where: { id: params.id }, select: { id: true, contentType: true, chef: { select: { userId: true, active: true, suspended: true } } } });
  const missing = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!photo) return missing();
  if (!photo.chef.active || photo.chef.suspended) {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.id !== photo.chef.userId && session.user.role !== "ADMIN")) return missing();
  }
  const headers = { ETag: `"${photo.id}"`, "Cache-Control": cache, "Content-Type": photo.contentType,
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
  if (req.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
  const stored = await prisma.mealPhoto.findUnique({ where: { id: photo.id }, select: { data: true } });
  if (!stored) return missing();
  const bytes = new Uint8Array(stored.data);
  return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
