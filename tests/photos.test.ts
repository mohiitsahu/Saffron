import { describe, expect, it } from "vitest";
import { photoIdFromUrl, photoUrlFor, sniffImageType } from "@/lib/photos";

const bytes = (...values: number[]) => Uint8Array.from(values);

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP from their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(
      sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))
    ).toBe("image/webp");
  });

  it("rejects SVG, HTML, GIF and other files", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    expect(sniffImageType(text("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(sniffImageType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(text("GIF89a......"))).toBeNull();
  });

  it("rejects empty and tiny files without crashing", () => {
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });

  it("does not accept a RIFF file that is not WebP (for example WAV)", () => {
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBeNull();
  });
});

describe("photo URLs", () => {
  it("round-trips an id", () => {
    expect(photoIdFromUrl(photoUrlFor("cm3abcdef1234"))).toBe("cm3abcdef1234");
  });

  it("only accepts our own photo path", () => {
    expect(photoIdFromUrl("https://evil.example/api/photos/abcdefghij")).toBeNull();
    expect(photoIdFromUrl("/api/photos/../secret")).toBeNull();
    expect(photoIdFromUrl("/api/photos/abc")).toBeNull(); // too short to be an id
    expect(photoIdFromUrl("/api/photos/abcdefghij/extra")).toBeNull();
    expect(photoIdFromUrl("")).toBeNull();
  });
});
