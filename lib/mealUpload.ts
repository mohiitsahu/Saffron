import { MAX_PHOTO_BYTES, sniffImageType } from "@/lib/photos";
import { mealDetailsSchema } from "@/lib/mealValidation";

const MAX_FORM_BYTES = MAX_PHOTO_BYTES + 64 * 1024;
export async function readMealUpload(req: Request) {
  const declared = req.headers.get("content-length");
  if (declared !== null && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0)) return { error: "Invalid upload size.", status: 400 } as const;
  if (declared !== null && Number(declared) > MAX_FORM_BYTES) return { error: "That photo is too large. Choose a smaller image.", status: 413 } as const;
  if (!req.body) return { error: "Choose a meal photo.", status: 400 } as const;
  // Enforce the limit while reading, including chunked requests without Content-Length.
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_FORM_BYTES) { await reader.cancel(); return { error: "That photo is too large. Choose a smaller image.", status: 413 } as const; }
      chunks.push(part.value);
    }
    const body = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const form = await new Response(body.buffer, { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || !file.size) return { error: "Choose a meal photo.", status: 400 } as const;
    if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Choose a smaller image.", status: 413 } as const;
    const data = Buffer.from(await file.arrayBuffer()); const contentType = sniffImageType(data);
    if (!contentType) return { error: "Use a JPEG, PNG or WebP photo.", status: 415 } as const;
    const details = mealDetailsSchema.safeParse({ dishName: form.get("dishName") ?? "", caption: form.get("caption") ?? "" });
    if (!details.success) return { error: "Keep dish names within 80 characters and captions within 280 characters.", status: 400 } as const;
    return { data, contentType, ...details.data };
  } catch { return { error: "Could not read the upload. Please try again.", status: 400 } as const; }
  finally { reader.releaseLock(); }
}
