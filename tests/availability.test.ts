import { describe, expect, it } from "vitest";
import {
  MAX_RANGE_DAYS,
  dayEndIST,
  dayStartIST,
  expandRange,
  isRealDay,
  istDayKey,
  todayIST,
} from "@/lib/availability";

// 15 June 2030, 12:00 in India.
const NOW = new Date("2030-06-15T06:30:00Z");

describe("istDayKey", () => {
  it("uses the Indian calendar day, not the UTC one", () => {
    expect(istDayKey(new Date("2030-11-02T19:00:00Z"))).toBe("2030-11-03"); // 00:30 IST next day
    expect(istDayKey(new Date("2030-11-02T18:29:59Z"))).toBe("2030-11-02"); // 23:59:59 IST
    expect(istDayKey(new Date("2030-11-02T18:30:00Z"))).toBe("2030-11-03"); // midnight IST
  });

  it("agrees with how booking dates are read (19:30 IST is the same IST day)", () => {
    expect(istDayKey(new Date("2030-11-02T19:30:00+05:30"))).toBe("2030-11-02");
    expect(istDayKey(new Date("2030-11-02T00:30:00+05:30"))).toBe("2030-11-02");
  });

  it("todayIST follows the same rule", () => {
    expect(todayIST(NOW)).toBe("2030-06-15");
  });
});

describe("isRealDay", () => {
  it("accepts real days, including a leap day", () => {
    expect(isRealDay("2030-06-15")).toBe(true);
    expect(isRealDay("2032-02-29")).toBe(true);
  });
  it.each(["2030-02-30", "2031-02-29", "2030-13-01", "2030-00-10", "2030-06-00", "1999-01-01", "tomorrow", "", "2030-6-5"])(
    "rejects %j",
    (value) => {
      expect(isRealDay(value)).toBe(false);
    }
  );
});

describe("dayStartIST / dayEndIST", () => {
  it("span exactly one Indian day", () => {
    expect(dayStartIST("2030-11-02").toISOString()).toBe("2030-11-01T18:30:00.000Z");
    expect(dayEndIST("2030-11-02").toISOString()).toBe("2030-11-02T18:29:59.999Z");
  });
});

describe("expandRange", () => {
  it("returns a single day when there is no end date", () => {
    expect(expandRange("2030-06-20", undefined, NOW)).toEqual({ ok: true, days: ["2030-06-20"] });
    expect(expandRange("2030-06-20", "", NOW)).toEqual({ ok: true, days: ["2030-06-20"] });
  });

  it("lists every day in a range, across a month end", () => {
    expect(expandRange("2030-06-29", "2030-07-02", NOW)).toEqual({
      ok: true,
      days: ["2030-06-29", "2030-06-30", "2030-07-01", "2030-07-02"],
    });
  });

  it("handles a leap day and a year end", () => {
    expect(expandRange("2030-12-30", "2031-01-01", NOW)).toEqual({
      ok: true,
      days: ["2030-12-30", "2030-12-31", "2031-01-01"],
    });
  });

  it("allows today but not days that have passed", () => {
    expect(expandRange("2030-06-15", undefined, NOW).ok).toBe(true);
    expect(expandRange("2030-06-14", undefined, NOW)).toEqual({
      ok: false,
      error: "You can't block a day that has already passed.",
    });
  });

  it("rejects fake dates and backwards ranges", () => {
    expect(expandRange("2030-02-30", undefined, NOW).ok).toBe(false);
    expect(expandRange("2030-06-20", "2030-06-18", NOW)).toEqual({
      ok: false,
      error: "The last day must be on or after the first day.",
    });
  });

  it("limits how far ahead and how many days at once", () => {
    expect(expandRange("2032-01-01", undefined, NOW).ok).toBe(false);
    const tooMany = expandRange("2030-07-01", "2030-12-31", NOW);
    expect(tooMany.ok).toBe(false);
    expect(expandRange("2030-07-01", "2030-09-28", NOW).ok).toBe(true); // exactly 90 days
    expect(MAX_RANGE_DAYS).toBe(90);
  });
});
