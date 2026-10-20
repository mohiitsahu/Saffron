import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { formatDateIST, formatDateTimeIST } from "@/lib/format";
import AdminChefRow from "@/components/AdminChefRow";
import AdminReportCard from "@/components/AdminReportCard";
import { mealPhotoOrder, mealPhotoSelect } from "@/lib/meals";
import { inputClass, outlineButton } from "@/lib/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin | Saffron", robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string; reports?: string } }) {
  if (!(await getAdminSession())) notFound();
  const q = (typeof searchParams.q === "string" ? searchParams.q : "").trim().slice(0, 80);
  const status = ["pending", "verified", "hidden"].includes(searchParams.status ?? "") ? searchParams.status : "all";
  const reportStatus = ["RESOLVED", "DISMISSED"].includes(searchParams.reports ?? "") ? searchParams.reports! : "OPEN";
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(searchParams.page) || 1)));
  const where: Prisma.ChefProfileWhereInput = {
    ...(status === "pending" ? { verified: false, suspended: false } : status === "verified" ? { verified: true, suspended: false } : status === "hidden" ? { suspended: true } : {}),
    ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [chefs, total, pending, openReports, reports, actions] = await Promise.all([
    prisma.chefProfile.findMany({ where, orderBy: [{ verified: "asc" }, { createdAt: "desc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25,
      select: { mealPhotos: { orderBy: [...mealPhotoOrder], select: mealPhotoSelect }, id: true, displayName: true, city: true, photoUrl: true, verified: true, active: true, suspended: true, createdAt: true, bio: true, sampleMenu: true, pricePerPerson: true, maxGuests: true, user: { select: { email: true } } } }),
    prisma.chefProfile.count({ where }), prisma.chefProfile.count({ where: { verified: false, suspended: false } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.report.findMany({ where: { status: reportStatus }, orderBy: { createdAt: "desc" }, take: 50,
      include: { reporter: { select: { email: true, name: true } }, chefProfile: { select: { displayName: true } }, booking: { select: { id: true, chef: { select: { chefProfile: { select: { displayName: true } } } } } } } }),
    prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const pageUrl = (n: number) => `/admin?${new URLSearchParams({ q, status: status ?? "all", page: String(n), reports: reportStatus })}`;
  return <div className="w-full space-y-10 px-4 py-8 sm:px-6 lg:px-8">
    <header><h1 className="text-3xl font-bold">Admin</h1><p className="mt-2 text-ink/70">{pending} {pending === 1 ? "profile" : "profiles"} waiting for review · {openReports} open {openReports === 1 ? "report" : "reports"}</p></header>
    <section aria-labelledby="chef-queue"><h2 id="chef-queue" className="text-2xl font-bold">Chef review queue</h2>
      <form className="my-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="text-sm">Search name, city or email<input name="q" defaultValue={q} className={inputClass} /></label>
        <label className="text-sm">Profile status<select name="status" defaultValue={status} className={inputClass}><option value="all">All profiles</option><option value="pending">Needs review</option><option value="verified">Verified</option><option value="hidden">Admin-hidden</option></select></label>
        <button className={`${outlineButton} self-end`}>Filter profiles</button>
      </form>
      <p className="mb-4 text-sm">{total} matching {total === 1 ? "profile" : "profiles"} · page {page} of {Math.max(1, Math.ceil(total / 25))}</p>
      <ul className="space-y-3">{chefs.map((chef) => <AdminChefRow key={chef.id} chef={{ ...chef, email: chef.user.email ?? "No email", createdAt: formatDateIST(chef.createdAt) }} />)}</ul>
      {chefs.length === 0 && <p>No profiles match these filters.</p>}
      <nav aria-label="Profile pages" className="mt-4 flex gap-3">{page > 1 && <Link href={pageUrl(page - 1)} className={outlineButton}>Previous</Link>}{page * 25 < total && <Link href={pageUrl(page + 1)} className={outlineButton}>Next</Link>}</nav>
    </section>
    <section aria-labelledby="report-queue"><h2 id="report-queue" className="text-2xl font-bold">Reports and account requests</h2>
      <nav aria-label="Report status" className="my-4 flex flex-wrap gap-3">{["OPEN", "RESOLVED", "DISMISSED"].map((s) => <Link aria-current={reportStatus === s ? "page" : undefined} key={s} href={`/admin?${new URLSearchParams({ q, status: status ?? "all", reports: s })}`} className={outlineButton}>{s.toLowerCase()}</Link>)}</nav>
      <ul className="space-y-3">{reports.map((report) => <AdminReportCard key={report.id} report={{ id: report.id, reason: report.reason, details: report.details, status: report.status,
        reporter: report.reporter.email ?? report.reporter.name ?? "Member", target: report.reason === "account_deletion" ? "Account deletion request" : report.reason === "support" ? "Help request" : report.reason === "privacy" ? "Privacy request" : report.chefProfile?.displayName ?? `Booking #${report.bookingId?.slice(-6).toUpperCase()} · ${report.booking?.chef.chefProfile?.displayName ?? "Chef"}`,
        createdAt: formatDateTimeIST(report.createdAt), resolutionNote: report.resolutionNote }} />)}</ul>
      {reports.length === 0 && <p>No {reportStatus.toLowerCase()} reports.</p>}
      <p className="mt-3 text-xs text-ink/65">Showing the latest 50 reports in this queue.</p>
    </section>
    <section><h2 className="text-2xl font-bold">Recent moderation actions</h2><ul className="mt-4 space-y-3">{actions.map((a) => <li key={a.id} className="break-words rounded-xl bg-sage/50 p-4 text-sm"><p className="font-semibold">{a.action} · {formatDateTimeIST(a.createdAt)}</p><p className="mt-1">{a.note}</p><p className="mt-1 text-xs text-ink/65">Target {a.targetId} · Admin {a.actorId}</p></li>)}</ul>{actions.length === 0 && <p className="mt-3">No moderation actions recorded yet.</p>}</section>
  </div>;
}
