import { describe, expect, it } from "vitest";
import { bookingDateLimits } from "@/lib/format";

describe("booking date limits", () => {
  it("uses Indian calendar time across a UTC day boundary", () => {
    expect(bookingDateLimits(Date.parse("2026-10-20T20:00:00Z")).min).toBe("2026-10-22T01:30");
  });

  it("rounds the minimum up so a selectable minute meets the 24 hour rule", () => {
    const now = Date.parse("2026-10-20T18:29:40Z");
    const { min, max } = bookingDateLimits(now);
    expect(min).toBe("2026-10-22T00:00");
    expect(Date.parse(`${min}:00+05:30`) - now).toBeGreaterThanOrEqual(86_400_000);
    expect(Date.parse(`${max}:00+05:30`) - now).toBeLessThanOrEqual(365 * 86_400_000);
  });
});
