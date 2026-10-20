"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { istDayKey } from "@/lib/availability";
import { validateMealSearch, type MealSearch } from "@/lib/mealSearch";
import { inputClass, labelClass, outlineButton, primaryButton } from "@/lib/ui";

export default function MealSearchPicker({ value, onApply, pending }: { value: MealSearch; onApply: (meal: MealSearch) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const uid = useId();
  const active = Boolean(value.date || value.time || value.guests);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function positionPanel() {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = dialog.current?.getBoundingClientRect().height || 460;
      setPosition({ "--meal-left": `${Math.max(16, Math.min(anchor.left, window.innerWidth - 416))}px`,
        "--meal-top": `${Math.max(16, Math.min(anchor.bottom + 8, window.innerHeight - height - 16))}px` } as CSSProperties);
    }
    dialog.current?.showModal();
    positionPanel();
    heading.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", positionPanel);
    return () => { document.body.style.overflow = previous; window.removeEventListener("resize", positionPanel); };
  }, [open]);

  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  const minDay = istDayKey(new Date(Date.now() + 86_400_000));
  const maxDay = istDayKey(new Date(Date.now() + 365 * 86_400_000));

  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${uid}-dialog`}
      onClick={() => { setError(""); setOpen(true); }}
      className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors sm:text-base ${active ? "border-leaf bg-leaf/10 text-leaf" : "border-leaf/30 hover:bg-sage"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
      Date &amp; guests
      {active && <><span aria-hidden="true" className="h-2 w-2 rounded-full bg-leaf" /><span className="sr-only">, meal details applied</span></>}
    </button>
    {mounted && createPortal(<dialog ref={dialog} id={`${uid}-dialog`} aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-hint`}
      onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}
      onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } }}
      style={position}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-leaf/20 bg-cream p-0 text-ink shadow-2xl backdrop:bg-forest/30 md:bottom-auto md:left-[var(--meal-left)] md:right-auto md:top-[var(--meal-top)] md:max-h-[calc(100dvh_-_var(--meal-top)_-_16px)] md:w-[400px] md:rounded-2xl">
      {open && <form onInput={() => { if (error) setError(""); }} onReset={(event) => {
        event.preventDefault();
        event.currentTarget.querySelectorAll("input").forEach((input) => { input.value = ""; });
        setError("");
      }} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const draft = { date: String(data.get("date") ?? ""), time: String(data.get("time") ?? ""), guests: String(data.get("guests") ?? "") };
        const result = validateMealSearch(draft);
        if (result.error) { setError(result.error); return; }
        onApply(draft); close();
      }}>
        <div className="flex items-start justify-between gap-3 border-b border-leaf/15 px-5 pb-4 pt-5">
          <div><h2 ref={heading} tabIndex={-1} id={`${uid}-title`} className="text-xl font-bold focus:outline-none">When’s your meal?</h2><p id={`${uid}-hint`} className="mt-1 text-sm text-ink/65">Choose any details to check availability. Times are in IST.</p></div>
          <button type="button" onClick={close} aria-label="Close meal details" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sage">✕</button>
        </div>
        <div className="space-y-4 p-5">
          <div className="min-w-0"><label htmlFor={`${uid}-date`} className={labelClass}>Meal date <span className="font-normal text-ink/60">(optional)</span></label><input id={`${uid}-date`} name="date" type="date" min={minDay} max={maxDay} defaultValue={value.date} className={inputClass} /></div>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <div className="min-w-0"><label htmlFor={`${uid}-time`} className={labelClass}>Time (optional)</label><input id={`${uid}-time`} name="time" type="time" defaultValue={value.time} className={inputClass} /></div>
            <div className="min-w-0"><label htmlFor={`${uid}-guests`} className={labelClass}>Guests (optional)</label><input id={`${uid}-guests`} name="guests" type="number" inputMode="numeric" min="1" max="100" step="1" placeholder="Any" defaultValue={value.guests} className={inputClass} /></div>
          </div>
          <p className="text-xs leading-relaxed text-ink/65">Plan at least 24 hours ahead. You can also browse without choosing a date.</p>
          {error && <p role="alert" className="rounded-lg bg-danger/5 p-3 text-sm text-danger">{error}</p>}
        </div>
        <div className="flex gap-3 border-t border-leaf/15 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button type="reset" className={outlineButton}>Clear</button>
          <button type="submit" disabled={pending} className={`${primaryButton} flex-1`}>{pending ? "Updating…" : "Show chefs"}</button>
        </div>
      </form>}
    </dialog>, document.body)}
  </>;
}
