import { describe, expect, it } from "vitest";
import { bookingCreateSchema, chefProfileSchema } from "@/lib/validation";

const booking = {
  chefProfileId: "chef1",
  eventDate: "2030-11-02T19:30",
  guests: 4,
  area: "Arera Colony",
  address: "12 Example Street, Bhopal",
  phone: "9876543210",
  notes: "",
};

const firstMessage = (input: unknown) => {
  const result = bookingCreateSchema.safeParse(input);
  return result.success ? null : result.error.issues[0].message;
};

describe("bookingCreateSchema: event date", () => {
  it("reads the date as Indian Standard Time", () => {
    const result = bookingCreateSchema.parse(booking);
    expect(result.eventDate.toISOString()).toBe("2030-11-02T14:00:00.000Z"); // 19:30 IST = 14:00 UTC
  });

  it("accepts a real leap day", () => {
    expect(bookingCreateSchema.safeParse({ ...booking, eventDate: "2032-02-29T12:00" }).success).toBe(true);
  });

  it.each([
    ["30 February", "2030-02-30T19:00"],
    ["31 April", "2030-04-31T19:00"],
    ["29 February in a non-leap year", "2031-02-29T19:00"],
    ["hour 24", "2030-11-02T24:00"],
    ["minute 60", "2030-11-02T10:60"],
    ["month 13", "2030-13-02T10:00"],
    ["day 0", "2030-11-00T10:00"],
    ["a year before 2000", "1999-11-02T10:00"],
  ])("rejects %s instead of quietly moving it to another day", (_label, value) => {
    expect(firstMessage({ ...booking, eventDate: value })).toMatch(/doesn't exist/);
  });

  it("rejects text that is not a date and time", () => {
    expect(firstMessage({ ...booking, eventDate: "tomorrow" })).toBe("Choose a date and time.");
    expect(firstMessage({ ...booking, eventDate: "" })).toBe("Choose a date and time.");
  });
});

describe("bookingCreateSchema: other fields", () => {
  it("normalises Indian phone numbers", () => {
    for (const phone of ["9876543210", "+91 98765 43210", "91-9876543210", "09876543210"]) {
      expect(bookingCreateSchema.parse({ ...booking, phone }).phone).toBe("9876543210");
    }
  });

  it.each(["12345", "5876543210", "98765432101", "abcdefghij", ""])("rejects phone %j", (phone) => {
    expect(firstMessage({ ...booking, phone })).toMatch(/10-digit Indian mobile/);
  });

  it("limits guests to 1-100 whole numbers", () => {
    expect(bookingCreateSchema.safeParse({ ...booking, guests: 1 }).success).toBe(true);
    expect(bookingCreateSchema.safeParse({ ...booking, guests: 100 }).success).toBe(true);
    expect(bookingCreateSchema.safeParse({ ...booking, guests: 0 }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...booking, guests: 101 }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...booking, guests: 2.5 }).success).toBe(false);
  });

  it("requires a real address and area", () => {
    expect(bookingCreateSchema.safeParse({ ...booking, address: "short" }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...booking, area: "A" }).success).toBe(false);
  });
});

const chef = {
  displayName: "Asha Verma",
  bio: "I cook home-style North Indian food for families and small parties.",
  city: "Bhopal",
  cuisines: ["North Indian", "  MUGHLAI ", "north indian"],
  pricePerPerson: 500,
  maxGuests: 12,
  yearsExperience: 5,
  phone: "9876543210",
};

describe("chefProfileSchema", () => {
  it("lowercases and de-duplicates cuisines", () => {
    expect(chefProfileSchema.parse(chef).cuisines).toEqual(["north indian", "mughlai"]);
  });

  it("treats a missing photo as none", () => {
    expect(chefProfileSchema.parse(chef).photoUrl).toBeNull();
    expect(chefProfileSchema.parse({ ...chef, photoUrl: "" }).photoUrl).toBeNull();
  });

  it("accepts our own uploaded photos and older https links", () => {
    expect(chefProfileSchema.parse({ ...chef, photoUrl: "/api/photos/cm3abcdef1234" }).photoUrl).toBe(
      "/api/photos/cm3abcdef1234"
    );
    expect(chefProfileSchema.parse({ ...chef, photoUrl: "https://example.com/a.jpg" }).photoUrl).toBe(
      "https://example.com/a.jpg"
    );
  });

  it.each([
    "http://example.com/a.jpg",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,AAAA",
    "//evil.example/a.jpg",
    "/api/photos/../../secret",
    "/somewhere/else.jpg",
  ])("rejects photo link %j", (photoUrl) => {
    expect(chefProfileSchema.safeParse({ ...chef, photoUrl }).success).toBe(false);
  });

  it("does not let a chef set their own verified badge", () => {
    const parsed = chefProfileSchema.parse({ ...chef, verified: true, role: "ADMIN" });
    expect(parsed).not.toHaveProperty("verified");
    expect(parsed).not.toHaveProperty("role");
  });

  it("enforces price and guest limits", () => {
    expect(chefProfileSchema.safeParse({ ...chef, pricePerPerson: 49 }).success).toBe(false);
    expect(chefProfileSchema.safeParse({ ...chef, pricePerPerson: 20001 }).success).toBe(false);
    expect(chefProfileSchema.safeParse({ ...chef, maxGuests: 0 }).success).toBe(false);
    expect(chefProfileSchema.safeParse({ ...chef, maxGuests: 101 }).success).toBe(false);
  });
});
