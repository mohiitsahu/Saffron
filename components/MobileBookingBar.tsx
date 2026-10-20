"use client";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { primaryButton } from "@/lib/ui";

export default function MobileBookingBar({ pricePerPerson }: { pricePerPerson: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const form = document.getElementById("book");
    if (!form || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0 });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  if (!visible) return null;
  return <div data-booking-bar className="lg:hidden">
    <div aria-hidden="true" className="h-24" />
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-leaf/25 bg-cream px-4 pt-3 shadow-lift pb-[max(.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><p className="shrink-0 text-lg font-bold">{formatINR(pricePerPerson)}<span className="block text-xs font-normal text-ink/70">per guest</span></p><a href="#book" className={`${primaryButton} text-sm`} onClick={() => document.getElementById("book-heading")?.focus({ preventScroll: true })}>Request this chef</a></div>
    </div>
  </div>;
}
