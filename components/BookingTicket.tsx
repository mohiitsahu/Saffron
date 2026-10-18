"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingView } from "@/lib/bookings";
import { formatDateTimeIST, formatINR } from "@/lib/format";
import { dangerButton, primaryButton } from "@/lib/ui";
import ReviewForm from "@/components/ReviewForm";

const STATUS: Record<BookingView["status"], { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-saffron text-ink" },
  ACCEPTED: { label: "Accepted", className: "bg-leaf text-white" },
  COMPLETED: { label: "Completed", className: "bg-sage text-ink" },
  DECLINED: { label: "Declined", className: "border border-danger text-danger" },
  CANCELLED: { label: "Cancelled", className: "border border-danger text-danger" },
};

export default function BookingTicket({
  booking,
  collapsible = false,
  defaultOpen = true,
}: {
  booking: BookingView;
  // Past bookings show one summary line and expand when tapped.
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isChef = booking.role === "chef";
  const canAnswer = isChef && booking.status === "REQUESTED";
  const canCancel = booking.status === "REQUESTED" || booking.status === "ACCEPTED";
  const canComplete = booking.status === "ACCEPTED" && booking.eventPassed;
  const status = STATUS[booking.status];
  const shortId = booking.id.slice(-6).toUpperCase();
  const roleLabel = isChef ? "Customer: " : "Chef: ";
  const cancelledText =
    booking.cancelledBy === "you"
      ? "Cancelled by you"
      : booking.cancelledBy === "other"
        ? `Cancelled by the ${isChef ? "customer" : "chef"}`
        : null;
  const summary = `${formatDateTimeIST(booking.eventDate)} · ${booking.guests} ${
    booking.guests === 1 ? "guest" : "guests"
  } · ${formatINR(booking.estimatedTotal)}`;
  const requestedLine = `Requested ${formatDateTimeIST(booking.createdAt)}${
    cancelledText ? ` · ${cancelledText}` : ""
  }`;

  async function act(action: "accept" | "cancel" | "complete", confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const cancelConfirm = isChef
    ? "Cancel this booking? The customer will see that you cancelled it."
    : "Cancel this booking?";

  const body = (
    <>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">When</dt>
          <dd className="font-semibold">{formatDateTimeIST(booking.eventDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Guests</dt>
          <dd className="font-semibold">{booking.guests}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Area</dt>
          <dd className="font-semibold">{booking.area}</dd>
        </div>
      </dl>

      {booking.notes && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Food notes: </span>
          {booking.notes}
        </p>
      )}

      <div className="mt-4 space-y-1 border-t-2 border-dashed border-leaf/50 pt-4 text-sm">
        {booking.address && (
          <p>
            <span className="font-semibold">{isChef ? "Address: " : "Your address: "}</span>
            {booking.address}
          </p>
        )}
        {booking.contactPhone && (
          <p>
            <span className="font-semibold">{isChef ? "Customer's phone: " : "Chef's phone: "}</span>
            <a href={`tel:${booking.contactPhone}`} className="underline underline-offset-4">
              {booking.contactPhone}
            </a>
          </p>
        )}
        {!booking.contactRevealed && booking.status === "REQUESTED" && (
          <p className="text-ink/70">
            {isChef
              ? "The full address and phone number appear here once you accept."
              : "The chef's phone number is shared once they accept."}
          </p>
        )}
        <p className="pt-2">
          <span className="font-semibold">Estimated total: </span>
          {formatINR(booking.estimatedTotal)}{" "}
          <span className="text-ink/70">Groceries and extras are agreed with the chef.</span>
        </p>
        {booking.status === "ACCEPTED" && (
          <p className="text-ink/70">Pay the chef directly (UPI or cash) after the meal.</p>
        )}
        {collapsible && !isChef && booking.chefProfileId && (
          <p className="pt-1">
            <Link href={`/chefs/${booking.chefProfileId}`} className="font-medium text-leaf underline underline-offset-4">
              View chef profile
            </Link>
          </p>
        )}
      </div>

      {(canCancel || canComplete) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {canAnswer && (
            <button type="button" disabled={busy} onClick={() => act("accept")} className={primaryButton}>
              Accept
            </button>
          )}
          {canComplete && (
            <button type="button" disabled={busy} onClick={() => act("complete")} className={primaryButton}>
              Mark as completed
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act("cancel", cancelConfirm)}
              className={dangerButton}
            >
              {canAnswer ? "Cancel" : "Cancel booking"}
            </button>
          )}
        </div>
      )}

      {booking.status === "ACCEPTED" && !booking.eventPassed && (
        <p className="mt-3 text-xs text-ink/70">You can mark this completed after the event time.</p>
      )}

      {booking.status === "COMPLETED" && booking.reviewRating !== null && (
        <p className="mt-4 border-t-2 border-dashed border-leaf/50 pt-4 text-sm">
          <span className="font-semibold">{isChef ? "Customer's rating: " : "Your rating: "}</span>
          <span className="text-saffron" aria-label={`${booking.reviewRating} out of 5 stars`}>
            {"★".repeat(booking.reviewRating)}
            {"☆".repeat(5 - booking.reviewRating)}
          </span>
        </p>
      )}

      {booking.status === "COMPLETED" && booking.reviewRating === null && !isChef && (
        <ReviewForm bookingId={booking.id} />
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );

  const badge = (
    <span className={`flex-none rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
      {status.label}
    </span>
  );

  if (collapsible) {
    return (
      <article className="rounded-2xl border border-leaf/30 bg-cream p-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 rounded-lg text-left"
        >
          <span className="min-w-0">
            <span className="block font-heading text-xs font-bold uppercase tracking-widest text-leaf">
              Order ticket · #{shortId}
            </span>
            <span className="mt-1 block text-lg font-bold">
              {roleLabel}
              {booking.counterpartName}
            </span>
            <span className="mt-0.5 block text-xs text-ink/70">{requestedLine}</span>
            <span className="mt-2 block text-sm text-ink/80">{summary}</span>
          </span>
          <span className="flex flex-none flex-col items-end gap-2">
            {badge}
            <span aria-hidden="true" className="text-xs text-ink/60">
              {open ? "Hide ▲" : "Details ▼"}
            </span>
          </span>
        </button>
        {open && <div className="mt-4 border-t border-dashed border-leaf/50 pt-4">{body}</div>}
      </article>
    );
  }

  return (
    <article className="rounded-2xl border-2 border-dashed border-leaf/60 bg-cream p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-leaf">
            Order ticket · #{shortId}
          </p>
          <h3 className="mt-1 text-xl font-bold">
            {roleLabel}
            {!isChef && booking.chefProfileId ? (
              <Link href={`/chefs/${booking.chefProfileId}`} className="underline underline-offset-4">
                {booking.counterpartName}
              </Link>
            ) : (
              booking.counterpartName
            )}
          </h3>
          <p className="mt-0.5 text-xs text-ink/70">{requestedLine}</p>
        </div>
        {badge}
      </div>
      <div className="mt-4">{body}</div>
    </article>
  );
}