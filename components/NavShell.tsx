"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Height of the bar. Kept in one place so the home page hero can slide up underneath it.
const BAR = "h-[72px]";

// The navbar's outer shell:
// - On the home page it is see-through at the top, so it blends into the hero,
//   and the hero slides up underneath it.
// - After a little scrolling it gets a frosted green background.
// - It slides away when you scroll down and comes back as soon as you scroll up.
export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      ticking = false;
      const y = Math.max(window.scrollY, 0); // iOS rubber-banding can report negatives
      const delta = y - lastY;

      setScrolled(y > 8);

      if (y < 80) {
        setHidden(false);
      } else if (Math.abs(delta) > 6) {
        // Never hide while the mobile menu is open or something inside the bar has focus.
        const busy =
          Boolean(document.getElementById("mobile-menu")) ||
          Boolean(ref.current?.contains(document.activeElement));
        setHidden(delta > 0 && !busy);
      } else {
        return; // tiny movement: keep the last direction
      }
      lastY = y;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Start fresh on every page change.
  useEffect(() => {
    setHidden(false);
  }, [pathname]);

  const surface = scrolled
    ? "border-white/10 bg-forest/85 shadow-[0_10px_30px_-16px_rgba(0,0,0,0.6)] backdrop-blur-md supports-[backdrop-filter]:bg-forest/75"
    : isHome
      ? "border-transparent bg-transparent"
      : "border-white/10 bg-forest";

  return (
    <header
      ref={ref}
      className={`sticky top-0 z-40 ${BAR} border-b transition-[transform,background-color,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none ${surface} ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${isHome ? "-mb-[72px]" : ""}`}
    >
      <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-4">{children}</div>
    </header>
  );
}