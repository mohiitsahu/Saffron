"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CUISINE_OPTIONS, MAX_CUISINES } from "@/lib/cuisines";
import { dangerButton, inputClass, labelClass, outlineButton, panelClass, primaryButton } from "@/lib/ui";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import PhotoUpload from "@/components/PhotoUpload";
import FormNotice from "@/components/FormNotice";

export type ChefFormValues = {
  displayName: string; bio: string; city: string; cuisines: string;
  pricePerPerson: string; maxGuests: string; yearsExperience: string;
  phone: string; photoUrl: string; sampleMenu: string; active: boolean;
};
const splitCuisines = (text: string) => text.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);

function ProfileSection({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-heading`} className={`${panelClass} scroll-mt-24 space-y-5`}>
    <div><h2 id={`${id}-heading`} className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-ink/70">{hint}</p></div>{children}
  </section>;
}

export default function ChefForm({ initial, isExisting }: { initial: ChefFormValues; isExisting: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const [values, setValues] = useState(initial);
  const [selected, setSelected] = useState(() => splitCuisines(initial.cuisines).filter((item) => (CUISINE_OPTIONS as readonly string[]).includes(item)));
  const [custom, setCustom] = useState(() => splitCuisines(initial.cuisines).filter((item) => !(CUISINE_OPTIONS as readonly string[]).includes(item)).join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [portrait, setPortrait] = useState<Blob | null | undefined>(undefined);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const customList = splitCuisines(custom);
  const cuisines = [...selected, ...customList];
  const totalCuisines = cuisines.length;
  const normalise = (items: string[]) => [...items].sort().join(",");
  const dirty = !saved && (portraitBusy || portrait !== undefined || Object.entries(values).some(([key, value]) => key !== "cuisines" && value !== initial[key as keyof ChefFormValues]) || normalise(cuisines) !== normalise(splitCuisines(initial.cuisines)));
  const navigation = useUnsavedChanges(dirty);
  useEffect(() => {
    if (navigation.pendingHref && !leaveDialog.current?.open) { leaveDialog.current?.showModal(); keepEditing.current?.focus(); }
    if (!navigation.pendingHref && leaveDialog.current?.open) leaveDialog.current.close();
  }, [navigation.pendingHref]);
  useEffect(() => { if (Object.keys(errors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-cuisine-error="true"] button')?.focus(); }, [errors]);
  function set<K extends keyof ChefFormValues>(key: K, value: ChefFormValues[K]) { setSaved(false); setValues((current) => ({ ...current, [key]: value })); }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (portraitBusy || saving) return; setSaving(true); setErrors({}); setMessage("");
    try {
      const details = { ...values, photoUrl: portrait !== undefined ? "" : values.photoUrl, cuisines, pricePerPerson: Number(values.pricePerPerson), maxGuests: Number(values.maxGuests), yearsExperience: Number(values.yearsExperience) };
      let body: string | FormData = JSON.stringify(details);
      if (portrait) { body = new FormData(); body.append("profile", JSON.stringify(details)); body.append("file", portrait, "portrait.jpg"); }
      const res = await fetch("/api/chef", { method: "PUT", ...(typeof body === "string" ? { headers: { "Content-Type": "application/json" } } : {}), body });
      const data = await res.json();
      if (!res.ok) { setErrors(data.fieldErrors ?? {}); setMessage(data.error ?? "Could not save your profile. Try again."); return; }
      setSaved(true); router.push("/chef?saved=1"); router.refresh();
    } catch { setMessage("Network problem. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  function field(key: Exclude<keyof ChefFormValues, "active" | "cuisines">, label: string, options: { hint?: string; type?: string; rows?: number; autoComplete?: string } = {}) {
    const props = { id: key, name: key, value: values[key], disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, event.target.value), className: inputClass, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] || options.hint ? `${key}-help` : undefined };
    return <div className="min-w-0"><label htmlFor={key} className={labelClass}>{label}</label>{options.rows ? <textarea {...props} rows={options.rows} /> : <input {...props} type={options.type ?? "text"} inputMode={options.type === "number" ? "numeric" : options.type === "tel" ? "tel" : undefined} autoComplete={options.autoComplete} />}{(errors[key] || options.hint) && <p id={`${key}-help`} className={`mt-1 text-xs ${errors[key] ? "text-danger" : "text-ink/70"}`}>{errors[key] ?? options.hint}</p>}</div>;
  }

  return <form ref={form} onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
    <nav aria-label="Profile sections" className="flex flex-wrap gap-2 text-sm font-semibold text-leaf">{[["about-you", "1. About you"], ["your-cooking", "2. Cooking"], ["your-pricing", "3. Pricing"]].map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full border border-leaf/25 bg-white/40 px-4 hover:bg-sage">{label}</a>)}</nav>
    <ProfileSection id="about-you" title="About you" hint="Introduce yourself and help customers get to know their chef.">
      <div className="grid gap-5 sm:grid-cols-2">{field("displayName", "Chef name", { autoComplete: "name" })}{field("city", "City", { hint: "For example: Bhopal", autoComplete: "address-level2" })}</div>
      {field("bio", "Bio", { rows: 4, hint: "Tell customers about your cooking and style." })}
      <div className="grid gap-5 sm:grid-cols-2">{field("yearsExperience", "Years of experience", { type: "number" })}{field("phone", "Phone number", { type: "tel", autoComplete: "tel-national", hint: "Shared only after you accept a booking." })}</div>
      <PhotoUpload value={values.photoUrl} draft={portrait} disabled={saving} onBusyChange={setPortraitBusy} onChange={(photo) => { setSaved(false); setPortrait(photo === null && !initial.photoUrl ? undefined : photo); }} name={values.displayName} error={errors.photoUrl} />
    </ProfileSection>
    <ProfileSection id="your-cooking" title="Your cooking" hint="Show the cuisines and dishes customers can request.">
      <fieldset disabled={saving} data-cuisine-error={Boolean(errors.cuisines)} aria-describedby={errors.cuisines ? "cuisines-help cuisines-error" : "cuisines-help"} className="min-w-0"><legend className={labelClass}>Cuisines</legend><p id="cuisines-help" className="mb-3 text-xs text-ink/70">Choose up to {MAX_CUISINES}. {totalCuisines} selected.</p><div className="flex flex-wrap gap-2">{CUISINE_OPTIONS.map((name) => {
        const on = selected.includes(name);
        return <button key={name} type="button" aria-pressed={on} aria-describedby={errors.cuisines ? "cuisines-error" : "cuisines-help"} disabled={!on && totalCuisines >= MAX_CUISINES} onClick={() => { setSaved(false); setSelected((current) => on ? current.filter((item) => item !== name) : [...current, name]); }} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium capitalize disabled:opacity-40 ${on ? "border-leaf bg-leaf text-white" : "border-leaf/40 hover:bg-sage"}`}>{on && "✓ "}{name}</button>;
      })}</div>{errors.cuisines && <p id="cuisines-error" className="mt-2 text-sm text-danger">{errors.cuisines}</p>}</fieldset>
      <div><label htmlFor="customCuisines" className={labelClass}>Other cuisines (optional)</label><input id="customCuisines" disabled={saving} value={custom} onChange={(event) => { setSaved(false); setCustom(event.target.value); }} className={inputClass} aria-describedby="custom-cuisines-help" /><p id="custom-cuisines-help" className="mt-1 text-xs text-ink/70">Add cuisines separated by commas.</p></div>
      {field("sampleMenu", "Sample menu", { rows: 4, hint: "One dish per line. Start with 3 to 6 signature dishes." })}
    </ProfileSection>
    <ProfileSection id="your-pricing" title="Pricing and availability" hint="Set a price and guest count you are comfortable with.">
      <div className="grid gap-5 sm:grid-cols-2">{field("pricePerPerson", "Price per person (₹)", { type: "number" })}{field("maxGuests", "Maximum guests", { type: "number", hint: "The most guests in one booking." })}</div>
      <p className="text-sm text-ink/70">Agree groceries, travel and extras with the customer before the meal.</p>
      {isExisting && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" disabled={saving} checked={values.active} onChange={(event) => set("active", event.target.checked)} className="h-5 w-5 accent-leaf" />Accepting new booking requests</label>}
    </ProfileSection>
    <div className="sticky bottom-0 z-20 space-y-3 rounded-2xl border border-leaf/25 bg-cream/95 p-4 shadow-lift backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
      {message && <FormNotice kind="error">{message}</FormNotice>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-ink/70">{portraitBusy ? "Preparing your photo…" : saving ? "Saving your profile…" : dirty ? "You have unsaved changes" : "Your profile details"}</p><button type="submit" disabled={saving || portraitBusy} className={`${primaryButton} w-full sm:w-auto`}>{saving ? "Saving…" : isExisting ? "Save changes" : "Create chef profile"}</button></div>
    </div>
    <dialog ref={leaveDialog} aria-labelledby="unsaved-heading" onCancel={(event) => { event.preventDefault(); navigation.stay(); }} onClose={navigation.stay} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl bg-cream p-6 text-ink shadow-lift backdrop:bg-forest/70">
      <h2 id="unsaved-heading" className="text-xl font-bold">Leave without saving?</h2><p className="mt-3 text-sm leading-relaxed text-ink/75">Your profile changes haven’t been saved. Stay here to save them, or discard them and leave.</p><div className="mt-5 flex flex-wrap gap-3"><button ref={keepEditing} type="button" onClick={navigation.stay} className={outlineButton}>Keep editing</button><button type="button" onClick={navigation.leave} className={dangerButton}>Discard and leave</button></div>
    </dialog>
  </form>;
}
