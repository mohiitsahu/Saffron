"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "hidden" | "shown" | "done";

const phaseClass: Record<Phase, string> = {
  idle: "",
  // No transition here, so content that is off screen snaps to hidden instead of fading out first.
  hidden: "translate-y-6 opacity-0",
  shown: "translate-y-0 opacity-100 transition duration-700 ease-out",
  done: "",
};

// Fades content in as it scrolls into view. Anything already on screen when the page loads is
// left alone (so nothing flashes), and people who prefer reduced motion never see the effect.
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setPhase("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${phaseClass[phase]}`.trim()}
      style={phase === "shown" ? { transitionDelay: `${delay}ms` } : undefined}
      onTransitionEnd={(e) => {
        // Drop the animation classes once finished so no transform is left on the element.
        if (e.target === e.currentTarget && phase === "shown") setPhase("done");
      }}
    >
      {children}
    </div>
  );
}