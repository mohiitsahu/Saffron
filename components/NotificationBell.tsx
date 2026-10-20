"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import type { NotificationFeed } from "@/lib/notifications";

export default function NotificationBell() {
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.hidden) return;
    inFlight.current = true; setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setFeed(await response.json()); setError("");
    } catch { setError("Couldn’t refresh your updates. Please try again."); }
    finally { inFlight.current = false; setLoading(false); }
  }, []);

  useEffect(() => {
    setMounted(true);
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    const resume = () => { void refresh(); };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [refresh]);
  useEffect(() => { dialog.current?.close(); setOpen(false); void refresh(); }, [pathname, search, refresh]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void refresh();
    return () => { document.body.style.overflow = previous; };
  }, [open, refresh]);

  const close = () => { dialog.current?.close(); setOpen(false); button.current?.focus(); };
  async function markRead() {
    if (!feed || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ through: feed.through }) });
      if (!response.ok) throw new Error();
      await refresh();
    } catch { setError("Couldn’t mark updates as read. Please try again."); }
    finally { setSaving(false); }
  }

  return <>
    <button ref={button} type="button" aria-label={`Notifications${feed?.unread ? `, ${feed.unread} unread` : ""}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cream transition-colors hover:bg-white/10 focus-visible:outline-cream">
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {Boolean(feed?.unread) && <span className="absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-forest bg-saffron" />}
    </button>
    {mounted && createPortal(<dialog ref={dialog} aria-labelledby="notifications-title" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); button.current?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-leaf/20 bg-cream p-0 text-ink shadow-2xl backdrop:bg-forest/30 lg:bottom-auto lg:left-auto lg:right-8 lg:top-20 lg:w-[420px] lg:rounded-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-leaf/15 px-5 py-4">
        <div><h2 id="notifications-title" className="text-xl font-bold">Your updates</h2><p className="mt-1 text-sm text-ink/65">Booking news, all in one place.</p></div>
        <button type="button" onClick={close} aria-label="Close notifications" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sage">✕</button>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-leaf/10 px-5 py-2 text-sm">
        <button type="button" onClick={() => void refresh()} disabled={loading} className="min-h-11 rounded px-1 font-semibold text-leaf disabled:opacity-50">{loading ? "Updating…" : "Refresh"}</button>
        <button type="button" onClick={() => void markRead()} disabled={!feed?.unread || saving || loading} className="min-h-11 rounded px-1 font-semibold text-leaf disabled:opacity-50">{saving ? "Saving…" : "Mark all as read"}</button>
      </div>
      {error && <p role="status" className="bg-saffron/10 px-5 py-3 text-sm">{error}</p>}
      <div className="max-h-[calc(85dvh_-_210px)] overflow-y-auto overscroll-contain">
        {!feed && !error && <p role="status" className="p-8 text-center text-sm text-ink/70">Loading your updates…</p>}
        {feed && feed.items.length === 0 && <div className="px-6 py-10 text-center"><p className="text-lg font-bold">Nothing new just yet</p><p className="mt-2 text-sm text-ink/65">Requests, replies and meal updates will appear here.</p></div>}
        <ul className="divide-y divide-leaf/10">{feed?.items.map((item) => <li key={item.id}><Link href={item.href} onClick={close} className="block px-5 py-4 transition-colors hover:bg-sage/50 focus-visible:outline-offset-[-3px]">
          <p className="flex items-center gap-2 font-semibold">{item.unread && <><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-saffron" /><span className="sr-only">Unread: </span></>}{item.title}</p><p className="mt-1 text-sm leading-relaxed text-ink/75">{item.message}</p><time dateTime={item.createdAt} className="mt-2 block text-xs text-ink/60">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(item.createdAt))} IST</time>
        </Link></li>)}</ul>
      </div>
      <div className="border-t border-leaf/15 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-xs text-ink/60">Latest 30 updates · Refreshes every minute</div>
    </dialog>, document.body)}
  </>;
}
