"use client";

import { useState } from "react";
import { inputClass, labelClass, outlineButton, primaryButton } from "@/lib/ui";

// "2030-11-02" -> "Sat, 2 Nov 2030"
function prettyDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${day}T00:00:00+05:30`));
}

export default function AvailabilityManager({
  initialDays,
  today,
}: {
  initialDays: string[]; // upcoming days off, soonest first
  today: string; // today's date in India, like "2030-11-02"
}) {
  const [days, setDays] = useState(initialDays);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function call(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/chef/availability", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work. Try again.");
        return null;
      }
      setDays(data.days);
      return data as { days: string[]; clashes?: number };
    } catch {
      setError("Network problem. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!from) {
      setError("Choose the first day.");
      return;
    }
    const data = await call("POST", { from, to: to || undefined });
    if (!data) return;
    setFrom("");
    setTo("");
    if (data.clashes && data.clashes > 0) {
      setNotice(
        `Saved. You already accepted ${data.clashes} ${
          data.clashes === 1 ? "booking" : "bookings"
        } in that period. Those stay booked, so cancel them under My bookings if you can't do them.`
      );
    }
  }

  return (
    <section className="rounded-2xl bg-sage p-5" aria-labelledby="availability-heading">
      <h2 id="availability-heading" className="font-bold">
        Days you&apos;re unavailable
      </h2>
      <p className="mt-1 text-sm text-ink/70">
        Customers can&apos;t request these days. Bookings you&apos;ve already accepted stay as they are.
      </p>

      <form onSubmit={onAdd} className="mt-4 space-y-3" noValidate>
        <div>
          <label htmlFor="block-from" className={labelClass}>
            From
          </label>
          <input
            id="block-from"
            type="date"
            min={today}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="block-to" className={labelClass}>
            To <span className="font-normal text-ink/60">(optional, for several days)</span>
          </label>
          <input
            id="block-to"
            type="date"
            min={from || today}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? "Saving..." : "Block these days"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 text-sm font-medium text-ink" role="status">
          {notice}
        </p>
      )}

      {days.length === 0 ? (
        <p className="mt-4 text-sm text-ink/70">No days blocked. Customers can request any day.</p>
      ) : (
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
          {days.map((day) => (
            <li
              key={day}
              className="flex items-center justify-between gap-2 rounded-lg bg-cream px-3 py-2 text-sm"
            >
              <span>{prettyDay(day)}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => call("DELETE", { day })}
                aria-label={`Open ${prettyDay(day)} again`}
                className={`${outlineButton} !min-h-[36px] !px-3 !py-1 text-sm`}
              >
                Open again
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
