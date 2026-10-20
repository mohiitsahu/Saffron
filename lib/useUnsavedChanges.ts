"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Keep in-page section links usable, but protect edits when leaving through a link
// or closing/reloading the tab. The browser supplies its own beforeunload wording.
export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const discarding = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!discarding.current) { event.preventDefault(); event.returnValue = ""; } };
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault(); event.stopImmediatePropagation();
      setPendingHref(destination.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", followLink, true); };
  }, [dirty]);
  return {
    pendingHref,
    stay: () => setPendingHref(null),
    leave: () => {
      if (!pendingHref) return;
      discarding.current = true;
      const destination = new URL(pendingHref);
      setPendingHref(null);
      if (destination.origin === window.location.origin) router.push(destination.pathname + destination.search + destination.hash);
      else window.location.assign(destination.href);
    },
  };
}
