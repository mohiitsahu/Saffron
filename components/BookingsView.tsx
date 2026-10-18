"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookingView } from "@/lib/bookings";
import BookingTicket from "@/components/BookingTicket";
import { primaryButton } from "@/lib/ui";

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
        {items.map((booking) => (
          <BookingTicket key={booking.id} booking={booking} />
        ))}
      </div>
    </section>
  );
}

function History({ items, startOpen }: { items: BookingView[]; startOpen: boolean }) {
  const [show, setShow] = useState(startOpen);
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
      <p className="text-sm text-ink/70">Completed and cancelled bookings. Tap one to see the details.</p>
      {show && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2 xl:items-start">
          {items.map((booking) => (
            <BookingTicket key={booking.id} booking={booking} collapsible defaultOpen={false} />
          ))}
        </div>
      )}
    </section>
  );
}

function BookingList({ items, perspective }: { items: BookingView[]; perspective: Perspective }) {
  const needs = items.filter((b) => b.status === "REQUESTED");
  const confirmed = items.filter((b) => b.status === "ACCEPTED");
  const toReview =
    perspective === "customer"
      ? items.filter((b) => b.status === "COMPLETED" && b.reviewRating === null)
      : [];
  const history = items.filter(
    (b) => b.status !== "REQUESTED" && b.status !== "ACCEPTED" && !toReview.includes(b)
  );
  const hasActive = needs.length + confirmed.length + toReview.length > 0;

  return (
    <div>
      <Group
        title={perspective === "chef" ? "Needs your answer" : "Waiting for the chef"}
        hint={
          perspective === "chef"
            ? "Accept to share your phone number and get the customer's address, or decline if you can't take it."
            : "The chef will accept or decline soon. You can cancel the request until then."
        }
        items={needs}
      />
      <Group title="Confirmed" items={confirmed} />
      <Group
        title="Waiting for your review"
        hint="Tell others how your meal went."
        items={toReview}
      />
      <History items={history} startOpen={!hasActive} />
    </div>
  );
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

  const waiting = asChef.filter((b) => b.status === "REQUESTED" && !b.eventPassed).length;
  const mineOpen = asCustomer.filter(isOpen).length;

  const tabClass = (active: boolean) =>
    `-mb-px flex min-h-[44px] items-center gap-2 border-b-2 px-4 text-base font-semibold transition-colors ${
      active ? "border-leaf text-leaf" : "border-transparent text-ink/70 hover:text-ink"
    }`;

  return (
    <div>
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
            <div className="max-w-3xl rounded-2xl border-2 border-dashed border-leaf/60 bg-sage/70 p-6">
              <h2 className="text-lg font-bold">No requests yet</h2>
              <p className="mt-1 text-ink/80">They will appear here when customers book you.</p>
            </div>
          ) : (
            <BookingList items={asChef} perspective="chef" />
          )
        ) : asCustomer.length === 0 ? (
          <div className="max-w-3xl rounded-2xl border-2 border-dashed border-leaf/60 bg-sage/70 p-6">
            <h2 className="text-lg font-bold">No bookings yet</h2>
            <p className="mt-1 text-ink/80">Your requests will show up here as tickets, with their status.</p>
            <Link href="/chefs" className={`${primaryButton} mt-4`}>
              Find a chef
            </Link>
          </div>
        ) : (
          <BookingList items={asCustomer} perspective="customer" />
        )}
      </div>
    </div>
  );
}