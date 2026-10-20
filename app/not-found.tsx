import Link from "next/link";
import { outlineButton, primaryButton } from "@/lib/ui";
export default function NotFound() {
  return <section className="mx-auto max-w-xl px-4 py-16">
    <p className="font-semibold text-leaf">Page not found</p>
    <h1 className="mt-3 text-3xl font-bold">Let’s find your next meal</h1>
    <p className="mt-3 text-ink/75">This link may be out of date, or the chef profile may no longer be available.</p>
    <div className="mt-6 flex flex-wrap gap-3"><Link href="/chefs" className={primaryButton}>Find a chef</Link><Link href="/" className={outlineButton}>Go home</Link></div>
  </section>;
}
