"use client";

import { useRef, useState } from "react";
import { labelClass, outlineButton, primaryButton } from "@/lib/ui";

import { shrinkPhoto } from "@/lib/clientPhotos";
import FormNotice from "@/components/FormNotice";

export default function PhotoUpload({
  value,
  onChange,
  name,
  error,
}: {
  value: string; // the photo's URL, or "" when there is none
  onChange: (url: string) => void;
  name: string; // used for the placeholder letter
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again later
    if (!file) return;

    setBusy(true);
    setProblem(null);
    try {
      const blob = await shrinkPhoto(file);
      const body = new FormData();
      body.append("file", blob, "photo.jpg");

      const res = await fetch("/api/chef/photo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed. Try again.");
      onChange(data.url);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/chef/photo", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove the photo. Try again.");
      onChange("");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not remove the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const shownError = problem ?? error;

  return (
    <div>
      <span className={labelClass}>Photo (optional)</span>
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28 flex-none overflow-hidden rounded-2xl bg-sage ring-4 ring-sage">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sage to-cream font-heading text-4xl font-bold text-leaf"
            >
              {(name.trim().charAt(0) || "S").toUpperCase()}
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-forest/60 text-xs font-semibold text-white">
              Working...
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className={value ? outlineButton : primaryButton}
            >
              {value ? "Change photo" : "Upload a photo"}
            </button>
            {value && (
              <button type="button" disabled={busy} onClick={onRemove} className={outlineButton}>
                Remove
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink/70">
            A clear photo of you or your food. Everyone on Saffron can see it.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={onPick}
      />

      {shownError && (
        <div className="mt-3"><FormNotice kind="error">{shownError}</FormNotice></div>
      )}
    </div>
  );
}
