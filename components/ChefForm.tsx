"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CUISINE_OPTIONS, MAX_CUISINES } from "@/lib/cuisines";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export type ChefFormValues = {
  displayName: string;
  bio: string;
  city: string;
  cuisines: string; // comma separated; the form splits it into chips and an "other" box
  pricePerPerson: string;
  maxGuests: string;
  yearsExperience: string;
  phone: string;
  photoUrl: string;
  sampleMenu: string;
  active: boolean;
};

const PRESETS: readonly string[] = CUISINE_OPTIONS;

function splitCuisines(text: string) {
  return text
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink/70">{hint}</p>}
      {error && (
        <p className="mt-1 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ChefForm({
  initial,
  isExisting,
}: {
  initial: ChefFormValues;
  isExisting: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ChefFormValues>(initial);
  const [selected, setSelected] = useState<string[]>(() =>
    splitCuisines(initial.cuisines).filter((c) => PRESETS.includes(c))
  );
  const [custom, setCustom] = useState(() =>
    splitCuisines(initial.cuisines)
      .filter((c) => !PRESETS.includes(c))
      .join(", ")
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const customList = splitCuisines(custom);
  const totalCuisines = selected.length + customList.length;

  function set<K extends keyof ChefFormValues>(key: K, value: ChefFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleCuisine(name: string) {
    setSelected((list) => (list.includes(name) ? list.filter((c) => c !== name) : [...list, name]));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage(null);

    try {
      const res = await fetch("/api/chef", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          cuisines: [...selected, ...customList],
          pricePerPerson: Number(values.pricePerPerson),
          maxGuests: Number(values.maxGuests),
          yearsExperience: Number(values.yearsExperience),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setMessage({ type: "error", text: data.error ?? "Could not save your profile. Try again." });
        return;
      }

      setMessage({ type: "ok", text: "Profile saved." });
      router.push("/chef"); router.push("/chef"); router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network problem. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
      <Field label="Chef name" htmlFor="displayName" error={errors.displayName}>
        <input
          id="displayName"
          className={inputClass}
          value={values.displayName}
          onChange={(e) => set("displayName", e.target.value)}
        />
      </Field>

      <Field label="City" htmlFor="city" error={errors.city} hint="For example: Bhopal">
        <input id="city" className={inputClass} value={values.city} onChange={(e) => set("city", e.target.value)} />
      </Field>

      <fieldset>
        <legend className={labelClass}>Cuisines</legend>
        <p className="mb-2 text-xs text-ink/70">
          Tap everything you cook. {totalCuisines} of {MAX_CUISINES} chosen.
        </p>
        <div className="flex flex-wrap gap-2">
          {CUISINE_OPTIONS.map((name) => {
            const on = selected.includes(name);
            const locked = !on && totalCuisines >= MAX_CUISINES;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => toggleCuisine(name)}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? "border-leaf bg-leaf text-white" : "border-leaf/40 hover:bg-sage"
                }`}
              >
                {on && "✓ "}
                {name}
              </button>
            );
          })}
        </div>
        {errors.cuisines && (
          <p className="mt-2 text-sm font-medium text-danger" role="alert">
            {errors.cuisines}
          </p>
        )}
      </fieldset>

      <Field
        label="Other cuisines (optional)"
        htmlFor="customCuisines"
        hint="Not in the list? Add your own, separated by commas."
      >
        <input
          id="customCuisines"
          className={inputClass}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Price per person (₹)" htmlFor="pricePerPerson" error={errors.pricePerPerson}>
          <input
            id="pricePerPerson"
            type="number"
            inputMode="numeric"
            className={inputClass}
            value={values.pricePerPerson}
            onChange={(e) => set("pricePerPerson", e.target.value)}
          />
        </Field>
        <Field
          label="Maximum guests you can cook for"
          htmlFor="maxGuests"
          error={errors.maxGuests}
          hint="The most guests in one booking."
        >
          <input
            id="maxGuests"
            type="number"
            inputMode="numeric"
            className={inputClass}
            value={values.maxGuests}
            onChange={(e) => set("maxGuests", e.target.value)}
          />
        </Field>
        <Field label="Years of experience" htmlFor="yearsExperience" error={errors.yearsExperience}>
          <input
            id="yearsExperience"
            type="number"
            inputMode="numeric"
            className={inputClass}
            value={values.yearsExperience}
            onChange={(e) => set("yearsExperience", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Bio" htmlFor="bio" error={errors.bio} hint="Tell customers about your cooking and style.">
        <textarea id="bio" rows={5} className={inputClass} value={values.bio} onChange={(e) => set("bio", e.target.value)} />
      </Field>

      <Field label="Sample menu" htmlFor="sampleMenu" error={errors.sampleMenu} hint="One dish per line.">
        <textarea
          id="sampleMenu"
          rows={5}
          className={inputClass}
          value={values.sampleMenu}
          onChange={(e) => set("sampleMenu", e.target.value)}
        />
      </Field>

      <Field
        label="Phone number"
        htmlFor="phone"
        error={errors.phone}
        hint="Shared with a customer only after you accept their booking."
      >
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          className={inputClass}
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </Field>

      <Field
        label="Photo link (optional)"
        htmlFor="photoUrl"
        error={errors.photoUrl}
        hint="Paste a link to a photo of you or your food."
      >
        <input
          id="photoUrl"
          type="url"
          inputMode="url"
          className={inputClass}
          value={values.photoUrl}
          onChange={(e) => set("photoUrl", e.target.value)}
        />
      </Field>

      {isExisting && (
        <label className="flex min-h-[44px] items-center gap-3 text-base">
          <input
            type="checkbox"
            className="h-5 w-5 accent-leaf"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Accepting new booking requests
        </label>
      )}

      {message && (
        <p role="alert" className={message.type === "ok" ? "font-medium text-leaf" : "font-medium text-danger"}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={saving} className={`${primaryButton} w-full`}>
        {saving ? "Saving..." : isExisting ? "Save changes" : "Create chef profile"}
      </button>
    </form>
  );
}