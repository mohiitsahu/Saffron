import { prisma } from "@/lib/prisma";

// Public on purpose: chef photos are shown to everyone.
//
// Caching: each upload gets a new id, so a photo at a given URL never changes. Browsers and
// the CDN keep it for a day, which saves a database read on almost every view. It is a day
// rather than a year so that a photo an admin removes stops loading from the direct link soon
// after. (Pages stop showing it straight away, because they no longer point to it.)
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const etag = `"${params.id}"`;

  // The browser already has this photo: just confirm it still exists. No image bytes are read.
  if (req.headers.get("if-none-match") === etag) {
    const exists = await prisma.chefPhoto.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!exists) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE_CONTROL } });
  }

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
      ETag: etag,
      "Cache-Control": CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
