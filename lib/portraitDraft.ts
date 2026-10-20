import { MAX_PHOTO_BYTES, sniffImageType } from "@/lib/photos";

export async function readPortraitDraft(req: Request) {
  const limit = MAX_PHOTO_BYTES + 64 * 1024;
  if (!req.body) return { error: "Choose a photo to upload.", status: 400 } as const;
  const reader = req.body.getReader();
  try {
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) { await reader.cancel(); return { error: "That photo is too large.", status: 413 } as const; }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const form = await new Response(bytes.buffer, { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData();
    const profile = form.get("profile"); const file = form.get("file");
    if (typeof profile !== "string" || !file || typeof file === "string" || !file.size) return { error: "Send your profile details and a photo.", status: 400 } as const;
    if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too large.", status: 413 } as const;
    const data = Buffer.from(await file.arrayBuffer()); const contentType = sniffImageType(data);
    if (!contentType) return { error: "Upload a JPEG, PNG or WebP photo.", status: 415 } as const;
    return { body: JSON.parse(profile) as unknown, portrait: { data, contentType } };
  } catch { return { error: "Could not read the photo and profile. Try again.", status: 400 } as const; }
  finally { reader.releaseLock(); }
}
