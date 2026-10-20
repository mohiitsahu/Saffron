const MAX_SIDE = 1000; // longest edge in pixels
const MAX_BYTES = 900_000; // stay safely under the server's 1 MB limit

// Shrinks a photo in the browser before it is sent: a 6 MB phone photo becomes about 100 KB.
// This also converts everything (PNG, WebP and so on) to JPEG and respects the camera's rotation.
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("We couldn't read that photo. Try a JPEG or PNG.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process photos. Try another browser.");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.85, 0.72, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("That photo is too detailed to shrink. Try a different one.");
}

