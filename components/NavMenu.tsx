"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

export default function NavMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const isCurrent = (href: string) => {
    const path = href.split("?")[0];
    if (path === "/chef" && pathname === "/cook-with-us") return true;
    return pathname === path || pathname.startsWith(path + "/");
  };
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !toggle.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); desktop.removeEventListener("change", resize); };
  }, [open]);

  // The gold underline slides in on hover and stays on the page you are on.
  const itemClass = (href: string) =>
    `relative flex min-h-[44px] items-center rounded-md px-3 text-base font-medium transition-colors hover:bg-white/10 focus-visible:outline-cream after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-left after:rounded-full after:bg-saffron after:transition-transform after:duration-300 ${
      isCurrent(href)
        ? "text-white after:scale-x-100"
        : "text-cream/90 after:scale-x-0 hover:text-white hover:after:scale-x-100"
    }`;

  const menuLabel = open ? "Close menu" : "Open menu";

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined} className={itemClass(link.href)}>
            {link.label}
          </Link>
        ))}

      </nav>

      <button
        ref={toggle}
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
          ref={menu}
          id="mobile-menu"
          aria-label="Mobile"
          className="absolute inset-x-0 top-full animate-slide-down border-b border-white/10 bg-forest px-4 pb-4 pt-2 shadow-lg lg:hidden"
        >
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined} className={itemClass(link.href)} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

        </nav>
      )}
    </>
  );
}
