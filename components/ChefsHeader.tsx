"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import MealSearchPicker from "@/components/MealSearchPicker";
import { mealSearchLabel } from "@/lib/mealSearch";
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
  const lastUrl = useRef(toUrl(initial));
  const priceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [sort, setSort] = useState(initial.sort);
  const [searchVersion, setSearchVersion] = useState(0);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  const [verified, setVerified] = useState(initial.verified);
  const [cuisines, setCuisines] = useState<string[]>(
    initial.cuisine ? initial.cuisine.split(",").filter(Boolean) : []
  );
  const [showFilters, setShowFilters] = useState(
    Boolean(initial.maxPrice || initial.verified || initial.cuisine)
  );

  useEffect(() => {
    const url = toUrl(initial);
    // Own navigations already have current drafts. External resets/back-forward
    // must replace every control and cancel work queued for the previous URL.
    if (url === lastUrl.current) return;
    clearTimeout(priceTimer.current);
    state.current = initial;
    lastUrl.current = url;
    setSort(initial.sort); setMaxPrice(initial.maxPrice); setVerified(initial.verified);
    setCuisines(initial.cuisine ? initial.cuisine.split(",").filter(Boolean) : []);
    setShowFilters(Boolean(initial.maxPrice || initial.verified || initial.cuisine));
    // Also discard unsubmitted text and its debounce timer on an external reset.
    setSearchVersion((version) => version + 1);
  }, [initial]);
  useEffect(() => () => clearTimeout(priceTimer.current), []);

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
    state.current = { ...state.current, maxPrice: value.trim() };
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
        key={searchVersion}
        variant="page"
        initialQ={initial.q}
        initialCity={initial.city}
        chefCities={chefCities}
        onQueryChange={(q) => push({ q })}
        onCityCommit={(city) => push({ city })}
        onSubmit={(q, city) => push({ q, city })}
        pending={isPending}
      />

      <div className="mt-6 sm:mt-8">
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

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
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

            <MealSearchPicker value={{ date: initial.date, time: initial.time, guests: initial.guests }} pending={isPending} onApply={(meal) => push(meal)} />

            <label htmlFor="sort" className="sr-only">
              Sort chefs
            </label>
            <div className="relative ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-leaf/30 bg-white/60 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-leaf sm:ml-0 sm:w-auto sm:min-w-0 sm:flex-1 sm:border-0 sm:bg-transparent" title={`Sort: ${SORT_LABELS[sort]}`}>
            <svg className="sm:hidden" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4" /></svg>
            <select
              id="sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                push({ sort: e.target.value });
              }}
              className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0 sm:static sm:min-h-12 sm:rounded-lg sm:border sm:border-leaf/30 sm:bg-white/60 sm:px-3 sm:text-base sm:font-medium sm:opacity-100"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            </div>
          </div>
        </div>

        {(initial.date || initial.time || initial.guests) && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Applied meal details">
          <button type="button" disabled={isPending} onClick={() => push({ date: "", time: "", guests: "" })}
            aria-label={`Remove meal details: ${mealSearchLabel(initial)}`}
            className="inline-flex min-h-11 max-w-full items-center gap-3 rounded-full border border-leaf/30 bg-leaf/5 px-4 py-2 text-left text-sm font-medium text-leaf hover:bg-sage disabled:opacity-60">
            <span className="min-w-0 break-words">{mealSearchLabel(initial)}</span><span aria-hidden="true" className="shrink-0 text-lg">×</span>
          </button>
        </div>}

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
