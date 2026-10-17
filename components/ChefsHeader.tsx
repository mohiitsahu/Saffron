"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import { FiltersIcon, FlameIcon } from "@/components/Icons";
import type { CityOption } from "@/lib/cities";
import { inputClass, labelClass, outlineButton } from "@/lib/ui";

type State = {
  q: string;
  city: string;
  sort: string;
  maxPrice: string;
  verified: boolean;
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
  const qs = params.toString();
  return qs ? `/chefs?${qs}` : "/chefs";
}

export default function ChefsHeader({
  initial,
  chefCities,
  title,
}: {
  initial: State;
  chefCities: CityOption[];
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const state = useRef<State>(initial);
  const lastUrl = useRef(toUrl(initial));
  const priceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [sort, setSort] = useState(initial.sort);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  const [verified, setVerified] = useState(initial.verified);
  const [showFilters, setShowFilters] = useState(Boolean(initial.maxPrice || initial.verified));

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

  function clearFilters() {
    clearTimeout(priceTimer.current);
    setMaxPrice("");
    setVerified(false);
    push({ maxPrice: "", verified: false });
  }

  const activeFilters = (maxPrice ? 1 : 0) + (verified ? 1 : 0);

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

      <div className="mt-10">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-leaf">
          <FlameIcon className="h-4 w-4" />
          Meet your match
        </p>

        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold sm:text-5xl">{title}</h1>
            <p className="mt-2 text-ink/70">
              Thoughtful cooking. Your own kitchen. An evening that feels like yours.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-expanded={showFilters}
              aria-controls="filters-panel"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 font-semibold hover:bg-sage/30"
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
              className="min-h-[44px] rounded-md border border-leaf/40 bg-cream px-3 font-semibold"
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
          <div
            id="filters-panel"
            className="mt-4 grid gap-4 rounded-xl bg-sage/25 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
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
        )}
      </div>
    </div>
  );
}