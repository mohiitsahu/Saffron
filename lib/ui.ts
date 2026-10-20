export const inputClass =
  "box-border w-full min-w-0 max-w-full rounded-lg border border-leaf/40 bg-white/60 px-3.5 py-3 text-base text-ink shadow-sm transition duration-200 placeholder:text-ink/50 hover:border-leaf/70 focus:border-leaf focus:bg-white focus:shadow-soft";

export const labelClass = "mb-1 block text-sm font-medium";

export const pageClass = "w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8";
export const panelClass = "rounded-2xl border border-leaf/25 bg-white/40 p-4 shadow-soft sm:p-6";

const buttonBase =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-2.5 text-base font-semibold transition duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export const primaryButton = `${buttonBase} bg-leaf text-white shadow-sm hover:bg-forest hover:shadow-md`;
export const accentButton = `${buttonBase} bg-saffron text-ink shadow-sm hover:brightness-105 hover:shadow-md`;
export const outlineButton = `${buttonBase} border border-leaf text-leaf hover:bg-sage`;
export const dangerButton = `${buttonBase} border border-danger text-danger hover:bg-danger/10`;
// For dark backgrounds such as the navbar.
export const outlineLightButton = `${buttonBase} border border-cream/60 text-cream hover:bg-white/10 focus-visible:outline-cream`;
