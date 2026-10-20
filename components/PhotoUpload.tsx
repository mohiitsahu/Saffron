"use client";

import { useEffect, useRef, useState } from "react";
import { labelClass, outlineButton, primaryButton } from "@/lib/ui";

import { shrinkPhoto } from "@/lib/clientPhotos";
import FormNotice from "@/components/FormNotice";

export default function PhotoUpload({
  value,
  onChange,
  name,
  error,
  draft,
  disabled = false,
  onBusyChange,
}: {
  value: string; // the photo's URL, or "" when there is none
  onChange: (photo: Blob | null) => void;
  name: string; // used for the placeholder letter
  error?: string;
  draft?: Blob | null;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!draft) { setPreview(""); return; }
    const url = URL.createObjectURL(draft); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft]);
  const shownPhoto = draft === undefined ? value : draft === null ? "" : preview;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again later
    if (!file) return;

    setBusy(true); onBusyChange(true);
    setProblem(null);
    try {
      const blob = await shrinkPhoto(file);
      onChange(blob);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false); onBusyChange(false);
    }
  }

  function onRemove() {
    setProblem(null);
    onChange(null);
  }

  const shownError = problem ?? error;

  return (
    <div>
      <span className={labelClass}>Photo (optional)</span>
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28 flex-none overflow-hidden rounded-2xl bg-sage ring-4 ring-sage">
          {shownPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownPhoto} alt="Your photo" className="h-full w-full object-cover" />
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
              disabled={busy || disabled}
              onClick={() => inputRef.current?.click()}
              className={shownPhoto ? outlineButton : primaryButton}
            >
              {shownPhoto ? "Change photo" : "Upload a photo"}
            </button>
            {shownPhoto && (
              <button type="button" disabled={busy || disabled} onClick={onRemove} className={outlineButton}>
                Remove
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink/70">
            A clear photo of you or your food. Changes go public only when you save your profile.
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
        disabled={busy || disabled}
      />

      {shownError && (
        <div className="mt-3"><FormNotice kind="error">{shownError}</FormNotice></div>
      )}
    </div>
  );
}
