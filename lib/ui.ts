export const inputClass =
  "w-full rounded-md border border-leaf/50 bg-cream px-3 py-3 text-base text-ink placeholder:text-ink/50";

export const labelClass = "mb-1 block text-sm font-medium";

const buttonBase =
  "inline-flex min-h-[44px] items-center justify-center rounded-md px-5 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButton = `${buttonBase} bg-leaf text-white hover:bg-leaf/90`;
export const accentButton = `${buttonBase} bg-saffron text-ink hover:bg-saffron/90`;
export const outlineButton = `${buttonBase} border border-leaf text-leaf hover:bg-sage/30`;
export const dangerButton = `${buttonBase} border border-danger text-danger hover:bg-danger/10`;