"use client";
import { useEffect, useRef, useState } from "react";
import { mealPhotoUrl, type MealPhotoItem } from "@/lib/meals";
import { outlineButton } from "@/lib/ui";

export default function MealGallery({ photos, chefName }: { photos: MealPhotoItem[]; chefName: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected !== null && !dialog.current?.open) dialog.current?.showModal();
    if (selected === null && dialog.current?.open) dialog.current.close();
  }, [selected]);
  if (!photos.length) return null;
  const current = selected === null ? null : photos[selected];
  const move = (offset: number) => setSelected((value) => value === null ? null : (value + offset + photos.length) % photos.length);
  return <section aria-labelledby="meal-gallery-heading">
    <h2 id="meal-gallery-heading" className="text-2xl font-bold">From the chef’s kitchen</h2>
    <p className="mt-2 text-sm text-ink/70">Meals shared by {chefName}. Tap a photo for a closer look.</p>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {photos.map((photo, index) => <figure key={photo.id} className="min-w-0 overflow-hidden rounded-xl border border-leaf/20 bg-white/40">
        <button type="button" onClick={() => setSelected(index)} aria-label={`View ${photo.dishName || `meal photo ${index + 1}`}`} className="group block aspect-[4/3] w-full overflow-hidden bg-sage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mealPhotoUrl(photo.id)} alt={photo.dishName || `Meal prepared by ${chefName}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </button>
        {(photo.dishName || photo.caption) && <figcaption className="space-y-1 break-words p-3">{photo.dishName && <p className="text-sm font-semibold">{photo.dishName}</p>}{photo.caption && <p className="text-xs leading-relaxed text-ink/70">{photo.caption}</p>}</figcaption>}
      </figure>)}
    </div>
    <dialog ref={dialog} aria-labelledby="meal-dialog-title" onClose={() => setSelected(null)}
      onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}
      onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); move(1); } if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-auto rounded-2xl bg-cream p-4 text-ink shadow-lift backdrop:bg-forest/80 sm:p-6">
      {current && <>
        <div className="flex items-start justify-between gap-3"><h3 id="meal-dialog-title" className="min-w-0 break-words text-xl font-bold">{current.dishName || `A meal by ${chefName}`}</h3><button type="button" onClick={() => setSelected(null)} className={`${outlineButton} shrink-0`}>Close photo</button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mealPhotoUrl(current.id)} alt={current.dishName || `Meal prepared by ${chefName}`} className="mt-4 max-h-[60dvh] w-full rounded-lg bg-sage/30 object-contain" />
        {current.caption && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{current.caption}</p>}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"><button type="button" disabled={photos.length < 2} onClick={() => move(-1)} aria-label="Previous photo" className={`${outlineButton} px-3 text-sm`}>Previous</button><p role="status" className="text-sm text-ink/70">{selected! + 1} of {photos.length}</p><button type="button" disabled={photos.length < 2} onClick={() => move(1)} aria-label="Next photo" className={`${outlineButton} px-3 text-sm`}>Next</button></div>
      </>}
    </dialog>
  </section>;
}
