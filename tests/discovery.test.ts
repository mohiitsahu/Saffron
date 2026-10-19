import { describe, expect, it } from "vitest";
import { discoveryFilter } from "@/lib/discovery";
const now = Date.parse("2030-06-01T00:00:00Z");
describe("availability search", () => {
  it("rejects impossible days and out-of-range guest counts", () => {
    expect(discoveryFilter("2030-02-30", "", "4", now).error).toBeTruthy();
    expect(discoveryFilter("", "", "101", now).error).toBeTruthy();
  });
  it("rejects times without dates, past dates, and insufficient notice", () => {
    expect(discoveryFilter("", "19:00", "", now).error).toBeTruthy();
    expect(discoveryFilter("2030-05-30", "19:00", "", now).error).toBeTruthy();
    expect(discoveryFilter("2030-06-01", "19:00", "", now).error).toBeTruthy();
  });
  it("limits guest count and never includes suspended chefs", () => {
    expect(discoveryFilter("", "", "8", now)).toEqual({ where: { active: true, suspended: false, maxGuests: { gte: 8 } }, error: "" });
  });
  it("checks the IST day and a strict four-hour clash window", () => {
    const result = discoveryFilter("2030-06-03", "00:30", "4", now);
    expect(result.error).toBe("");
    expect(result.where.user).toMatchObject({ blockedDays: { none: { day: "2030-06-03" } }, chefBookings: { none: { status: "ACCEPTED", eventDate: {
      gt: new Date("2030-06-02T15:00:00Z"), lt: new Date("2030-06-02T23:00:00Z"),
    } } } });
  });
});
