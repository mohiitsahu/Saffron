import Link from "next/link";
import type { ReactNode } from "react";

export default function InfoPage({ title, intro, sections }: { title: string; intro: string; sections: { id: string; title: string; content: ReactNode }[] }) {
  return <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
    <p className="text-xs font-semibold uppercase tracking-widest text-leaf">Saffron guide</p>
    <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
    <p className="mt-3 leading-relaxed text-ink/75">{intro}</p>
    <p className="mt-3 text-xs text-ink/60">Updated 20 October 2026</p>
    <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2 rounded-xl bg-sage/45 p-3">
      {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-leaf underline underline-offset-4">{section.title}</a>)}
    </nav>
    <div className="mt-8 space-y-8">{sections.map((section) => <section id={section.id} key={section.id} className="scroll-mt-24"><h2 className="text-xl font-bold">{section.title}</h2><div className="mt-3 space-y-3 break-words text-sm leading-7 text-ink/80 [&_a]:font-medium [&_a]:text-leaf [&_a]:underline [&_a]:underline-offset-4">{section.content}</div></section>)}</div>
    <nav aria-label="More information" className="mt-10 flex flex-wrap gap-5 border-t border-leaf/20 pt-6 text-sm font-semibold text-leaf"><Link href="/help">Help and contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation">Cancellation</Link></nav>
  </article>;
}
