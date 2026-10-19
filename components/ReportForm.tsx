"use client";
import { useId, useState } from "react";
import { inputClass, labelClass, outlineButton } from "@/lib/ui";
export default function ReportForm({ targetType, targetId }: { targetType: "chef" | "booking"; targetId: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError("");
    try { const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason: form.get("reason"), details: form.get("details") }) });
      const data = await res.json(); if (!res.ok) throw Error(data.error ?? "Could not send the report."); setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (sent) return <p role="status" className="rounded-lg bg-sage p-3 text-sm">Report sent for admin review. This does not cancel your booking.</p>;
  return <div>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 text-sm text-ink/70 underline">{targetType === "chef" ? "Report this profile" : "Report a problem"}</button>
    {open && <form onSubmit={submit} className="mt-2 space-y-3 rounded-xl border border-leaf/25 bg-cream p-4">
      <label htmlFor={`${id}-reason`} className={labelClass}>Reason</label><select id={`${id}-reason`} name="reason" className={inputClass}><option value="profile">Misleading or inappropriate profile</option><option value="no_show">No-show</option><option value="conduct">Conduct or safety concern</option><option value="other">Other</option></select>
      <label htmlFor={`${id}-details`} className={labelClass}>What happened?</label><textarea id={`${id}-details`} name="details" required minLength={10} maxLength={1500} rows={3} className={inputClass} />
      <p className="text-xs text-ink/70">Only admins review this report. Include useful details, without passwords or payment information.</p>
      <button disabled={busy} className={outlineButton}>{busy ? "Sending…" : "Send report"}</button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>}
  </div>;
}
