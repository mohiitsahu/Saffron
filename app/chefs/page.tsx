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
import { outlineButton, pageClass } from "@/lib/ui";
import { discoveryFilter } from "@/lib/discovery";
import { chefPageUrl, paginate } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const SORTS = ["recommended", "price_asc", "price_desc", "rating", "experience"] as const;
type Sort = (typeof SORTS)[number];

type SearchParams = {
  page?: string | string[];
  q?: string | string[];
  city?: string | string[];
  sort?: string | string[];
  maxPrice?: string | string[];
  verified?: string | string[];
  cuisine?: string | string[];
  date?: string | string[];
  time?: string | string[];
  guests?: string | string[];
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

  const date = one(searchParams.date).slice(0, 10);
  const time = one(searchParams.time).slice(0, 5);
  const guests = one(searchParams.guests).slice(0, 3);
  const availability = discoveryFilter(date, time, guests);
  const where: Prisma.ChefProfileWhereInput = availability.where;
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
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      select: chefListSelect,
    }),
    getChefCities(),
    getChefCuisines(),
  ]);

  // Search by chef name, cuisine, dish or bio. Every word typed must match somewhere.
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = availability.error ? [] : tokens.length
    ? rows.filter((chef) => {
        const haystack = [chef.displayName, chef.cuisines.join(" "), chef.sampleMenu, chef.bio, chef.city]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
    : rows;

  const matchedIds = matched.map((c) => c.userId);
  const ratings = await getRatingMap(matchedIds);
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

  const pagination = paginate(sorted, one(searchParams.page));
  const visible = pagination.items;
  const completed = await getCompletedMap(visible.map((chef) => chef.userId));
  const pageUrl = (page: number) => chefPageUrl({ q, city, sort: sort === "recommended" ? "" : sort,
    maxPrice: maxPrice ? String(maxPrice) : "", verified: verifiedOnly ? "1" : "",
    cuisine: cuisineFilter.join(","), date, time, guests }, page);
  const title = city ? `The chefs of ${findCity(city)?.name ?? city}` : "Chefs on Saffron";

  return (
    <div className={pageClass}>
      <ChefsHeader
        key={[date, time, guests, pagination.page].join("|")}
        initial={{
          q,
          city,
          sort,
          maxPrice: maxPrice ? String(maxPrice) : "",
          verified: verifiedOnly,
          cuisine: cuisineFilter.join(","),
          date, time, guests,
        }}
        chefCities={chefCities}
        cuisineOptions={cuisineOptions}
        title={title}
      />
      {availability.error && <p role="alert" className="mt-4 text-danger">{availability.error}</p>}
      {date && !availability.error && <p className="mt-4 text-sm text-ink/70">Availability is checked in IST. {time ? "Chefs have at least 4 hours between bookings." : "Choose a time to include chefs with other bookings that day."} A request still needs the chef&apos;s confirmation.</p>}

      <div id="chef-results" className="mt-8 flex scroll-mt-24 flex-wrap items-center justify-between gap-2 border-b border-leaf/20 pb-4 text-sm">
        <p>
          <span className="font-bold">
            {sorted.length} {sorted.length === 1 ? "chef" : "chefs"}
          </span>{" "}
          <span className="text-ink/70">ready to cook for you</span>
        </p>
        <p className="flex items-center gap-1.5 text-ink/70">
          <CheckCircleIcon className="h-4 w-4 text-leaf" />
          {sort === "recommended" ? "Verified chefs are listed first" : "Your chosen sort applies to all results"}
        </p>
      </div>

      {visible.length > 0 && <p className="mt-4 text-sm text-ink/65">Showing {pagination.start + 1}–{pagination.start + visible.length} of {sorted.length} chefs</p>}
      {availability.error || visible.length === 0 ? (
        <div className="mt-6 animate-scale-in rounded-2xl border-2 border-dashed border-leaf/50 bg-sage/70 p-8 text-center shadow-soft">
          <h2 className="text-xl font-bold">No chefs match yet</h2>
          <p className="mx-auto mt-2 max-w-md text-ink/80">
            Try another date, time, guest count, city or cuisine. Know a great home chef? Invite
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
          {visible.map((chef, i) => (
            <div
              key={chef.id}
              style={{ animationDelay: `${Math.min(i, 7) * 60}ms` }}
              className={`h-full animate-fade-up [&>a]:h-full ${visible.length === 1 ? "xl:col-span-2" : ""}`}
            >
              <ChefListCard
                bookingQuery={new URLSearchParams({ ...(date && time ? { eventDate: `${date}T${time}` } : {}), ...(guests ? { guests } : {}) }).toString()}
                chef={chef}
                avg={ratings.get(chef.userId)?.avg ?? null}
                count={countOf(chef.userId)}
                completed={completed.get(chef.userId) ?? 0}
              />
            </div>
          ))}
        </div>
      )}
      {!availability.error && pagination.pageCount > 1 && <nav aria-label="Chef search pages" className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-leaf/20 pt-6">
        {pagination.page > 1 ? <Link href={pageUrl(pagination.page - 1)} className={outlineButton}>Previous chefs</Link> : <span aria-disabled="true" className={`${outlineButton} opacity-40`}>Previous chefs</span>}
        <span aria-current="page" className="px-2 text-sm font-semibold">Page {pagination.page} of {pagination.pageCount}</span>
        {pagination.page < pagination.pageCount ? <Link href={pageUrl(pagination.page + 1)} className={outlineButton}>Next chefs</Link> : <span aria-disabled="true" className={`${outlineButton} opacity-40`}>Next chefs</span>}
      </nav>}
    </div>
  );
}
