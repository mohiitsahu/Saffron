"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bookingDateLimits, formatINR } from "@/lib/format";
import { inputClass, labelClass, outlineButton, primaryButton } from "@/lib/ui";
import CancellationNote from "@/components/CancellationNote";
import FormNotice from "@/components/FormNotice";
import MobileBookingBar from "@/components/MobileBookingBar";

type Props = {
  chefProfileId: string;
  chefName: string;
  pricePerPerson: number;
  maxGuests: number;
  viewer: "guest" | "owner" | "customer";
  existingStatus: "REQUESTED" | "ACCEPTED" | null;
  // Days the chef has marked unavailable, like "2030-11-02", soonest first.
  unavailableDays: string[];
  initialEventDate?: string;
  initialGuests?: number;
};

const ticketClass = "rounded-2xl border border-leaf/30 bg-cream p-5 shadow-soft sm:p-6";

// "2030-11-02" -> "2 Nov"
function shortDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(`${day}T00:00:00+05:30`)
  );
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
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-help`} className="mt-1 text-xs text-ink/70">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-help`} className="mt-1 animate-fade-in text-sm font-medium text-danger" role="alert">
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
  unavailableDays,
  initialEventDate = "",
  initialGuests,
}: Props) {
  const [eventDate, setEventDate] = useState(initialEventDate);
  const [guests, setGuests] = useState(String(initialGuests ?? Math.min(2, maxGuests)));
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Earliest allowed time is 24 hours from now. Set after mount to avoid a server/browser mismatch.
  useEffect(() => {
    const update = () => {
      const limits = bookingDateLimits();
      setMinDate(limits.min);
      setMaxDate(limits.max);
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (Object.keys(errors).length) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [errors]);

  // The date field gives "2030-11-02T19:30". The first 10 characters are the day.
  const pickedUnavailable = eventDate.length >= 10 && unavailableDays.includes(eventDate.slice(0, 10));
  const shownDays = unavailableDays.slice(0, 6).map(shortDay).join(", ");
  const moreDays = unavailableDays.length - 6;

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
      <><section id="book" className={ticketClass}>
        <h2 id="book-heading" tabIndex={-1} className="text-xl font-bold">Request {chefName}</h2>
        <p className="mt-1 text-sm text-ink/80">
          Sign in with Google to send a request. You won&apos;t be charged, and your address stays private
          until the chef accepts.
        </p>
        <a
          href={`/signin?callbackUrl=${encodeURIComponent(`/chefs/${chefProfileId}`)}`}
          className={`${primaryButton} mt-4 w-full`}
        >
          Sign in to request
        </a>
      </section><MobileBookingBar pricePerPerson={pricePerPerson} /></>
    );
  }

  if (viewer === "owner") {
    return (
      <section id="book" className={ticketClass}>
        <h2 className="text-xl font-bold">This is your profile</h2>
        <p className="mt-1 text-sm text-ink/80">
          Customers will see a booking form here. You can&apos;t book yourself.
        </p>
      </section>
    );
  }

  if (existingStatus && !sent) {
    return (
      <section id="book" className={ticketClass}>
        <h2 className="text-xl font-bold">
          {existingStatus === "REQUESTED" && "Request sent"}
          {existingStatus === "ACCEPTED" && "Booking accepted"}
        </h2>
        <p className="mt-1 text-ink/80">
          {existingStatus === "REQUESTED" &&
            `You've already sent a request to ${chefName}. They'll accept or decline it soon. Track it under My bookings.`}
          {existingStatus === "ACCEPTED" &&
            `${chefName} accepted your request. You can see the details and their phone number under My bookings.`}
        </p>
        <Link href="/bookings" className={`${outlineButton} mt-4 w-full`}>
          Go to My bookings
        </Link>
      </section>
    );
  }

  if (sent) {
    return (
      <section id="book" className={`${ticketClass} animate-scale-in`} aria-live="polite">
        <h2 className="text-xl font-bold">Request sent</h2>
        <p className="mt-1 text-ink/80">
          {chefName} will accept or decline. You&apos;ll see the answer under My bookings. Their phone number
          and your full address are shared only after they accept.
        </p>
        <Link href="/bookings" className={`${outlineButton} mt-4 w-full`}>
          Go to My bookings
        </Link>
      </section>
    );
  }

  return (
    <><section id="book" aria-labelledby="book-heading" className={ticketClass}>
      <h2 id="book-heading" tabIndex={-1} className="text-xl font-bold">
        Request {chefName}
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        A meal in your kitchen, for up to {maxGuests} guests.
      </p>

      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <fieldset className="min-w-0 space-y-4">
          <legend className="flex items-center gap-2.5 font-heading text-base font-bold">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-xs text-white">1</span>
            Your event
          </legend>
        <Field
          label="Date and time"
          htmlFor="b-date"
          error={errors.eventDate ?? (pickedUnavailable ? `${chefName} isn't available on that day.` : undefined)}
          hint="Times are in IST. Book at least 24 hours ahead."
        >
          <input
            id="b-date"
            type="datetime-local"
            min={minDate || undefined}
            max={maxDate || undefined}
            aria-invalid={Boolean(errors.eventDate || pickedUnavailable)}
            aria-describedby="b-date-help"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={inputClass}
          />
          {unavailableDays.length > 0 && (
            <p className="mt-1 text-xs text-ink/70">
              Not available: {shownDays}
              {moreDays > 0 ? ` and ${moreDays} more` : ""}.
            </p>
          )}
        </Field>

        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
        <Field
          label="Guests"
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
            aria-invalid={Boolean(errors.guests)}
            aria-describedby="b-guests-help"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Area" htmlFor="b-area" error={errors.area} hint="Your neighbourhood">
          <input id="b-area" placeholder="e.g. Arera Colony" aria-invalid={Boolean(errors.area)} aria-describedby="b-area-help" value={area} onChange={(e) => setArea(e.target.value)} className={inputClass} />
        </Field>
        </div>

        <Field label="Food notes or allergies (optional)" htmlFor="b-notes" error={errors.notes}>
          <textarea
            id="b-notes"
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? "b-notes-help" : undefined}
            rows={2}
            placeholder="Dietary preferences, allergies or a dish you love"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </Field>
        </fieldset>

        <fieldset className="min-w-0 space-y-4 border-t border-leaf/20 lg:border-l lg:border-t-0 lg:pl-6">
          <legend className="flex items-center gap-2.5 pr-3 font-heading text-base font-bold">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-xs text-white">2</span>
            Contact details
          </legend>
          <p className="rounded-lg bg-sage/50 px-3 py-2 text-xs leading-relaxed text-ink/75">
            Your phone and full address stay private until the chef accepts.
          </p>

        <Field
          label="Your phone number"
          htmlFor="b-phone"
          error={errors.phone}
          hint="A 10-digit Indian mobile number."
        >
          <input
            id="b-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby="b-phone-help"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Full address"
          htmlFor="b-address"
          error={errors.address}
        >
          <textarea
            id="b-address"
            autoComplete="street-address"
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? "b-address-help" : undefined}
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </Field>

        </fieldset>

        <div className="rounded-xl bg-sage/60 p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Estimated total</p>
              <p className="mt-0.5 text-xs text-ink/70">
              {guestsValid
                ? `${guestsNumber} ${guestsNumber === 1 ? "guest" : "guests"} × ${formatINR(pricePerPerson)}`
                : "Choose your guest count"}
              </p>
            </div>
            <p aria-live="polite" aria-atomic="true" className="text-2xl font-bold">{estimate !== null ? formatINR(estimate) : "—"}</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink/70">Groceries and extras are agreed with the chef.</p>

          <button type="submit" disabled={sending} className={`${primaryButton} mt-4 w-full`}>
            {sending ? "Sending..." : "Send request"}
          </button>
          <div className="mt-3"><CancellationNote /></div>
          <p className="mt-3 text-center text-xs text-ink/70">
            No charge now. Pay the chef after the meal.
          </p>
        </div>

        {message && (
          <div className="lg:col-span-2"><FormNotice kind="error">{message}</FormNotice></div>
        )}
      </form>
    </section><MobileBookingBar pricePerPerson={pricePerPerson} /></>
  );
}
