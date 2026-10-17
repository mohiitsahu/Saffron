import { prisma } from "@/lib/prisma";
import { findCity, type CityOption } from "@/lib/cities";

export const chefCardSelect = {
  id: true,
  userId: true,
  displayName: true,
  city: true,
  cuisines: true,
  pricePerPerson: true,
  maxGuests: true,
  yearsExperience: true,
  photoUrl: true,
  verified: true,
} as const;

export const chefListSelect = {
  ...chefCardSelect,
  bio: true,
  sampleMenu: true,
} as const;

export type RatingSummary = { avg: number | null; count: number };

// Keyed by the chef's User id (Review.chefId).
export async function getRatingMap(userIds: string[]): Promise<Map<string, RatingSummary>> {
  const result = new Map<string, RatingSummary>();
  if (userIds.length === 0) return result;

  const rows = await prisma.review.groupBy({
    by: ["chefId"],
    where: { chefId: { in: userIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });

  for (const row of rows) {
    result.set(row.chefId, { avg: row._avg.rating, count: row._count._all });
  }
  return result;
}

// Cities that have active chefs, with counts. Used for the city suggestions.
export async function getChefCities(): Promise<CityOption[]> {
  const rows = await prisma.chefProfile.groupBy({
    by: ["city"],
    where: { active: true },
    _count: { _all: true },
  });

  const merged = new Map<string, CityOption>();
  for (const row of rows) {
    const name = findCity(row.city)?.name ?? row.city.trim();
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (existing) existing.count += row._count._all;
    else merged.set(key, { name, count: row._count._all });
  }

  return Array.from(merged.values()).sort((a, b) => b.count - a.count);
}