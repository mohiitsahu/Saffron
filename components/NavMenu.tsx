"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { accentButton, outlineLightButton } from "@/lib/ui";
import SignOutButton from "@/components/SignOutButton";

type NavLink = { href: string; label: string };

export default function NavMenu({
  links,
  signedIn,
  name,
}: {
  links: NavLink[];
  signedIn: boolean;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The gold underline slides in on hover and stays on the page you are on.
  const itemClass = (href: string) =>
    `relative flex min-h-[44px] items-center rounded-md px-3 text-base font-medium transition-colors hover:bg-white/10 focus-visible:outline-cream after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-left after:rounded-full after:bg-saffron after:transition-transform after:duration-300 ${
      pathname === href || pathname.startsWith(href + "/")
        ? "text-white after:scale-x-100"
        : "text-cream/90 after:scale-x-0 hover:text-white hover:after:scale-x-100"
    }`;

  // After signing in, come back to the page the person was on.
  const signInHref =
    pathname === "/" || pathname.startsWith("/signin")
      ? "/signin"
      : `/signin?callbackUrl=${encodeURIComponent(pathname)}`;

  const menuLabel = open ? "Close menu" : "Open menu";

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={itemClass(link.href)}>
            {link.label}
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
        className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 text-cream transition duration-200 hover:bg-white/10 active:scale-95 focus-visible:outline-cream lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={menuLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="absolute inset-x-0 top-full animate-slide-down border-b border-white/10 bg-forest px-4 pb-4 pt-2 shadow-lg lg:hidden"
        >
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={itemClass(link.href)} onClick={() => setOpen(false)}>
                  {link.label}
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
