"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import { FiltersIcon, FlameIcon } from "@/components/Icons";
import type { CityOption } from "@/lib/cities";
import type { CuisineOption } from "@/lib/cuisines";
import { inputClass, labelClass, outlineButton } from "@/lib/ui";

type State = {
  q: string;
  city: string;
  sort: string;
  maxPrice: string;
  verified: boolean;
  cuisine: string; // comma separated, lowercase
  date: string;
  time: string;
  guests: string;
};

const SORT_LABELS: Record<string, string> = {
  recommended: "Recommended",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Top rated",
  experience: "Most experienced",
};

function toUrl(s: State) {
  const params = new URLSearchParams();
  if (s.q) params.set("q", s.q);
  if (s.city) params.set("city", s.city);
  if (s.sort && s.sort !== "recommended") params.set("sort", s.sort);
  if (s.maxPrice) params.set("maxPrice", s.maxPrice);
  if (s.verified) params.set("verified", "1");
  if (s.cuisine) params.set("cuisine", s.cuisine);
  if (s.date) params.set("date", s.date);
  if (s.time) params.set("time", s.time);
  if (s.guests) params.set("guests", s.guests);
  const qs = params.toString();
  return qs ? `/chefs?${qs}` : "/chefs";
}

export default function ChefsHeader({
  initial,
  chefCities,
  cuisineOptions,
  title,
}: {
  initial: State;
  chefCities: CityOption[];
  cuisineOptions: CuisineOption[];
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const state = useRef<State>(initial);
  const lastUrl = useRef("");
  const priceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [sort, setSort] = useState(initial.sort);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  const [verified, setVerified] = useState(initial.verified);
  const [cuisines, setCuisines] = useState<string[]>(
    initial.cuisine ? initial.cuisine.split(",").filter(Boolean) : []
  );
  const [showFilters, setShowFilters] = useState(
    Boolean(initial.maxPrice || initial.verified || initial.cuisine)
  );

  function push(patch: Partial<State>) {
    state.current = { ...state.current, ...patch };
    const url = toUrl(state.current);
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  }

  function onPriceChange(value: string) {
    setMaxPrice(value);
    clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(() => push({ maxPrice: value.trim() }), 400);
  }

  function toggleCuisine(name: string) {
    const next = cuisines.includes(name) ? cuisines.filter((c) => c !== name) : [...cuisines, name];
    setCuisines(next);
    push({ cuisine: next.join(",") });
  }

  function clearFilters() {
    clearTimeout(priceTimer.current);
    setMaxPrice("");
    setVerified(false);
    setCuisines([]);
    push({ maxPrice: "", verified: false, cuisine: "" });
  }

  const activeFilters = (maxPrice ? 1 : 0) + (verified ? 1 : 0) + cuisines.length;

  return (
    <div>
      <SearchBar
        variant="page"
        initialQ={initial.q}
        initialCity={initial.city}
        chefCities={chefCities}
        onQueryChange={(q) => push({ q })}
        onCityCommit={(city) => push({ city })}
        onSubmit={(q, city) => push({ q, city })}
        pending={isPending}
      />

      <form aria-labelledby="availability-heading" className="mt-5 min-w-0 rounded-2xl border border-leaf/20 bg-white/50 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          push({ date: String(data.get("date") ?? ""), time: String(data.get("time") ?? ""), guests: String(data.get("guests") ?? "") });
        }}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="availability-heading" className="text-base font-bold">Plan your meal</h2>
            <p id="availability-hint" className="mt-1 text-sm text-ink/70">Add a date and guests to narrow your search. All times are in IST.</p>
          </div>
          {(initial.date || initial.time || initial.guests) && <button type="button" onClick={() => push({ date: "", time: "", guests: "" })} className="min-h-11 text-sm font-semibold text-leaf underline underline-offset-4">Clear meal details</button>}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.6fr)_auto] lg:items-end">
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <label htmlFor="search-date" className={labelClass}>Meal date</label>
            <input id="search-date" name="date" type="date" defaultValue={initial.date} aria-describedby="availability-hint" className={inputClass} />
          </div>
          <div className="min-w-0">
            <label htmlFor="search-time" className={labelClass}>Time (optional)</label>
            <input id="search-time" name="time" type="time" defaultValue={initial.time} aria-describedby="availability-hint" className={inputClass} />
          </div>
          <div className="min-w-0">
            <label htmlFor="search-guests" className={labelClass}>Guests</label>
            <input id="search-guests" name="guests" type="number" inputMode="numeric" placeholder="Any" min="1" max="100" defaultValue={initial.guests} className={inputClass} />
          </div>
          <button type="submit" disabled={isPending} className={`${outlineButton} col-span-2 min-w-0 lg:col-span-1 lg:min-h-[50px]`}>{isPending ? "Checking…" : "Check availability"}</button>
        </div>
      </form>

      <div className="mt-8 sm:mt-10">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-leaf">
          <FlameIcon className="h-4 w-4" />
          Meet your match
        </p>

        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold sm:text-4xl">{title}</h1>
            <p className="mt-2 text-ink/70">
              Thoughtful cooking. Your own kitchen. An evening that feels like yours.
            </p>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 xl:w-auto">
            <button
              type="button"
              aria-expanded={showFilters}
              aria-controls="filters-panel"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-lg border border-leaf/30 px-3 text-sm font-semibold hover:bg-sage sm:text-base"
            >
              <FiltersIcon className="h-5 w-5" />
              Filters
              {activeFilters > 0 && (
                <span className="rounded-full bg-leaf px-2 py-0.5 text-xs text-white">{activeFilters}</span>
              )}
            </button>

            <label htmlFor="sort" className="sr-only">
              Sort chefs
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                push({ sort: e.target.value });
              }}
              className="min-h-[48px] w-full min-w-0 flex-1 rounded-lg border border-leaf/30 bg-white/60 px-3 text-base font-medium xl:w-auto"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showFilters && (
          <div id="filters-panel" className="mt-4 animate-slide-down space-y-5 rounded-xl bg-sage/70 p-4 shadow-soft">
            {cuisineOptions.length > 0 && (
              <fieldset>
                <legend className={labelClass}>Cuisine</legend>
                <div className="flex flex-wrap gap-2">
                  {cuisineOptions.map((option) => {
                    const on = cuisines.includes(option.name);
                    return (
                      <button
                        key={option.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleCuisine(option.name)}
                        className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium capitalize transition duration-200 active:scale-95 ${
                          on ? "border-leaf bg-leaf text-white" : "border-leaf/40 bg-cream hover:bg-sage"
                        }`}
                      >
                        {on && "✓ "}
                        {option.name}
                        <span className="ml-1.5 text-xs opacity-70">{option.count}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <div>
                <label htmlFor="maxPrice" className={labelClass}>
                  Max price per person (₹)
                </label>
                <input
                  id="maxPrice"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={maxPrice}
                  onChange={(e) => onPriceChange(e.target.value)}
                  className={inputClass}
                />
              </div>
              <label className="flex min-h-[44px] items-center gap-3 text-base">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-leaf"
                  checked={verified}
                  onChange={(e) => {
                    setVerified(e.target.checked);
                    push({ verified: e.target.checked });
                  }}
                />
                Verified chefs only
              </label>
              <button type="button" onClick={clearFilters} className={outlineButton}>
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
