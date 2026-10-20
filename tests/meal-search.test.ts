import { describe, expect, it } from "vitest";
import { mealSearchLabel, validateMealSearch } from "@/lib/mealSearch";

const now = Date.parse("2030-06-01T12:00:00Z");
const base = { date: "2030-06-03", time: "19:30", guests: "4" };
describe("meal search details", () => {
  it("allows browsing without details or with only a guest count", () => {
    expect(validateMealSearch({ date: "", time: "", guests: "" }, now).error).toBe("");
    expect(validateMealSearch({ date: "", time: "", guests: "4" }, now).error).toBe("");
  });
  it("requires a date when a time is chosen", () => {
    expect(validateMealSearch({ ...base, date: "" }, now).error).toContain("date as well");
  });
  it.each(["0", "101", "1.5", "invalid"])("rejects invalid guest count %s", (guests) => {
    expect(validateMealSearch({ ...base, guests }, now).error).toContain("1 to 100");
  });
  it("checks real calendar dates and time ranges", () => {
    expect(validateMealSearch({ ...base, date: "2030-06-31" }, now).error).toContain("valid date");
    expect(validateMealSearch({ ...base, time: "24:00" }, now).error).toContain("valid time");
  });
  it("applies 24-hour notice in Indian time", () => {
    expect(validateMealSearch({ ...base, date: "2030-06-02", time: "17:29" }, now).error).toContain("24 hours");
    const result = validateMealSearch({ ...base, date: "2030-06-02", time: "17:30" }, now);
    expect(result.error).toBe("");
    expect(result.date?.toISOString()).toBe("2030-06-02T12:00:00.000Z");
  });
  it("formats an applied chip with exact IST time and singular/plural guests", () => {
    expect(mealSearchLabel(base)).toBe("3 Jun · 7:30 pm IST · 4 guests");
    expect(mealSearchLabel({ date: "", time: "", guests: "1" })).toBe("1 guest");
    expect(mealSearchLabel({ date: "", time: "00:00", guests: "" })).toBe("12:00 am IST");
  });
});
