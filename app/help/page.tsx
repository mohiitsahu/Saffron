import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTimeIST } from "@/lib/format";
import { primaryButton } from "@/lib/ui";
import SupportForm from "@/components/SupportForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help and contact | Saffron" };
const questions = [
  ["When is my booking confirmed?", "A request is confirmed when the chef accepts it. If the chef suggests a new time, you must accept that time before it becomes a confirmed booking. Check My bookings for its current status."],
  ["What is included in the price?", "The estimate uses the chef’s per-person price and your guest count. Agree the menu, groceries, travel and any extras directly with the chef. Pay the chef directly after the meal; Saffron takes no online payment."],
  ["When are phone numbers and addresses shared?", "Contact details are shared after the booking is accepted. Before that, the chef can see event details, guest count, area and food notes, but not your full address or phone number."],
  ["Can I cancel or change the time?", "You can cancel before the event time in My bookings. A chef can suggest another time while a request is pending. Once a booking is accepted, discuss changes directly; the app does not change an accepted time automatically."],
  ["What if my request has not been answered?", "It remains pending until the chef answers, you withdraw it, or its event time passes. You can cancel a pending request in My bookings and choose another chef."],
  ["How do I report a problem?", "Open the booking or chef profile and use Report a problem. Include what happened and the booking reference where relevant. An administrator reviews reports. For general account questions, use the form below."],
  ["How do I change or delete my account?", "Open Account settings to edit your name and phone or send an account deletion request. Requests are reviewed by an administrator; your account and bookings are not deleted automatically."],
];

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  const requests = session?.user ? await prisma.report.findMany({ where: { reporterId: session.user.id, reason: { in: ["support", "privacy"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, select: { id: true, details: true, reason: true, status: true, createdAt: true, resolutionNote: true } }) : [];
  return <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
    <h1 className="text-3xl font-bold sm:text-4xl">Help and contact</h1><p className="mt-3 text-ink/75">Answers for your next meal, and a way to reach the Saffron administrator.</p>
    <nav aria-label="Useful pages" className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-leaf"><Link className="inline-flex min-h-11 items-center underline" href="/bookings">My bookings</Link><Link className="inline-flex min-h-11 items-center underline" href="/settings">Account settings</Link><Link className="inline-flex min-h-11 items-center underline" href="/cancellation">Cancellation details</Link></nav>
    <section aria-label="Common questions" className="mt-6 space-y-3">{questions.map(([question, answer]) => <details key={question} className="rounded-xl border border-leaf/25 bg-white/40 p-4"><summary className="min-h-11 cursor-pointer content-center font-semibold">{question}</summary><p className="mt-3 text-sm leading-relaxed text-ink/75">{answer}</p></details>)}</section>
    <section id="contact" className="mt-8 scroll-mt-24 rounded-2xl border border-leaf/25 bg-sage/30 p-5 sm:p-6"><h2 className="text-xl font-bold">Contact Saffron</h2><p className="mt-2 text-sm leading-relaxed text-ink/75">Send an account, app or privacy question. An administrator can reply here; check Your messages below for updates. This is not a live chat.</p>{session?.user ? <SupportForm /> : <Link href="/signin?callbackUrl=/help%23contact" className={`${primaryButton} mt-4`}>Sign in to send a message</Link>}</section>
    {session?.user && <section aria-labelledby="your-messages" className="mt-8"><h2 id="your-messages" className="text-xl font-bold">Your messages</h2><p className="mt-1 text-xs text-ink/65">Your latest 10 messages. Refresh this page to check for replies.</p><ul className="mt-4 space-y-4">{requests.map((request) => <li key={request.id} className="rounded-xl border border-leaf/20 bg-white/40 p-4 text-sm"><p className="font-semibold">{request.reason === "privacy" ? "Privacy request" : "Help request"} · {request.status === "OPEN" ? "Waiting for reply" : "Closed"}</p><p className="mt-1 text-xs text-ink/60">{formatDateTimeIST(request.createdAt)} · #{request.id.slice(-6).toUpperCase()}</p><p className="mt-3 whitespace-pre-wrap break-words">{request.details}</p>{request.resolutionNote && <div className="mt-3 rounded-lg bg-sage/50 p-3"><p className="font-semibold">Saffron reply</p><p className="mt-1 whitespace-pre-wrap break-words">{request.resolutionNote}</p></div>}</li>)}</ul>{requests.length === 0 && <p className="mt-4 text-sm text-ink/70">You haven’t sent any messages yet.</p>}</section>}
  </div>;
}
