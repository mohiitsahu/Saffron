"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookingView } from "@/lib/bookings";
import BookingTicket from "@/components/BookingTicket";
import BookingFeedback from "@/components/BookingFeedback";
import { outlineButton, primaryButton } from "@/lib/ui";

type Tab = "requests" | "mine";
type Perspective = "chef" | "customer";

const isOpen = (b: BookingView) => b.status === "REQUESTED" || b.status === "ACCEPTED";

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-ink">{n}</span>;
}

function Group({ title, hint, items }: { title: string; hint?: string; items: BookingView[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        <Count n={items.length} />
      </div>
      {hint && <p className="mt-1 text-sm text-ink/70">{hint}</p>}
      <div
        className={`mt-4 grid gap-4 ${items.length > 1 ? "xl:grid-cols-2 xl:items-start" : "max-w-3xl"}`}
      >
        {items.map((booking, i) => (
          <div
            key={booking.id}
            className="animate-fade-up"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <BookingTicket booking={booking} />
          </div>
        ))}
      </div>
    </section>
  );
}

function History({ items, startOpen }: { items: BookingView[]; startOpen: boolean }) {
  const [show, setShow] = useState(startOpen);
  const [limit, setLimit] = useState(6);
  // After the last active booking is cancelled or completed, show where it went.
  useEffect(() => {
    if (startOpen) setShow(true);
  }, [startOpen]);
  if (items.length === 0) return null;

  return (
    <section className="mt-10 border-t border-leaf/20 pt-6">
      <button
        type="button"
        aria-expanded={show}
        onClick={() => setShow((v) => !v)}
        className="flex min-h-[44px] items-center gap-2 text-xl font-bold"
      >
        History
        <Count n={items.length} />
        <span aria-hidden="true" className="text-sm font-normal text-ink/60">
          {show ? "▲" : "▼"}
        </span>
      </button>
      <p className="text-sm text-ink/70">Past bookings, newest first. Open a ticket to see the details.</p>
      {show && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2 xl:items-start">
          {items.slice(0, limit).map((booking) => (
            <BookingTicket key={booking.id} booking={booking} collapsible defaultOpen={false} />
          ))}
        </div>
      )}
      {show && items.length > limit && <button type="button" onClick={() => setLimit((value) => value + 6)} className={`${outlineButton} mt-4`}>Show more history ({items.length - limit} remaining)</button>}
    </section>
  );
}

function BookingList({ items, perspective }: { items: BookingView[]; perspective: Perspective }) {
  const [filter, setFilter] = useState("all");
  const upcoming = [...items].sort((a, b) => Date.parse(a.eventDate) - Date.parse(b.eventDate));
  const needs = upcoming.filter((b) => b.status === "REQUESTED" && !b.proposedEventDate);
  const proposals = upcoming.filter((b) => b.status === "REQUESTED" && b.proposedEventDate);
  const toComplete = upcoming.filter((b) => perspective === "chef" && b.status === "ACCEPTED" && b.eventPassed);
  const confirmed = upcoming.filter((b) => b.status === "ACCEPTED" && !toComplete.includes(b));
  const toReview = perspective === "customer" ? items.filter((b) => b.status === "COMPLETED" && b.reviewRating === null) : [];
  const history = items.filter((b) => !isOpen(b) && !toReview.includes(b))
    .sort((a, b) => Date.parse(b.eventDate) - Date.parse(a.eventDate));
  const hasActive = needs.length + proposals.length + confirmed.length + toReview.length + toComplete.length > 0;
  const actionCount = (perspective === "chef" ? needs.length : proposals.length) + toReview.length + toComplete.length;
  const filters = [
    { id: "all", label: "All bookings", count: items.length },
    { id: "action", label: "Needs your action", count: actionCount },
    { id: "confirmed", label: "Confirmed", count: confirmed.length + toComplete.length },
    { id: "history", label: "History", count: history.length },
  ];
  const showNeeds = filter === "all" || (filter === "action" && perspective === "chef");
  const showProposals = filter === "all" || (filter === "action" && perspective === "customer");
  const hasResults = filter === "all" || filters.find((item) => item.id === filter)!.count > 0;

  return <div>
    <div role="group" aria-label="Filter bookings" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
        className={`rounded-2xl border p-4 text-left transition-colors ${filter === item.id ? "border-leaf bg-forest text-cream shadow-soft" : "border-leaf/20 bg-white/60 hover:border-leaf/60"}`}>
        <span className="block text-2xl font-bold">{item.count}</span>
        <span className={`mt-1 block text-sm ${filter === item.id ? "text-cream/80" : "text-ink/70"}`}>{item.label}</span>
      </button>)}
    </div>
    {!hasResults && <div className="rounded-2xl border border-leaf/20 bg-sage/40 p-6">
      <h2 className="text-lg font-bold">{filter === "action" ? "You’re all caught up" : filter === "confirmed" ? "No confirmed bookings yet" : "No past bookings yet"}</h2>
      <p className="mt-1 text-sm text-ink/70">{filter === "action" ? "There’s nothing you need to respond to right now." : "Choose All bookings to see your other requests."}</p>
    </div>}
    {showProposals && perspective === "customer" && <Group title="New time to review" hint="Accept the chef’s suggested time to confirm, or decline to close the request." items={proposals} />}
    {showNeeds && <Group title={perspective === "chef" ? "Needs your answer" : "Waiting for the chef"}
      hint={perspective === "chef" ? "Accept to share contact details, suggest a different time, or decline if you can’t take it." : "The chef will accept or decline soon. You can cancel the request until then."} items={needs} />}
    {(filter === "all" || filter === "action" || filter === "confirmed") && <Group title="Ready to complete" hint="The event time has passed. Mark the meal completed so the customer can leave a review." items={toComplete} />}
    {(filter === "all" || filter === "action") && <Group title="Waiting for your review" hint="Tell others how your meal went." items={toReview} />}
    {(filter === "all" || filter === "confirmed") && <Group title="Confirmed" hint="Ordered by event date, soonest first." items={confirmed} />}
    {showProposals && perspective === "chef" && <Group title="Waiting for the customer" hint="The customer must agree to your suggested time before it is confirmed." items={proposals} />}
    {(filter === "all" || filter === "history") && <History items={history} startOpen={filter === "history" || !hasActive} />}
  </div>;
}

export default function BookingsView({
  asChef,
  asCustomer,
  showChefTabs,
  initialTab,
}: {
  asChef: BookingView[];
  asCustomer: BookingView[];
  showChefTabs: boolean;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(showChefTabs ? initialTab : "mine");

  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  const waiting = asChef.filter((b) => b.status === "REQUESTED" && !b.eventPassed && !b.proposedEventDate).length;
  const mineOpen = asCustomer.filter(isOpen).length;

  const tabClass = (active: boolean) =>
    `-mb-px flex min-h-[44px] items-center gap-2 rounded-t-lg border-b-2 px-4 text-base font-semibold transition-all duration-200 ${
      active ? "border-leaf bg-leaf/5 text-leaf" : "border-transparent text-ink/70 hover:bg-sage/50 hover:text-ink"
    }`;

  return (
    <BookingFeedback>
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/70">{refreshing ? "Updating your bookings…" : "Check replies, manage your meals, and review past bookings."}</p>
        <button type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className={outlineButton}>{refreshing ? "Refreshing…" : "Refresh bookings"}</button>
      </div>
      {showChefTabs && (
        <div role="group" aria-label="Choose which bookings to show" className="flex flex-wrap gap-2 border-b border-leaf/20">
          <button
            type="button"
            aria-pressed={tab === "requests"}
            onClick={() => setTab("requests")}
            className={tabClass(tab === "requests")}
          >
            Requests for you
            {waiting > 0 && (
              <span className="rounded-full bg-saffron px-2.5 py-0.5 text-xs font-bold text-ink">
                {waiting} new
              </span>
            )}
          </button>
          <button
            type="button"
            aria-pressed={tab === "mine"}
            onClick={() => setTab("mine")}
            className={tabClass(tab === "mine")}
          >
            Chefs I&apos;ve booked
            {mineOpen > 0 && <Count n={mineOpen} />}
          </button>
        </div>
      )}

      <div className="mt-6">
        {tab === "requests" ? (
          asChef.length === 0 ? (
            <div className="max-w-3xl animate-scale-in rounded-2xl border-2 border-dashed border-leaf/60 bg-sage/70 p-6 shadow-soft">
              <h2 className="text-lg font-bold">No requests yet</h2>
              <p className="mt-1 text-ink/80">They will appear here when customers book you.</p>
            </div>
          ) : (
            <BookingList key="chef" items={asChef} perspective="chef" />
          )
        ) : asCustomer.length === 0 ? (
          <div className="max-w-3xl animate-scale-in rounded-2xl border-2 border-dashed border-leaf/60 bg-sage/70 p-6 shadow-soft">
            <h2 className="text-lg font-bold">No bookings yet</h2>
            <p className="mt-1 text-ink/80">Your requests will show up here as tickets, with their status.</p>
            <Link href="/chefs" className={`${primaryButton} mt-4`}>
              Find a chef
            </Link>
          </div>
        ) : (
          <BookingList key="customer" items={asCustomer} perspective="customer" />
        )}
      </div>
    </div>
    </BookingFeedback>
  );
}
