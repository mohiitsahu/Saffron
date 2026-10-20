"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dangerButton, inputClass, labelClass, outlineButton, panelClass, primaryButton } from "@/lib/ui";
import FormNotice from "@/components/FormNotice";

type DeletionRequest = { status: string; createdAt: string; resolutionNote: string | null } | null;

export default function AccountSettings({ initialName, initialPhone, email, isChef, deletionRequest }: {
  initialName: string; initialPhone: string; email: string; isChef: boolean; deletionRequest: DeletionRequest;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeletion, setShowDeletion] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requested, setRequested] = useState(false);
  const waiting = requested || deletionRequest?.status === "OPEN";
  useEffect(() => { if (Object.keys(errors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(""); setErrors({});
    try {
      const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) });
      const data = await res.json().catch(() => ({ error: "Could not load a response. Please try again." }));
      if (!res.ok || !data.ok) { setErrors(data.fieldErrors ?? {}); throw Error(data.error ?? "Could not save your details."); }
      setMessage("Your account details have been saved."); router.refresh();
    } catch (error) { setErrors((current) => ({ ...current, form: error instanceof Error ? error.message : "Check your connection and try again." })); }
    finally { setBusy(false); }
  }

  async function requestDeletion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setRequestBusy(true); setRequestError("");
    try {
      const res = await fetch("/api/account/deletion-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const data = await res.json().catch(() => ({ error: "Could not load a response. Please try again." }));
      if (!res.ok || !data.ok) throw Error(data.error ?? "Could not send your request.");
      setRequested(true); setShowDeletion(false); setConfirmation(""); router.refresh();
    } catch (error) { setRequestError(error instanceof Error ? error.message : "Check your connection and try again."); }
    finally { setRequestBusy(false); }
  }

  return <div className="space-y-6">
    <form ref={form} onSubmit={save} onChange={() => setMessage("")} className={`${panelClass} space-y-5`}>
      <div><h2 className="text-xl font-bold">Your details</h2><p className="mt-1 text-sm text-ink/70">Your name appears on your bookings. Booking details already sent keep their original phone number.</p></div>
      <div><label htmlFor="account-name" className={labelClass}>Name</label><input id="account-name" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} className={inputClass} />{errors.name && <p id="name-error" className="mt-1 text-sm text-danger">{errors.name}</p>}</div>
      <div><label htmlFor="account-email" className={labelClass}>Google account email</label><input id="account-email" value={email || "No email provided"} readOnly className={`${inputClass} bg-sage/30 text-ink/65`} /><p className="mt-1 text-xs text-ink/65">Your sign-in email is managed through Google.</p></div>
      <div><label htmlFor="account-phone" className={labelClass}>Phone number {isChef ? "" : "(optional)"}</label><input id="account-phone" type="tel" inputMode="tel" autoComplete="tel-national" required={isChef} value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby="phone-help" className={inputClass} /><p id="phone-help" className={`mt-1 text-xs ${errors.phone ? "text-danger" : "text-ink/65"}`}>{errors.phone ?? "Use a 10-digit Indian mobile number. It is never shown on your public profile."}</p></div>
      {isChef && <p className="text-sm text-ink/70">This is also the chef contact number shared after acceptance. Edit your public chef name and services in <Link href="/chef" className="font-semibold text-leaf underline">Chef profile</Link>.</p>}
      {errors.form && <FormNotice kind="error">{errors.form}</FormNotice>}
      {message && <FormNotice>{message}</FormNotice>}
      <button type="submit" disabled={busy} className={`${primaryButton} w-full sm:w-auto`}>{busy ? "Saving…" : "Save account details"}</button>
    </form>
    <section className="rounded-2xl border border-danger/25 p-5 sm:p-6" aria-labelledby="deletion-title">
      <h2 id="deletion-title" className="text-xl font-bold">Request account deletion</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">An administrator reviews deletion requests, including active bookings and records that need to be kept. Sending a request does not delete your account or cancel your bookings. You can keep using your account during review.</p>
      {waiting ? <p role="status" className="mt-4 rounded-lg bg-sage/50 p-3 text-sm font-medium">Your deletion request is waiting for an administrator. Check this page for an update.</p> : <>
        {deletionRequest && <div className="mt-4 rounded-lg bg-sage/40 p-3 text-sm"><p className="font-semibold">Previous request: {deletionRequest.status === "RESOLVED" ? "Reviewed" : "Closed"}</p>{deletionRequest.resolutionNote && <p className="mt-1 whitespace-pre-wrap break-words">{deletionRequest.resolutionNote}</p>}</div>}
        {!showDeletion ? <button type="button" onClick={() => setShowDeletion(true)} className={`${dangerButton} mt-4`}>Start deletion request</button> : <form onSubmit={requestDeletion} className="mt-4 space-y-3">
          <label htmlFor="delete-confirmation" className={labelClass}>Type DELETE to request a review</label>
          <input id="delete-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" required pattern="DELETE" className={inputClass} />
          <div className="flex flex-wrap gap-3"><button type="submit" disabled={requestBusy || confirmation !== "DELETE"} className={dangerButton}>{requestBusy ? "Sending…" : "Send deletion request"}</button><button type="button" disabled={requestBusy} onClick={() => { setShowDeletion(false); setConfirmation(""); setRequestError(""); }} className={outlineButton}>Keep my account</button></div>
        </form>}
      </>}
      {requestError && <div className="mt-3"><FormNotice kind="error">{requestError}</FormNotice></div>}
      <p className="mt-4 text-sm"><Link href="/privacy" className="text-leaf underline">How we use your information</Link></p>
    </section>
  </div>;
}
