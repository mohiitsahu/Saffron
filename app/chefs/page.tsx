import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ChefsHeader from "@/components/ChefsHeader";
import ChefListCard from "@/components/ChefListCard";
import { CheckCircleIcon } from "@/components/Icons";
import {
  chefListSelect,
  getChefCities,
  getChefCuisines,
  getCompletedMap,
  getRatingMap,
} from "@/lib/chefs";
import { cityVariants, findCity } from "@/lib/cities";
import { outlineButton } from "@/lib/ui";

export const dynamic = "force-dynamic";

const SORTS = ["recommended", "price_asc", "price_desc", "rating", "experience"] as const;
type Sort = (typeof SORTS)[number];

type SearchParams = {
  q?: string | string[];
  city?: string | string[];
  sort?: string | string[];
  maxPrice?: string | string[];
  verified?: string | string[];
  cuisine?: string | string[];
};

function one(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function FindChefPage({ searchParams }: { searchParams: SearchParams }) {
  const q = one(searchParams.q).trim().slice(0, 80);
  const city = one(searchParams.city).trim().slice(0, 60);
  const sortParam = one(searchParams.sort);
  const sort: Sort = (SORTS as readonly string[]).includes(sortParam) ? (sortParam as Sort) : "recommended";
  const maxPriceRaw = Number(one(searchParams.maxPrice));
  const maxPrice = Number.isInteger(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : null;
  const verifiedOnly = one(searchParams.verified) === "1";
  const cuisineFilter = one(searchParams.cuisine)
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  const where: Prisma.ChefProfileWhereInput = { active: true };
  if (city) {
    where.OR = cityVariants(city).map(
      (name): Prisma.ChefProfileWhereInput => ({ city: { contains: name, mode: "insensitive" } })
    );
  }
  if (maxPrice) where.pricePerPerson = { lte: maxPrice };
  if (verifiedOnly) where.verified = true;
  // A chef matches if they cook any of the chosen cuisines.
  if (cuisineFilter.length > 0) where.cuisines = { hasSome: cuisineFilter };

  const [rows, chefCities, cuisineOptions] = await Promise.all([
    prisma.chefProfile.findMany({
      where,
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: chefListSelect,
    }),
    getChefCities(),
    getChefCuisines(),
  ]);

  // Search by chef name, cuisine, dish or bio. Every word typed must match somewhere.
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = tokens.length
    ? rows.filter((chef) => {
        const haystack = [chef.displayName, chef.cuisines.join(" "), chef.sampleMenu, chef.bio, chef.city]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
    : rows;

  const matchedIds = matched.map((c) => c.userId);
  const [ratings, completed] = await Promise.all([getRatingMap(matchedIds), getCompletedMap(matchedIds)]);
  const avgOf = (userId: string) => ratings.get(userId)?.avg ?? 0;
  const countOf = (userId: string) => ratings.get(userId)?.count ?? 0;

  // Array.sort is stable, so ties keep the database order: verified first, then newest.
  const sorted = [...matched].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.pricePerPerson - b.pricePerPerson;
      case "price_desc":
        return b.pricePerPerson - a.pricePerPerson;
      case "rating":
        return avgOf(b.userId) - avgOf(a.userId) || countOf(b.userId) - countOf(a.userId);
      case "experience":
        return b.yearsExperience - a.yearsExperience;
      default:
        return Number(b.verified) - Number(a.verified) || avgOf(b.userId) - avgOf(a.userId);
    }
  });

  const visible = sorted.slice(0, 40);
  const title = city ? `The chefs of ${findCity(city)?.name ?? city}` : "Chefs on Saffron";

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8">
      <ChefsHeader
        initial={{
          q,
          city,
          sort,
          maxPrice: maxPrice ? String(maxPrice) : "",
          verified: verifiedOnly,
          cuisine: cuisineFilter.join(","),
        }}
        chefCities={chefCities}
        cuisineOptions={cuisineOptions}
        title={title}
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-b border-leaf/20 pb-4 text-sm">
        <p>
          <span className="font-bold">
            {sorted.length} {sorted.length === 1 ? "chef" : "chefs"}
          </span>{" "}
          <span className="text-ink/70">ready to cook for you</span>
        </p>
        <p className="flex items-center gap-1.5 text-ink/70">
          <CheckCircleIcon className="h-4 w-4 text-leaf" />
          Verified chefs are listed first
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-leaf/50 bg-sage/70 p-8 text-center">
          <h2 className="text-xl font-bold">No chefs match yet</h2>
          <p className="mx-auto mt-2 max-w-md text-ink/80">
            Try a different city or cuisine, or raise the maximum price. Know a great home chef? Invite
            them to join Saffron.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/chefs" className={outlineButton}>
              Clear search
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {visible.map((chef) => (
            <div
              key={chef.id}
              className={`h-full [&>a]:h-full ${visible.length === 1 ? "xl:col-span-2" : ""}`}
            >
              <ChefListCard
                chef={chef}
                avg={ratings.get(chef.userId)?.avg ?? null}
                count={countOf(chef.userId)}
                completed={completed.get(chef.userId) ?? 0}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}