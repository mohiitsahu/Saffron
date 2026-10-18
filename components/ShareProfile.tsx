"use client";

import { useState } from "react";
import { outlineButton } from "@/lib/ui";

export default function ShareProfile({ path, name }: { path: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} on Saffron`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The share sheet was closed or copying was blocked. Nothing to do.
    }
  }

  return (
    <button type="button" onClick={share} className={outlineButton} aria-live="polite">
      {copied ? "Link copied" : "Share profile link"}
    </button>
  );
}