import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ChefsHeader from "@/components/ChefsHeader";
import ChefListCard from "@/components/ChefListCard";
import { CheckCircleIcon } from "@/components/Icons";
import { chefListSelect, getChefCities, getRatingMap } from "@/lib/chefs";
import { cityVariants, findCity } from "@/lib/cities";

export const dynamic = "force-dynamic";

const SORTS = ["recommended", "price_asc", "price_desc", "rating", "experience"] as const;
type Sort = (typeof SORTS)[number];

type SearchParams = {
  q?: string | string[];
  city?: string | string[];
  sort?: string | string[];
  maxPrice?: string | string[];
  verified?: string | string[];
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

  const where: Prisma.ChefProfileWhereInput = { active: true };
  if (city) {
    where.OR = cityVariants(city).map(
      (name): Prisma.ChefProfileWhereInput => ({ city: { contains: name, mode: "insensitive" } })
    );
  }
  if (maxPrice) where.pricePerPerson = { lte: maxPrice };
  if (verifiedOnly) where.verified = true;

  const [rows, chefCities] = await Promise.all([
    prisma.chefProfile.findMany({
      where,
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: chefListSelect,
    }),
    getChefCities(),
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

  const ratings = await getRatingMap(matched.map((c) => c.userId));
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <ChefsHeader
        initial={{ q, city, sort, maxPrice: maxPrice ? String(maxPrice) : "", verified: verifiedOnly }}
        chefCities={chefCities}
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
        <div className="mt-6 rounded-xl border-2 border-dashed border-leaf/50 p-6">
          <h2 className="text-lg font-bold">No chefs match yet</h2>
          <p className="mt-1 text-ink/80">
            Try a different city or cuisine, or raise the maximum price.{" "}
            <Link href="/chefs" className="font-medium text-leaf underline underline-offset-4">
              Clear search
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {visible.map((chef) => (
            <ChefListCard
              key={chef.id}
              chef={chef}
              avg={ratings.get(chef.userId)?.avg ?? null}
              count={countOf(chef.userId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}