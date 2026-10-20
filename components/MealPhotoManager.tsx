"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded photos require browser session cookies. */
import { useEffect, useId, useRef, useState } from "react";
import { MAX_MEAL_PHOTOS, mealPhotoUrl, type MealPhotoItem } from "@/lib/meals";
import { shrinkPhoto } from "@/lib/clientPhotos";
import { dangerButton, inputClass, labelClass, outlineButton, primaryButton } from "@/lib/ui";
import FormNotice from "@/components/FormNotice";

export default function MealPhotoManager({ initialPhotos }: { initialPhotos: MealPhotoItem[] }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [selected, setSelected] = useState<string | null>(null);
  const [dishName, setDishName] = useState("");
  const [caption, setCaption] = useState("");
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState<{ id: string; over: number } | null>(null);
  const pointerDrag = useRef<{ id: string; over: number; pointerId: number } | null>(null);
  const slotElements = useRef<(HTMLDivElement | null)[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const slotButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const gripButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const moveFocus = useRef<string | null>(null);
  const returnFocus = useRef<number | null>(null);
  const activeRequest = useRef(false);
  const uid = useId();
  const photo = photos.find((item) => item.id === selected);
  const selectedIndex = photos.findIndex((item) => item.id === selected);
  const remaining = MAX_MEAL_PHOTOS - photos.length;

  useEffect(() => {
    if (selected && !editor.current?.open) {
      editor.current?.showModal();
      editorHeading.current?.focus();
    }
    if (!selected && editor.current?.open) editor.current.close();
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected]);
  useEffect(() => { if (removing) keepButton.current?.focus(); }, [removing]);
  useEffect(() => {
    if (!busy && !selected && returnFocus.current !== null) {
      slotButtons.current[returnFocus.current]?.focus();
      returnFocus.current = null;
    }
  }, [busy, selected]);
  useEffect(() => {
    if (!busy && moveFocus.current) {
      gripButtons.current[moveFocus.current]?.focus();
      moveFocus.current = null;
    }
  }, [busy, photos]);

  async function request(url: string, options: RequestInit = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.photos)) throw Error(data.error ?? "Could not update the gallery. Refresh it and try again.");
    setPhotos(data.photos);
    return data.photos as MealPhotoItem[];
  }
  function errorText(err: unknown) {
    return err instanceof TypeError ? "Check your connection and try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";
  }
  async function mutate(work: () => Promise<void>, success: string) {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(success); }
    catch (err) { setError(errorText(err)); }
    finally { activeRequest.current = false; setBusy(false); setProgress(""); }
  }
  const json = (method: string, body: object): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function upload(files: File[]) {
    if (!files.length || activeRequest.current) return;
    setError(""); setMessage("");
    if (files.length > remaining) {
      setError(`You have ${remaining} ${remaining === 1 ? "slot" : "slots"} left. Select up to ${remaining} photos.`);
      return;
    }
    activeRequest.current = true; setBusy(true);
    let added = 0;
    const failures: string[] = [];
    // Process one at a time so six large phone photos don't decode into memory together.
    for (let index = 0; index < files.length; index++) {
      setProgress(`Uploading ${index + 1} of ${files.length} photos…`);
      try {
        const image = await shrinkPhoto(files[index]);
        const data = new FormData(); data.append("file", image, "meal.jpg");
        await request("/api/chef/meals", { method: "POST", body: data });
        added++;
      } catch (err) { failures.push(`${files[index].name}: ${errorText(err)}`); }
    }
    setMessage(added ? `${added} ${added === 1 ? "photo added" : "photos added"}. Tap a photo to add its dish name and caption.` : "");
    setError(failures.length ? `Couldn't upload ${failures.length} ${failures.length === 1 ? "photo" : "photos"}. ${failures.join(" ")} Select those files again to retry; your successful uploads are saved.` : "");
    activeRequest.current = false; setBusy(false); setProgress("");
  }
  function selectPhoto(item: MealPhotoItem) {
    setMessage(""); setError("");
    setSelected(item.id); setDishName(item.dishName); setCaption(item.caption); setRemoving(false);
  }
  function closeEditor() {
    returnFocus.current = Math.max(0, selectedIndex);
    setSelected(null); setRemoving(false);
  }
  async function movePhoto(id: string, target: number) {
    if (activeRequest.current) return;
    const source = photos.findIndex((item) => item.id === id);
    target = Math.max(0, Math.min(target, photos.length - 1));
    if (source < 0 || source === target) return;
    const ids = photos.map((item) => item.id);
    ids.splice(source, 1); ids.splice(target, 0, id);
    moveFocus.current = id;
    await mutate(async () => { await request("/api/chef/meals", json("PATCH", { ids })); }, "Gallery order saved.");
  }
  function pointerTarget(x: number, y: number) {
    return slotElements.current.findIndex((element) => {
      const rect = element?.getBoundingClientRect();
      return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
  }

  return (
    <section id="meal-photos" aria-labelledby={`${uid}-heading`} aria-busy={busy} className="scroll-mt-24 rounded-2xl border border-leaf/25 bg-white/40 p-4 sm:p-5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id={`${uid}-heading`} className="text-2xl font-bold">Your meal photos</h2><p className="mt-1 text-sm text-ink/65">A little taste of what you cook. {photos.length}/{MAX_MEAL_PHOTOS} photos.</p></div>
        <button type="button" disabled={busy} onClick={() => mutate(async () => { await request("/api/chef/meals", { cache: "no-store" }); setSelected(null); setRemoving(false); }, "Gallery refreshed.")} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-leaf underline underline-offset-4 disabled:opacity-50">Refresh gallery</button>
      </div>
      <p id={`${uid}-help`} className="mt-2 text-sm leading-relaxed text-ink/70">Tap to edit. Drag photos to rearrange, or use the grip and arrow keys. Choose several photos with +.</p>
      <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || !remaining} aria-label="Choose meal photos" aria-describedby={`${uid}-help`} className="sr-only" tabIndex={-1} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-h-[14rem] lg:flex-1 lg:grid-rows-2">
        {Array.from({ length: MAX_MEAL_PHOTOS }, (_, index) => {
          const item = photos[index];
          return <div key={item?.id ?? `empty-${index}`} ref={(element) => { slotElements.current[index] = element; }}
            draggable={Boolean(item) && !busy} onDragStart={(event) => {
              if (!item || (event.target as HTMLElement).closest('[data-drag-grip]')) { event.preventDefault(); return; }
              event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); setDragging({ id: item.id, over: index });
            }} onDragOver={(event) => { if (dragging && !busy) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragging({ ...dragging, over: index }); } }}
            onDrop={(event) => { event.preventDefault(); if (dragging && !busy) void movePhoto(dragging.id, index); setDragging(null); }} onDragEnd={() => setDragging(null)}
            className={`relative aspect-square min-w-0 rounded-xl ring-offset-2 ring-offset-cream sm:aspect-[4/3] lg:aspect-auto lg:min-h-0 ${dragging?.over === index ? "ring-2 ring-leaf" : ""} ${dragging?.id === item?.id && item ? "opacity-60" : ""}`}>
          {item ? <>
            <button ref={(element) => { slotButtons.current[index] = element; }} type="button" disabled={busy || dragging !== null} aria-label={`Edit photo ${index + 1}${item.dishName ? `: ${item.dishName}` : ""}`} onClick={() => selectPhoto(item)} className="group relative block h-full w-full overflow-hidden rounded-xl bg-sage text-left focus-visible:outline-offset-4 disabled:opacity-60">
              <img draggable={false} src={mealPhotoUrl(item.id)} alt={item.dishName || `Meal photo ${index + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 text-white"><span className="block truncate text-sm font-semibold">{item.dishName || "Add dish name"}</span><span className="mt-0.5 block text-xs text-white/80">Tap to edit</span></span>
              <span aria-hidden="true" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream/95 text-sm text-forest">✎</span>
            </button>
            <button ref={(element) => { gripButtons.current[item.id] = element; }} type="button" data-drag-grip disabled={busy} aria-label={`Move photo ${index + 1}`} aria-describedby={`${uid}-help`} className="absolute left-1 top-1 flex h-11 w-11 touch-none select-none items-center justify-center rounded-full text-xl text-forest focus-visible:outline-offset-2 disabled:opacity-50" style={{ cursor: dragging?.id === item.id ? "grabbing" : "grab" }}
              onPointerDown={(event) => { if (busy || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); pointerDrag.current = { id: item.id, over: index, pointerId: event.pointerId }; setDragging({ id: item.id, over: index }); }}
              onPointerMove={(event) => { const current = pointerDrag.current; if (!current || event.pointerId !== current.pointerId) return; const over = pointerTarget(event.clientX, event.clientY); if (over >= 0) { current.over = over; setDragging({ id: current.id, over }); } }}
              onPointerUp={(event) => { const current = pointerDrag.current; if (!current || event.pointerId !== current.pointerId) return; const over = pointerTarget(event.clientX, event.clientY); pointerDrag.current = null; setDragging(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (over >= 0) void movePhoto(current.id, over); }}
              onPointerCancel={() => { pointerDrag.current = null; setDragging(null); }} onLostPointerCapture={() => { pointerDrag.current = null; setDragging(null); }}
              onKeyDown={(event) => { const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0; if (offset) { event.preventDefault(); void movePhoto(item.id, index + offset); } }}><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/95">⠿</span></button>
          </> : (
            <button ref={(element) => { slotButtons.current[index] = element; }} type="button" disabled={busy} aria-label={`Add meal photos in slot ${index + 1}`} onClick={() => fileInput.current?.click()} className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-leaf/30 bg-sage/20 px-2 text-leaf transition hover:border-leaf hover:bg-sage/50 focus-visible:outline-offset-4 disabled:opacity-50">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-3xl font-light">+</span><span className="text-sm font-semibold">Add photo</span>
            </button>
          )}</div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-ink/65">Your own cooking · JPEG, PNG or WebP.</p>
        {remaining > 0 && <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={`${primaryButton} text-sm`}>Add photos</button>}
      </div>
      {error && <div className="mt-3"><FormNotice kind="error">{error}</FormNotice></div>}
      {(busy || message) && <div className="mt-3"><FormNotice kind={busy ? "info" : "success"}>{busy ? progress || "Saving gallery…" : message}</FormNotice></div>}

      <dialog ref={editor} aria-labelledby={`${uid}-editor-title`} onCancel={(event) => { event.preventDefault(); if (!busy) closeEditor(); }} onClose={() => { if (selected) closeEditor(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) closeEditor(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-auto rounded-2xl bg-cream p-5 text-ink shadow-lift backdrop:bg-forest/70 sm:p-6">
      {photo && <>
        <div className="mb-4 flex items-center justify-between gap-3"><h3 id={`${uid}-editor-title`} ref={editorHeading} tabIndex={-1} className="font-bold focus:outline-none">Edit meal photo</h3><button type="button" disabled={busy} onClick={closeEditor} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-leaf">Close editor</button></div>
        <form onSubmit={(event) => { event.preventDefault(); void mutate(async () => { await request(`/api/chef/meals/${photo.id}`, json("PATCH", { dishName, caption })); }, "Meal details saved."); }} className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <img src={mealPhotoUrl(photo.id)} alt={photo.dishName || "Selected meal"} className="max-h-48 w-full rounded-xl object-contain sm:aspect-square sm:object-cover" />
          <div className="min-w-0 space-y-3"><div><label htmlFor={`${uid}-dish`} className={labelClass}>Dish name (optional)</label><input id={`${uid}-dish`} value={dishName} disabled={busy} onChange={(event) => setDishName(event.target.value)} maxLength={80} placeholder="e.g. Dal makhani" className={inputClass} /></div><div><label htmlFor={`${uid}-caption`} className={labelClass}>Caption (optional)</label><textarea id={`${uid}-caption`} value={caption} disabled={busy} onChange={(event) => setCaption(event.target.value)} maxLength={280} rows={2} placeholder="The story behind this dish" className={inputClass} /></div><button disabled={busy} className={`${primaryButton} w-full`}>Save details</button></div>
        </form>
        {error && <div className="mt-3"><FormNotice kind="error">{error}</FormNotice></div>}
        {(busy || message) && <div className="mt-3"><FormNotice>{busy ? "Saving…" : message}</FormNotice></div>}
        <div className="mt-4 border-t border-leaf/20 pt-4"><button type="button" disabled={busy} onClick={() => setRemoving(true)} className={`${dangerButton} px-3 text-sm`}>Remove photo</button></div>
        {removing && <div role="alertdialog" aria-label="Remove meal photo" className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3"><p className="text-sm">Remove this photo? You can upload it again later.</p><div className="mt-3 flex flex-wrap gap-2"><button ref={keepButton} type="button" disabled={busy} onClick={() => setRemoving(false)} className={outlineButton}>Keep photo</button><button type="button" disabled={busy} onClick={() => mutate(async () => { await request(`/api/chef/meals/${photo.id}`, { method: "DELETE" }); closeEditor(); }, "Meal photo removed.")} className={dangerButton}>Confirm removal</button></div></div>}
      </>}
      </dialog>
    </section>
  );
}
