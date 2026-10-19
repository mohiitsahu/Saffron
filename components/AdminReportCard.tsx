"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, outlineButton, dangerButton, primaryButton } from "@/lib/ui";
export default function AdminReportCard({ report }: { report: { id: string; reason: string; details: string; status: string; target: string; reporter: string; createdAt: string; resolutionNote: string | null } }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    setBusy(true); setError("");
    try { const res = await fetch(`/api/admin/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: form.get("note") }) });
      const data = await res.json(); if (!res.ok) throw Error(data.error); router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <li className="rounded-xl border border-leaf/30 bg-white/50 p-4">
    <h3 className="font-bold">{report.target} · {report.reason.replaceAll("_", " ")}</h3><p className="mt-1 text-xs text-ink/65">{report.reporter} · {report.createdAt} · {report.status}</p>
    <p className="mt-3 whitespace-pre-wrap break-words text-sm">{report.details}</p>
    {report.resolutionNote && <p className="mt-2 text-sm">Resolution: {report.resolutionNote}</p>}
    {report.status === "OPEN" && <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm">Admin note<textarea name="note" required minLength={5} maxLength={1000} rows={2} className={inputClass} /></label>
      <div className="flex flex-wrap gap-2"><button disabled={busy} value="resolve" className={primaryButton}>Resolve report</button><button disabled={busy} value="dismiss" className={outlineButton}>Dismiss report</button><button disabled={busy} value="hide_profile" className={dangerButton}>Resolve and hide chef</button></div>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </li>;
}
