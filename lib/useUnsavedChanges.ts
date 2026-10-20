"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HISTORY_CHANGED, guardHistoryTraversal, historyIndex, trackNavigationHistory } from "@/lib/navigationHistory";

// Keep in-page section links usable, but protect edits when leaving through a link
// or closing/reloading the tab. The browser supplies its own beforeunload wording.
export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const discarding = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const pendingTraversal = useRef<number | null>(null);
  useEffect(() => {
    trackNavigationHistory();
    let current = historyIndex();
    let restoring = false;
    let destination = "";
    const changed = () => { if (!restoring) current = historyIndex(); };
    const traversed = (event: PopStateEvent) => {
      const target = historyIndex();
      if (discarding.current) { current = target; return; }
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        setPendingHref(destination);
        return;
      }
      if (!dirtyRef.current || current === null || target === null || current === target) { current = target; return; }
      // Run in capture phase before Next's popstate listener can unmount the form.
      // Restore the current entry before asking; no duplicate history entries are added.
      event.stopImmediatePropagation();
      pendingTraversal.current = target - current;
      destination = window.location.href;
      restoring = true;
      window.history.go(current - target);
    };
    window.addEventListener(HISTORY_CHANGED, changed);
    const release = guardHistoryTraversal(traversed);
    return () => { window.removeEventListener(HISTORY_CHANGED, changed); release(); };
  }, []);
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
      pendingTraversal.current = null;
      setPendingHref(destination.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", followLink, true); };
  }, [dirty]);
  return {
    pendingHref,
    stay: () => { pendingTraversal.current = null; setPendingHref(null); },
    leave: () => {
      if (!pendingHref) return;
      discarding.current = true;
      if (pendingTraversal.current !== null) {
        const delta = pendingTraversal.current;
        pendingTraversal.current = null;
        setPendingHref(null);
        window.history.go(delta);
        return;
      }
      const destination = new URL(pendingHref);
      setPendingHref(null);
      if (destination.origin === window.location.origin) router.push(destination.pathname + destination.search + destination.hash);
      else window.location.assign(destination.href);
    },
  };
}
