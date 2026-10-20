"use client";
const KEY = "__saffronHistoryIndex";
export const HISTORY_CHANGED = "saffron:history-changed";
let installed = false;
let traversalGuard: ((event: PopStateEvent) => void) | null = null;
// Register before the router's effects so it cannot unmount the editor first.
if (typeof window !== "undefined") window.addEventListener("popstate", (event) => traversalGuard?.(event), true);
export function guardHistoryTraversal(guard: (event: PopStateEvent) => void) {
  traversalGuard = guard;
  return () => { if (traversalGuard === guard) traversalGuard = null; };
}
export function historyIndex(): number | null {
  const index = window.history.state?.[KEY];
  return Number.isSafeInteger(index) ? index : null;
}
export function trackNavigationHistory() {
  if (installed) return;
  installed = true;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  replace({ ...window.history.state, [KEY]: historyIndex() ?? 0 }, "");
  window.history.pushState = (state, unused, url) => {
    push({ ...state, [KEY]: (historyIndex() ?? 0) + 1 }, unused, url);
    window.dispatchEvent(new Event(HISTORY_CHANGED));
  };
  window.history.replaceState = (state, unused, url) => {
    replace({ ...state, [KEY]: historyIndex() ?? 0 }, unused, url);
    window.dispatchEvent(new Event(HISTORY_CHANGED));
  };
}
