"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { accentButton, outlineLightButton } from "@/lib/ui";
import SignOutButton from "@/components/SignOutButton";

type NavLink = { href: string; label: string; alert?: boolean };

function Dot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -right-2.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-saffron ring-2 ring-forest"
      />
      <span className="sr-only">
        ({count} new {count === 1 ? "request" : "requests"})
      </span>
    </>
  );
}

export default function NavMenu({
  links,
  signedIn,
  name,
  isChef,
  pendingRequests,
}: {
  links: NavLink[];
  signedIn: boolean;
  name: string;
  isChef: boolean;
  pendingRequests: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(pendingRequests);
  const pathname = usePathname();

  // Pick up the fresh count whenever the server re-renders the page (for example after Accept).
  useEffect(() => {
    setPending(pendingRequests);
  }, [pendingRequests]);

  // Chefs: check for new requests once a minute while the tab is visible, and when they come back to it.
  useEffect(() => {
    if (!isChef) return;
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!stopped) setPending(Number(data.pendingRequests) || 0);
      } catch {
        // Ignore network blips. The next check will try again.
      }
    }

    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [isChef]);

  const itemClass = (href: string) =>
    `flex min-h-[44px] items-center rounded-md px-3 text-base font-medium text-cream hover:bg-white/10 focus-visible:outline-cream ${
      pathname === href || pathname.startsWith(href + "/")
        ? "underline decoration-saffron decoration-2 underline-offset-8"
        : ""
    }`;

  const label = (link: NavLink) => (
    <span className="relative">
      {link.label}
      {link.alert && <Dot count={pending} />}
    </span>
  );

  // After signing in, come back to the page the person was on.
  const signInHref =
    pathname === "/" || pathname.startsWith("/signin")
      ? "/signin"
      : `/signin?callbackUrl=${encodeURIComponent(pathname)}`;

  const menuLabel = `${open ? "Close menu" : "Open menu"}${
    pending > 0 ? ` (${pending} new ${pending === 1 ? "request" : "requests"})` : ""
  }`;

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={itemClass(link.href)}>
            {label(link)}
          </Link>
        ))}
        {signedIn ? (
          <SignOutButton className={`${outlineLightButton} ml-2`} />
        ) : (
          <Link href={signInHref} className={`${accentButton} ml-2 focus-visible:outline-cream`}>
            Sign in
          </Link>
        )}
      </nav>

      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-md border border-white/30 text-cream focus-visible:outline-cream md:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={menuLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        {pending > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-saffron ring-2 ring-forest"
          />
        )}
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="absolute inset-x-0 top-full border-b border-white/10 bg-forest px-4 pb-4 pt-2 shadow-lg md:hidden"
        >
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={itemClass(link.href)} onClick={() => setOpen(false)}>
                  {label(link)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-white/10 pt-3">
            {signedIn && <p className="mb-2 truncate px-3 text-sm text-cream/70">{name}</p>}
            {signedIn ? (
              <SignOutButton className={`${outlineLightButton} w-full`} />
            ) : (
              <Link
                href={signInHref}
                className={`${accentButton} w-full focus-visible:outline-cream`}
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}