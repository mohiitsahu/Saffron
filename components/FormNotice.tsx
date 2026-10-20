import type { ReactNode } from "react";

export default function FormNotice({ kind = "success", children }: { kind?: "success" | "error" | "info"; children: ReactNode }) {
  const surface = kind === "error" ? "border-danger/25 bg-danger/5 text-danger" : "border-leaf/25 bg-sage/40 text-forest";
  return <div role={kind === "error" ? "alert" : "status"} aria-atomic="true" className={`break-words rounded-xl border px-4 py-3 text-sm font-medium leading-relaxed ${surface}`}>{children}</div>;
}
