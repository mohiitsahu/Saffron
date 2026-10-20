"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";
import FormNotice from "@/components/FormNotice";

export default function SupportForm() {
  const router = useRouter(); const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState(false);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError(""); setSent(false);
    try {
      const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: form.get("topic"), details: form.get("details") }) });
      const data = await res.json().catch(() => ({ error: "Could not load a response. Please try again." })); if (!res.ok || !data.ok) throw Error(data.error ?? "Could not send your message.");
      setSent(true); formRef.current?.reset(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Check your connection and try again."); } finally { setBusy(false); }
  }
  return <form ref={formRef} onSubmit={send} className="mt-4 space-y-4">
    <div><label htmlFor="support-topic" className={labelClass}>Topic</label><select id="support-topic" name="topic" className={inputClass}><option value="support">Account or app help</option><option value="privacy">Privacy or data request</option></select></div>
    <div><label htmlFor="support-details" className={labelClass}>How can we help?</label><textarea id="support-details" name="details" required minLength={10} maxLength={1500} rows={4} aria-describedby="support-hint" className={inputClass} /><p id="support-hint" className="mt-1 text-xs text-ink/65">Include the booking reference if relevant. Leave out passwords, payment details and identity documents.</p></div>
    <button disabled={busy} className={`${primaryButton} w-full sm:w-auto`}>{busy ? "Sending…" : "Send to Saffron"}</button>
    {error && <FormNotice kind="error">{error}</FormNotice>}
    {sent && <FormNotice>Message sent. Your request and any admin reply appear below.</FormNotice>}
  </form>;
}
