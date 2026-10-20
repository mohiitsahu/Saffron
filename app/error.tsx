"use client";
import Link from "next/link";
import { outlineButton, primaryButton } from "@/lib/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="mx-auto max-w-xl px-4 py-16">
    <p className="text-sm font-semibold uppercase tracking-widest text-leaf">Something went wrong</p>
    <h1 className="mt-3 text-3xl font-bold">We couldn’t load this page</h1>
    <p className="mt-3 text-ink/75">Check your connection and try again. If you just sent a booking request, check My bookings before sending another.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <button type="button" onClick={reset} className={primaryButton}>Try again</button>
      <Link href="/bookings" className={outlineButton}>My bookings</Link>
      <Link href="/help" className={outlineButton}>Get help</Link>
    </div>
  </section>;
}
