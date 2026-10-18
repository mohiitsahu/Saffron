import { prisma } from "@/lib/prisma";
import { findCity, type CityOption } from "@/lib/cities";
import type { CuisineOption } from "@/lib/cuisines";

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

// Completed bookings per chef, keyed by the chef's User id. Shown as social proof.
export async function getCompletedMap(userIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;

  const rows = await prisma.booking.groupBy({
    by: ["chefId"],
    where: { chefId: { in: userIds }, status: "COMPLETED" },
    _count: { _all: true },
  });

  for (const row of rows) {
    result.set(row.chefId, row._count._all);
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

// Cuisines that active chefs actually cook, with counts. Used for the cuisine filter.
export async function getChefCuisines(): Promise<CuisineOption[]> {
  const rows = await prisma.chefProfile.findMany({
    where: { active: true },
    select: { cuisines: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const cuisine of Array.from(new Set(row.cuisines))) {
      counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}