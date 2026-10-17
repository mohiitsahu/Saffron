"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { inputClass, labelClass, outlineButton, primaryButton } from "@/lib/ui";

type Props = {
  chefProfileId: string;
  chefName: string;
  pricePerPerson: number;
  maxGuests: number;
  viewer: "guest" | "owner" | "customer";
  existingStatus: "REQUESTED" | "ACCEPTED" | "DECLINED" | null;
};

const ticketClass = "rounded-xl border-2 border-dashed border-leaf bg-sage/20 p-5";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
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

export default function BookingForm({
  chefProfileId,
  chefName,
  pricePerPerson,
  maxGuests,
  viewer,
  existingStatus,
}: Props) {
  const [eventDate, setEventDate] = useState("");
  const [guests, setGuests] = useState(String(Math.min(2, maxGuests)));
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [minDate, setMinDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Earliest allowed time is 24 hours from now. Set after mount to avoid a server/browser mismatch.
  useEffect(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setMinDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, []);

  const guestsNumber = Number(guests);
  const guestsValid = Number.isInteger(guestsNumber) && guestsNumber >= 1 && guestsNumber <= maxGuests;
  const estimate = guestsValid ? guestsNumber * pricePerPerson : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setErrors({});
    setMessage("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chefProfileId,
          eventDate,
          guests: guestsNumber,
          area,
          address,
          phone,
          notes,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setMessage(data.error ?? "Could not send your request. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setMessage("Network problem. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (viewer === "guest") {
    return (
      <section id="book" className={ticketClass}>
        <h2 className="text-xl font-bold">Book this chef</h2>
        <p className="mt-1 text-sm text-ink/80">Sign in with Google to send a booking request.</p>
        <a
          href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/chefs/${chefProfileId}`)}`}
          className={`${primaryButton} mt-4`}
        >
          Sign in to request
        </a>
      </section>
    );
  }

  if (viewer === "owner") {
    return (
      <section id="book" className={ticketClass}>
        <h2 className="text-xl font-bold">This is your profile</h2>
        <p className="mt-1 text-sm text-ink/80">Customers will see a booking form here. You can&apos;t book yourself.</p>
      </section>
    );
  }

  if (existingStatus && !sent) {
    return (
      <section id="book" className={ticketClass}>
        <h2 className="text-xl font-bold">
          {existingStatus === "REQUESTED" && "Request sent"}
          {existingStatus === "ACCEPTED" && "Booking accepted"}
          {existingStatus === "DECLINED" && "Request declined"}
        </h2>
        <p className="mt-1 text-ink/80">
          {existingStatus === "REQUESTED" &&
            `You've already sent a request to ${chefName}. They'll accept or decline it soon. Track it under My bookings.`}
          {existingStatus === "ACCEPTED" &&
            `${chefName} accepted your request. You can see the details and their phone number under My bookings.`}
          {existingStatus === "DECLINED" &&
            `${chefName} declined your earlier request, so you can't send another one to this chef. Try another chef.`}
        </p>
        <Link
          href={existingStatus === "DECLINED" ? "/chefs" : "/bookings"}
          className={`${outlineButton} mt-4`}
        >
          {existingStatus === "DECLINED" ? "Find another chef" : "Go to My bookings"}
        </Link>
      </section>
    );
  }

  if (sent) {
    return (
      <section id="book" className={ticketClass} aria-live="polite">
        <h2 className="text-xl font-bold">Request sent</h2>
        <p className="mt-1 text-ink/80">
          {chefName} will accept or decline. You&apos;ll see the answer under My bookings. Their phone number
          and your full address are shared only after they accept.
        </p>
        <Link href="/bookings" className={`${outlineButton} mt-4`}>
          Go to My bookings
        </Link>
      </section>
    );
  }

  return (
    <section id="book" aria-labelledby="book-heading" className={ticketClass}>
      <h2 id="book-heading" className="text-xl font-bold">
        Booking ticket
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        {chefName} can cook for up to {maxGuests} guests. Times are in IST.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Date and time" htmlFor="b-date" error={errors.eventDate} hint="At least 24 hours from now.">
          <input
            id="b-date"
            type="datetime-local"
            min={minDate || undefined}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Number of guests"
          htmlFor="b-guests"
          error={errors.guests}
          hint={`Choose 1 to ${maxGuests}.`}
        >
          <input
            id="b-guests"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxGuests}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Area" htmlFor="b-area" error={errors.area} hint="Neighbourhood, for example: Arera Colony">
          <input id="b-area" value={area} onChange={(e) => setArea(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Your phone number" htmlFor="b-phone" error={errors.phone} hint="Shared with the chef only after they accept.">
          <input
            id="b-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Full address"
          htmlFor="b-address"
          error={errors.address}
          hint="Shared with the chef only after they accept."
          className="sm:col-span-2"
        >
          <textarea
            id="b-address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Food notes or allergies" htmlFor="b-notes" error={errors.notes} className="sm:col-span-2">
          <textarea
            id="b-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex flex-col gap-3 border-t-2 border-dashed border-leaf pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Estimated total
            <span className="block text-xl font-bold">{estimate !== null ? formatINR(estimate) : "—"}</span>
            <span className="text-xs text-ink/70">
              {guestsValid ? `${guestsNumber} ${guestsNumber === 1 ? "guest" : "guests"} × ${formatINR(pricePerPerson)}. ` : ""}
              Groceries and extras are agreed with the chef. You pay the chef directly after the meal.
            </span>
          </p>
          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? "Sending..." : "Send request"}
          </button>
        </div>

        {message && (
          <p role="alert" className="font-medium text-danger sm:col-span-2">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}