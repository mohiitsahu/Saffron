"use client";
/* eslint-disable @next/next/no-img-element -- Images are compressed uploads; private previews require browser session cookies. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mealPhotoUrl, type MealPhotoItem } from "@/lib/meals";
import { dangerButton, inputClass, outlineButton } from "@/lib/ui";

export default function AdminMealPhotos({ chefId, photos }: { chefId: string; photos: MealPhotoItem[] }) {
  const router = useRouter(); const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [refreshing, startRefresh] = useTransition();
  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError("");
    try { const res = await fetch(`/api/admin/chefs/${chefId}/meals/${selected}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw Error(data.error ?? "Could not remove this meal photo.");
      setSelected(null); setNote(""); startRefresh(() => router.refresh());
    } catch (err) { setError(err instanceof Error ? err.message : "Check your connection and try again."); } finally { setBusy(false); }
  }
  if (!photos.length) return null;
  return <details className="mt-3 rounded-lg border border-leaf/20 p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-leaf">Review meal photos ({photos.length})</summary>
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <div key={photo.id} className="min-w-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={mealPhotoUrl(photo.id)} alt={photo.dishName || "Chef meal photo"} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" /><p className="mt-2 break-words text-sm font-semibold">{photo.dishName || "Untitled meal"}</p>{photo.caption && <p className="mt-1 break-words text-xs text-ink/70">{photo.caption}</p>}<button type="button" disabled={busy || refreshing} onClick={() => { setSelected(photo.id); setNote(""); setError(""); }} className={`${dangerButton} mt-2 w-full px-2 text-sm`}>Remove meal photo</button></div>)}</div>
    {selected && <form onSubmit={remove} className="mt-4 space-y-3 rounded-xl bg-danger/5 p-3"><p className="text-sm font-semibold">Remove this meal photo? The chef can upload another.</p><label className="block text-sm">Reason for removal<textarea required minLength={5} maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy || refreshing} className={inputClass} /></label><div className="flex flex-wrap gap-3"><button type="button" disabled={busy || refreshing} onClick={() => setSelected(null)} className={outlineButton}>Keep photo</button><button disabled={busy || refreshing} className={dangerButton}>Confirm meal removal</button></div></form>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </details>;
}
