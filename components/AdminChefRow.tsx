"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dangerButton, outlineButton, primaryButton } from "@/lib/ui";

export type AdminChef = {
  id: string;
  displayName: string;
  city: string;
  email: string;
  photoUrl: string | null;
  verified: boolean;
  active: boolean;
  createdAt: string; // already formatted for display
  bio: string;
  sampleMenu: string;
  maxGuests: number;
  pricePerPerson: number;
  suspended: boolean;
};

export default function AdminChefRow({ chef }: { chef: AdminChef }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function call(url: string, method: "PATCH" | "DELETE", body?: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    if (note.trim().length < 5) { setError("Add an admin note before making a change."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That didn't work. Try again.");
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const chefUrl = `/api/admin/chefs/${chef.id}`;

  return (
    <li className="rounded-2xl border border-leaf/30 bg-white/60 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-sage">
          {chef.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={chef.photoUrl} alt={`Photo of ${chef.displayName}`} className="h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center font-heading text-2xl font-bold text-leaf"
            >
              {chef.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-bold">{chef.displayName}</p>
            {chef.verified ? (
              <span className="rounded-full bg-leaf px-2.5 py-0.5 text-xs font-semibold text-white">Verified</span>
            ) : (
              <span className="rounded-full bg-saffron px-2.5 py-0.5 text-xs font-semibold text-ink">Needs review</span>
            )}
            {!chef.active && (
              <span className="rounded-full border border-ink/40 px-2.5 py-0.5 text-xs font-semibold text-ink/70">
                {chef.suspended ? "Admin-hidden" : "Paused"}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink/70">
            {chef.city} · {chef.email} · joined {chef.createdAt}
          </p>
          {chef.active && (
            <Link href={`/chefs/${chef.id}`} className="mt-1 inline-block text-sm font-medium text-leaf underline underline-offset-4">
              View public profile
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => call(chefUrl, "PATCH", { verified: !chef.verified })}
            className={chef.verified ? outlineButton : primaryButton}
          >
            {chef.verified ? "Remove badge" : "Verify"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => call(chefUrl, "PATCH", { active: !chef.active })}
            className={outlineButton}
          >
            {chef.active ? "Hide profile" : "Show profile"}
          </button>
          {chef.photoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                call(`${chefUrl}/photo`, "DELETE", undefined, `Remove ${chef.displayName}'s photo? They can upload a new one.`)
              }
              className={dangerButton}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-leaf">Review profile details</summary><p className="mt-2 whitespace-pre-wrap">{chef.bio}</p><p className="mt-2">₹{chef.pricePerPerson} per guest · up to {chef.maxGuests} guests</p><p className="mt-2 whitespace-pre-wrap">{chef.sampleMenu}</p>{chef.suspended && <p className="mt-2 text-danger">Hidden by an administrator. The chef cannot reactivate this listing.</p>}</details>
      <label className="mt-3 block text-sm">Admin note<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Reason for this change" className="mt-1 w-full rounded-lg border border-leaf/30 bg-cream p-3" /></label>

      {error && (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
