// Food doodles drawn as outlines. The color comes from the text color class you pass in,
// so a low-opacity class such as text-cream/[0.13] keeps them subtle.
export default function DoodlePattern({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <pattern
          id="saffron-doodles"
          width="240"
          height="240"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {/* apple */}
            <g transform="translate(36 40) rotate(-12)">
              <path d="M0 -10 C-8 -18 -22 -12 -22 4 C-22 18 -10 26 0 22 C10 26 22 18 22 4 C22 -12 8 -18 0 -10Z" />
              <path d="M0 -10 C0 -18 2 -22 6 -24" />
              <path d="M6 -22 C12 -26 18 -24 20 -20 C14 -16 8 -18 6 -22Z" />
            </g>

            {/* pizza slice */}
            <g transform="translate(120 30) rotate(10)">
              <path d="M-22 -16 Q0 -28 22 -16" />
              <path d="M-22 -16 L0 28 L22 -16" />
              <path d="M-19 -9 Q0 -20 19 -9" />
              <circle cx="-6" cy="-2" r="4" />
              <circle cx="7" cy="3" r="3.5" />
              <circle cx="0" cy="15" r="3" />
            </g>

            {/* cupcake */}
            <g transform="translate(200 44) rotate(-8)">
              <path d="M-14 0 L-10 22 L10 22 L14 0Z" />
              <path d="M-6 0 L-4 22 M6 0 L4 22" />
              <path d="M-16 0 C-20 -10 -10 -14 -8 -20 C-4 -28 6 -26 8 -20 C14 -16 20 -10 16 0Z" />
              <circle cx="0" cy="-29" r="3" />
            </g>

            {/* fork */}
            <g transform="translate(26 116) rotate(18)">
              <path d="M-9 -26 V-10 C-9 -3 9 -3 9 -10 V-26" />
              <path d="M0 -26 V-2" />
              <path d="M0 -2 V26" />
            </g>

            {/* spoon */}
            <g transform="translate(62 118) rotate(-14)">
              <ellipse cx="0" cy="-14" rx="8" ry="12" />
              <path d="M0 -2 V26" />
            </g>

            {/* chef hat */}
            <g transform="translate(120 112) rotate(6)">
              <path d="M-16 22 V8 C-26 6 -26 -14 -12 -14 C-10 -26 10 -26 12 -14 C26 -14 26 6 16 8 V22Z" />
              <path d="M-16 14 H16" />
            </g>

            {/* donut */}
            <g transform="translate(200 118)">
              <circle r="20" />
              <circle r="7" />
              <path d="M-12 -10 l4 2 M8 -14 l3 3 M12 4 l-4 3 M-6 12 l-3 4 M-14 4 l4 -1" />
            </g>

            {/* chili */}
            <g transform="translate(38 196) rotate(-25)">
              <path d="M-10 -14 C8 -16 20 -2 18 18 C14 18 8 12 6 4 C4 -4 -4 -8 -12 -8Z" />
              <path d="M-10 -14 L-14 -20" />
            </g>

            {/* lemon slice */}
            <g transform="translate(112 198)">
              <circle r="18" />
              <circle r="14" />
              <path d="M0 -14 V14 M-12 -7 L12 7 M-12 7 L12 -7" />
            </g>

            {/* mushroom */}
            <g transform="translate(176 194) rotate(10)">
              <path d="M-20 4 C-20 -14 20 -14 20 4Z" />
              <path d="M-7 4 V18 C-7 24 7 24 7 18 V4" />
              <circle cx="-8" cy="-3" r="2" />
              <circle cx="6" cy="-6" r="2" />
              <circle cx="11" cy="0" r="1.5" />
            </g>

            {/* little sparkles between the doodles */}
            <path d="M84 84 h6 M87 81 v6" />
            <path d="M158 80 h6 M161 77 v6" />
            <path d="M232 164 h6 M235 161 v6" />
            <path d="M16 158 h6 M19 155 v6" />
            <circle cx="150" cy="156" r="1.8" />
            <circle cx="88" cy="168" r="1.8" />
            <circle cx="226" cy="82" r="1.8" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#saffron-doodles)" />
    </svg>
  );
}