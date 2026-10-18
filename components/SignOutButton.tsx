"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={() => {
        setBusy(true);
        void signOut({ callbackUrl: "/" });
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}