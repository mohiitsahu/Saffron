import { prisma } from "@/lib/prisma";

// Public on purpose: chef photos are shown to everyone. Each upload gets a new id,
// so a photo at a given URL never changes and browsers can keep it for a long time.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const photo = await prisma.chefPhoto.findUnique({
    where: { id: params.id },
    select: { data: true, contentType: true },
  });

  if (!photo) return new Response("Not found", { status: 404 });

  const bytes = new Uint8Array(photo.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
