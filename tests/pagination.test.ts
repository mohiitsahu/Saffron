import { describe, expect, it } from "vitest";
import { chefPageUrl, paginate } from "@/lib/pagination";

describe("chef search pagination", () => {
  const chefs = Array.from({ length: 205 }, (_, id) => ({ id }));
  it("makes every matching chef reachable, including results past the old limits", () => {
    const seen = [];
    for (let page = 1; page <= 18; page++) seen.push(...paginate(chefs, String(page)).items);
    expect(seen).toEqual(chefs);
    expect(paginate(chefs, "18").items.at(-1)).toEqual({ id: 204 });
  });
  it.each(["", "-1", "1.5", "NaN", "Infinity", "99999999999999999999"])("handles malformed page input: %s", (page) => {
    expect(paginate(chefs, page).page).toBe(1);
  });
  it("clamps stale links after results shrink and handles empty results", () => {
    expect(paginate(chefs.slice(0, 14), "18").page).toBe(2);
    expect(paginate([], "3")).toMatchObject({ page: 1, pageCount: 1, items: [] });
  });
  it("preserves filters and anchors pagination at the results", () => {
    const link = chefPageUrl({ city: "New Delhi", q: "dal & rice", date: "2026-11-02", time: "19:00", guests: "4", sort: "rating", page: "4" }, 2);
    const url = new URL(link, "https://example.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({ city: "New Delhi", q: "dal & rice", date: "2026-11-02", time: "19:00", guests: "4", sort: "rating", page: "2" });
    expect(url.hash).toBe("#chef-results");
    expect(chefPageUrl({ city: "", page: "4" }, 1)).toBe("/chefs#chef-results");
  });
});
