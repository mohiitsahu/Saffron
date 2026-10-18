// Shared rules for chef photos.

// The browser shrinks photos to well under this. The server still enforces it.
export const MAX_PHOTO_BYTES = 1_000_000;

export const PHOTO_URL_PREFIX = "/api/photos/";

export function photoUrlFor(photoId: string) {
  return `${PHOTO_URL_PREFIX}${photoId}`;
}

// Returns the photo id if the URL points at one of our own stored photos.
export function photoIdFromUrl(url: string): string | null {
  const match = /^\/api\/photos\/([A-Za-z0-9]{10,40})$/.exec(url);
  return match ? match[1] : null;
}

// Looks at the file's first bytes instead of trusting the browser's claim about its type.
// SVG and other formats are not accepted, because they can carry scripts.
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}
