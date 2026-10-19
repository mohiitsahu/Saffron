"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookingView } from "@/lib/bookings";
import { bookingDateLimits, formatDateTimeIST } from "@/lib/format";
import { inputClass, outlineButton, primaryButton, dangerButton } from "@/lib/ui";
import { useBookingFeedback } from "@/components/BookingFeedback";

export default function BookingTimeProposal({ booking }: { booking: BookingView }) {
  const router = useRouter();
  const notify = useBookingFeedback();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [limits, setLimits] = useState({ min: "", max: "" });
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => setLimits(bookingDateLimits()), []);
  if (booking.status !== "REQUESTED") return null;
  async function act(action: "propose" | "accept" | "decline" | "withdraw") {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/bookings/${booking.id}/proposal`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "propose" ? { action, eventDate: date } : { action, expectedDate: booking.proposedEventDate }) });
      const data = await res.json(); if (!res.ok) throw Error(data.error ?? "Could not update the time.");
      setEditing(false);
      notify?.({ title: ({ propose: "New time suggested", accept: "New time confirmed", decline: "New time declined", withdraw: "Suggestion withdrawn" })[action],
        detail: action === "accept" ? "Your booking is confirmed. Contact details are now available." : action === "decline" ? "This request is closed and is in History." : "The request has been updated for both of you." });
      startRefresh(() => router.refresh());
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-xl border border-leaf/30 bg-sage/45 p-4" aria-label="Alternative booking time">
    {booking.proposedEventDate ? <>
      <h4 className="font-bold">{booking.role === "chef" ? "Your suggested time" : "The chef suggested a new time"}</h4>
      <p className="mt-1 font-semibold">{formatDateTimeIST(booking.proposedEventDate)} IST</p>
      <p className="mt-2 text-sm text-ink/75">This time is confirmed only when the customer accepts. Price and guest count stay the same.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {booking.role === "customer" ? <><button disabled={busy || refreshing} className={primaryButton} onClick={() => act("accept")}>Accept new time</button>
          <button disabled={busy || refreshing} className={dangerButton} onClick={() => act("decline")}>Decline new time</button></>
          : <button disabled={busy || refreshing} className={outlineButton} onClick={() => act("withdraw")}>Withdraw suggestion</button>}
      </div>
      {booking.role === "customer" && <p className="mt-2 text-xs text-ink/70">Declining closes this request. You can send a new request afterward.</p>}
    </> : booking.role === "chef" && !booking.eventPassed ? <>
      <button className="min-h-11 font-semibold text-leaf underline" onClick={() => setEditing(!editing)} aria-expanded={editing}>Suggest another time</button>
      {editing && <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); void act("propose"); }}>
        <label className="block text-sm font-medium" htmlFor={`proposal-${booking.id}`}>New date and time (IST)</label>
        <input id={`proposal-${booking.id}`} type="datetime-local" min={limits.min || undefined} max={limits.max || undefined} required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <p className="text-xs text-ink/70">At least 24 hours ahead. Your customer must agree before this becomes a confirmed booking.</p>
        <button disabled={busy || refreshing} className={outlineButton}>{busy ? "Sending…" : "Send time suggestion"}</button>
      </form>}
    </> : <p className="text-sm text-ink/70">The chef can suggest a different time before answering.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </section>;
}
