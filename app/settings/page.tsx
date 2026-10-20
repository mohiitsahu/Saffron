import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_DELETION_REASON } from "@/lib/account";
import AccountSettings from "@/components/AccountSettings";
import SignInButton from "@/components/SignInButton";
import SignOutButton from "@/components/SignOutButton";
import { outlineButton } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings | Saffron", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
    <h1 className="text-3xl font-bold">Account settings</h1>
    <p className="mt-2 text-ink/70">Sign in to manage your account and bookings.</p>
    <section className="mt-6 rounded-2xl border border-leaf/25 bg-white/50 p-5 sm:p-6" aria-labelledby="settings-signin">
      <h2 id="settings-signin" className="text-xl font-bold">Sign in to Saffron</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">Use your Google account to book a chef, manage your details, or check your help requests.</p>
      <div className="mt-5"><SignInButton callbackUrl="/settings" /></div>
      <p className="mt-4 text-xs leading-relaxed text-ink/65">Read our <Link href="/terms" className="text-leaf underline">Terms</Link> and <Link href="/privacy" className="text-leaf underline">Privacy notice</Link> before using Saffron.</p>
    </section>
  </div>;
  const [user, request] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true, chefProfile: { select: { id: true } } } }),
    prisma.report.findFirst({ where: { reporterId: session.user.id, reason: ACCOUNT_DELETION_REASON }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { status: true, createdAt: true, resolutionNote: true } }),
  ]);
  if (!user) redirect("/signin?callbackUrl=/settings");
  return <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
    <h1 className="text-3xl font-bold">Account settings</h1>
    <p className="mb-6 mt-2 text-ink/70">Manage your details and your account requests.</p>
    <section aria-labelledby="settings-session" className="mb-6 flex flex-col gap-4 rounded-2xl border border-leaf/25 bg-sage/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0"><h2 id="settings-session" className="text-lg font-bold">You’re signed in</h2><p className="mt-1 break-words text-sm text-ink/70">{user.email ?? user.name ?? "Your Saffron account"}</p></div>
      <SignOutButton className={`${outlineButton} w-full shrink-0 sm:w-auto`} />
    </section>
    <AccountSettings initialName={user.name ?? ""} initialPhone={user.phone ?? ""} email={user.email ?? ""} isChef={Boolean(user.chefProfile)} deletionRequest={request ? { ...request, createdAt: request.createdAt.toISOString() } : null} />
  </div>;
}
