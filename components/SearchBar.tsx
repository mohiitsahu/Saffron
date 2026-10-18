"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { INDIAN_CITIES, nearestCity, type CityOption } from "@/lib/cities";
import { LocateIcon, PinIcon, SearchIcon } from "@/components/Icons";
import { accentButton } from "@/lib/ui";

const POPULAR = ["North Indian", "South Indian", "Mughlai", "Chinese", "Italian"];

type Option = { name: string; count: number; aliases: string[] };
type Item = { kind: "locate" } | { kind: "city"; option: Option };

type Props = {
  variant: "hero" | "page";
  initialQ?: string;
  initialCity?: string;
  chefCities: CityOption[];
  // Live mode (results page): called while typing, after a short pause.
  onQueryChange?: (q: string) => void;
  onCityCommit?: (city: string) => void;
  // Called when the user presses "Find my chef" or Enter.
  onSubmit: (q: string, city: string) => void;
  pending?: boolean;
};

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink/70 hover:bg-sage hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export default function SearchBar({
  variant,
  initialQ = "",
  initialCity = "",
  chefCities,
  onQueryChange,
  onCityCommit,
  onSubmit,
  pending = false,
}: Props) {
  const uid = useId();
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [canLocate, setCanLocate] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");

  const qRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const committedCity = useRef(initialCity);
  const queryCallback = useRef(onQueryChange);
  queryCallback.current = onQueryChange;
  const firstRun = useRef(true);

  useEffect(() => {
    setCanLocate("geolocation" in navigator);
  }, []);

  // Live search: wait 300 ms after the last keystroke, then update the results.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!queryCallback.current) return;
    const timer = setTimeout(() => queryCallback.current?.(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const options = useMemo<Option[]>(() => {
    const aliasByName = new Map<string, string[]>();
    for (const c of INDIAN_CITIES) aliasByName.set(c.name.toLowerCase(), c.aliases ?? []);

    const merged = new Map<string, Option>();
    for (const c of chefCities) {
      const key = c.name.toLowerCase();
      merged.set(key, { name: c.name, count: c.count, aliases: aliasByName.get(key) ?? [] });
    }
    for (const c of INDIAN_CITIES) {
      const key = c.name.toLowerCase();
      if (!merged.has(key)) merged.set(key, { name: c.name, count: 0, aliases: c.aliases ?? [] });
    }
    return Array.from(merged.values());
  }, [chefCities]);

  const items = useMemo<Item[]>(() => {
    const text = city.trim().toLowerCase();
    let list: Option[];

    if (!text) {
      list = options.slice(0, 6);
    } else {
      const ranked: { option: Option; rank: number }[] = [];
      for (const option of options) {
        const names = [option.name, ...option.aliases].map((n) => n.toLowerCase());
        if (names.some((n) => n.startsWith(text))) ranked.push({ option, rank: 0 });
        else if (names.some((n) => n.includes(text))) ranked.push({ option, rank: 1 });
      }
      ranked.sort((a, b) => a.rank - b.rank || b.option.count - a.option.count);
      list = ranked.slice(0, 8).map((r) => r.option);
    }

    const cityItems: Item[] = list.map((option) => ({ kind: "city", option }));
    return canLocate ? [{ kind: "locate" }, ...cityItems] : cityItems;
  }, [city, options, canLocate]);

  function chooseCity(name: string) {
    setCity(name);
    setOpen(false);
    setActive(-1);
    setMessage("");
    committedCity.current = name;
    onCityCommit?.(name);
  }

  function commitTyped() {
    const value = city.trim();
    if (value !== committedCity.current) {
      committedCity.current = value;
      onCityCommit?.(value);
    }
  }

  function locate() {
    setMessage("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const hit = nearestCity(pos.coords.latitude, pos.coords.longitude);
        if (hit) {
          chooseCity(hit.city.name);
        } else {
          setMessage("We couldn't match your location to a city yet. Type your city instead.");
          setOpen(true);
        }
      },
      (err) => {
        setLocating(false);
        setMessage(
          err.code === 1
            ? "Location access is blocked. Allow it in your browser settings, or type your city."
            : "We couldn't get your location. Type your city instead."
        );
        setOpen(true);
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  function pick(item: Item) {
    if (item.kind === "locate") locate();
    else chooseCity(item.option.name);
  }

  function onCityChange(value: string) {
    setCity(value);
    setOpen(true);
    setActive(-1);
    setMessage("");
    if (!value.trim() && committedCity.current) {
      committedCity.current = "";
      onCityCommit?.("");
    }
  }

  function clearQuery() {
    setQ("");
    queryCallback.current?.("");
    qRef.current?.focus();
  }

  function clearCity() {
    onCityChange("");
    cityRef.current?.focus();
  }

  function onCityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = city.trim();
    committedCity.current = value;
    setOpen(false);
    onSubmit(q.trim(), value);
  }

  function pickPopular(label: string) {
    setQ(label);
    if (onQueryChange) onQueryChange(label);
    else onSubmit(label, city.trim());
  }

  const hero = variant === "hero";
  const listId = `${uid}-cities`;
  const cellFocus = "focus-within:bg-sage/70 focus-within:ring-2 focus-within:ring-inset focus-within:ring-leaf";

  return (
    <form onSubmit={handleSubmit} role="search" aria-label="Find a chef">
      <div
        className={`grid rounded-2xl border border-leaf/30 bg-cream text-ink ${
          hero ? "shadow-lift" : "shadow-soft"
        } md:grid-cols-[1fr_1fr_auto] md:items-center`}
      >
        <div
          className={`flex items-center gap-3 rounded-t-2xl border-b border-leaf/20 px-4 py-3 md:rounded-l-2xl md:rounded-tr-none md:border-b-0 md:border-r ${cellFocus}`}
        >
          <SearchIcon className="h-5 w-5 flex-none" />
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-q`} className="block text-sm font-semibold">
              What are you craving?
            </label>
            <div className="flex items-center gap-1">
              <input
                ref={qRef}
                id={`${uid}-q`}
                type="text"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Chef, cuisine or dish"
                className="min-w-0 flex-1 bg-transparent text-base placeholder:text-ink/50 focus:outline-none"
              />
              {q && <ClearButton label="Clear search" onClick={clearQuery} />}
            </div>
          </div>
        </div>

        <div
          className={`relative flex items-center gap-3 border-b border-leaf/20 px-4 py-3 md:border-b-0 ${cellFocus}`}
        >
          <PinIcon className="h-5 w-5 flex-none" />
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-city`} className="block text-sm font-semibold">
              Near
            </label>
            <div className="flex items-center gap-1">
              <input
                ref={cityRef}
                id={`${uid}-city`}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
                autoComplete="off"
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  setOpen(false);
                  commitTyped();
                }}
                onKeyDown={onCityKeyDown}
                placeholder="Type your city"
                className="min-w-0 flex-1 bg-transparent text-base placeholder:text-ink/50 focus:outline-none"
              />
              {city && <ClearButton label="Clear city" onClick={clearCity} />}
            </div>
          </div>

          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label="City suggestions"
              className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 animate-slide-down overflow-auto rounded-xl border border-leaf/30 bg-cream py-1 shadow-lift"
            >
              {items.map((item, i) => (
                <li
                  key={item.kind === "locate" ? "locate" : item.option.name}
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${
                    i === active ? "bg-sage" : "hover:bg-sage/70"
                  }`}
                >
                  {item.kind === "locate" ? (
                    <span className="flex items-center gap-2 font-semibold text-leaf">
                      <LocateIcon className="h-4 w-4" />
                      {locating ? "Finding your location…" : "Use my current location"}
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        <PinIcon className="h-4 w-4 flex-none text-ink/60" />
                        {item.option.name}
                      </span>
                      {item.option.count > 0 && (
                        <span className="text-xs text-ink/60">
                          {item.option.count} {item.option.count === 1 ? "chef" : "chefs"}
                        </span>
                      )}
                    </>
                  )}
                </li>
              ))}
              {city.trim() && items.every((item) => item.kind === "locate") && (
                <li role="presentation" className="px-4 py-3 text-sm text-ink/70">
                  No match in our list. Press Enter to search for “{city.trim()}”.
                </li>
              )}
              {message && (
                <li role="status" className="border-t border-leaf/20 px-4 py-3 text-sm text-danger">
                  {message}
                </li>
              )}
            </ul>
          )}
        </div>

        <button type="submit" className={`${accentButton} m-2 gap-2`}>
          <SearchIcon className="h-5 w-5" />
          Find my chef
        </button>
      </div>

      <div
        className={`mt-3 flex flex-wrap items-center gap-2 text-sm ${hero ? "text-white" : "text-ink/70"}`}
      >
        <span>Popular:</span>
        {POPULAR.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => pickPopular(label)}
            className={`rounded-full border px-3 py-2 font-medium transition duration-200 active:scale-95 ${
              hero ? "border-white/40 hover:bg-white/15" : "border-leaf/30 hover:bg-sage"
            }`}
          >
            {label}
          </button>
        ))}
        {pending && (
          <span role="status" className="ml-auto text-xs">
            Updating results…
          </span>
        )}
      </div>
    </form>
  );
}