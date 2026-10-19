import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countPendingRequests } from "@/lib/pendingRequests";
import { formatINR, menuLines } from "@/lib/format";
import { CheckCircleIcon, PinIcon, StarIcon } from "@/components/Icons";
import ShareProfile from "@/components/ShareProfile";
import AvailabilityManager from "@/components/AvailabilityManager";
import { todayIST } from "@/lib/availability";
import { outlineButton, primaryButton } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ChefIdCardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin?callbackUrl=/chef");
  }

  const userId = session.user.id;
  const profile = await prisma.chefProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      bio: true,
      city: true,
      cuisines: true,
      pricePerPerson: true,
      maxGuests: true,
      yearsExperience: true,
      photoUrl: true,
      sampleMenu: true,
      verified: true,
      active: true,
      suspended: true,
      createdAt: true,
    },
  });

  if (!profile) redirect("/cook-with-us");

  const [blocked, agg, completed, pending] = await Promise.all([
    prisma.chefBlockedDay.findMany({
      where: { userId, day: { gte: todayIST() } },
      orderBy: { day: "asc" },
      take: 200,
      select: { day: true },
    }),
    prisma.review.aggregate({
      where: { chefId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.booking.count({ where: { chefId: userId, status: "COMPLETED" } }),
    countPendingRequests(userId),
  ]);

  const avg = agg._avg.rating;
  const reviewCount = agg._count._all;
  const chefId = `SF-${profile.id.slice(-6).toUpperCase()}`;
  const memberSince = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(profile.createdAt);

  const checklist = [
    { done: Boolean(profile.photoUrl), text: "Add a clear photo of you or your food" },
    { done: profile.bio.trim().length >= 100, text: "Write a bio of at least 100 characters" },
    { done: menuLines(profile.sampleMenu).length >= 3, text: "List at least 3 dishes in your sample menu" },
    { done: profile.verified, text: "Get verified. Saffron checks IDs by hand" },
  ];
  const doneCount = checklist.filter((item) => item.done).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Your chef profile</h1>
      <p className="mt-1 text-ink/70">This is how you appear on Saffron.</p>
      {profile.suspended && <p role="status" className="mt-4 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">An administrator has hidden your listing. You can edit your details, but an administrator must restore visibility.</p>}

      {pending > 0 && (
        <Link
          href="/bookings"
          className="mt-4 flex animate-fade-in items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 transition-colors hover:bg-danger/10"
        >
          <span className="flex items-center gap-2 font-medium">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-danger" />
            {pending} new {pending === 1 ? "request is" : "requests are"} waiting for your answer
          </span>
          <span className="font-semibold underline underline-offset-4">Review</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article className="animate-fade-up overflow-hidden rounded-2xl border-2 border-dashed border-leaf bg-cream shadow-soft">
          <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-forest to-leaf px-5 py-3 text-white">
            <span className="font-heading text-lg font-extrabold tracking-wide text-saffron">SAFFRON</span>
            <span className="text-xs font-semibold uppercase tracking-widest">Chef ID · {chefId}</span>
          </header>

          <div className="flex flex-col gap-5 p-5 sm:flex-row">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt={profile.displayName}
                className="h-40 w-full flex-none rounded-xl object-cover sm:h-32 sm:w-32"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-40 w-full flex-none items-center justify-center rounded-xl bg-sage font-heading text-6xl font-bold text-leaf sm:h-32 sm:w-32"
              >
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold">{profile.displayName}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-ink/70">
                <PinIcon className="h-4 w-4 flex-none" />
                {profile.city} · {profile.yearsExperience} yrs experience
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {profile.verified ? (
                  <span className="rounded-full bg-leaf px-2.5 py-0.5 text-xs font-semibold text-white">
                    ✓ Verified chef
                  </span>
                ) : (
                  <span className="rounded-full border border-ink/30 px-2.5 py-0.5 text-xs font-semibold">
                    Not verified yet
                  </span>
                )}
                {!profile.active && (
                  <span className="rounded-full bg-saffron px-2.5 py-0.5 text-xs font-semibold text-ink">
                    Not accepting requests
                  </span>
                )}
              </div>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {profile.cuisines.map((cuisine) => (
                  <li key={cuisine} className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-medium capitalize">
                    {cuisine}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t-2 border-dashed border-leaf/50 p-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Rating</dt>
              <dd className="mt-0.5 flex items-center gap-1 font-bold">
                {avg ? (
                  <>
                    <StarIcon className="h-4 w-4 text-saffron" />
                    {avg.toFixed(1)}
                    <span className="text-xs font-normal text-ink/60">({reviewCount})</span>
                  </>
                ) : (
                  <span className="font-normal text-ink/60">No reviews yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Completed</dt>
              <dd className="mt-0.5 font-bold">
                {completed} {completed === 1 ? "booking" : "bookings"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Price</dt>
              <dd className="mt-0.5 font-bold">{formatINR(profile.pricePerPerson)} / guest</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Cooks for</dt>
              <dd className="mt-0.5 font-bold">Up to {profile.maxGuests} guests</dd>
            </div>
          </dl>

          <footer className="border-t-2 border-dashed border-leaf/50 px-5 py-4 text-sm text-ink/70">
            <p>Member since {memberSince}</p>
            <p className="mt-1">
              {profile.verified
                ? "Saffron has checked your ID."
                : "Verified chefs get a badge and appear first in search. Saffron checks IDs by hand."}
            </p>
          </footer>
        </article>

        <aside className="animate-fade-up space-y-4" style={{ animationDelay: "120ms" }}>
          <div className="flex flex-col gap-3 [&>*]:w-full">
            <Link href="/cook-with-us" className={primaryButton}>
              Edit profile
            </Link>
            <Link href={`/chefs/${profile.id}`} className={outlineButton}>
              View public page
            </Link>
            <ShareProfile path={`/chefs/${profile.id}`} name={profile.displayName} />
          </div>

          <AvailabilityManager initialDays={blocked.map((b) => b.day)} today={todayIST()} />

          <div className="rounded-2xl bg-sage p-5">
            <h2 className="font-bold">Make your profile stand out</h2>
            <p className="mt-1 text-sm text-ink/70">
              {doneCount} of {checklist.length} done
            </p>
            <ul className="mt-3 space-y-2.5 text-sm">
              {checklist.map((item) => (
                <li key={item.text} className="flex gap-2.5">
                  {item.done ? (
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-leaf" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 flex-none rounded-full border-2 border-ink/40"
                    />
                  )}
                  <span className={item.done ? "text-ink/70 line-through" : ""}>
                    <span className="sr-only">{item.done ? "Done: " : "To do: "}</span>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
