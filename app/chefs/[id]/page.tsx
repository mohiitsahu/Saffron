import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { settleStaleBookings } from "@/lib/bookings";
import { todayIST } from "@/lib/availability";
import { firstName, formatDateIST, formatINR, menuLines } from "@/lib/format";
import { CheckCircleIcon, PinIcon, StarIcon } from "@/components/Icons";
import BookingForm from "@/components/BookingForm";
import Reveal from "@/components/Reveal";
import { pageClass, primaryButton } from "@/lib/ui";
import { bookingCreateSchema } from "@/lib/validation";
import ReportForm from "@/components/ReportForm";
import MealGallery from "@/components/MealGallery";
import { mealPhotoOrder, mealPhotoSelect } from "@/lib/meals";

export const dynamic = "force-dynamic";

const expect = [
  "Send a request with your date, guests and area.",
  "The chef accepts or declines. You can cancel any time before the event.",
  "After they accept, you get their phone number and they get your address.",
  "The chef cooks in your kitchen. You pay them directly by UPI or cash.",
];

export default async function ChefProfilePage({ params, searchParams }: { params: { id: string }; searchParams: { eventDate?: string; guests?: string } }) {
  // Phone is deliberately not selected: it is only revealed after a booking is accepted.
  const chef = await prisma.chefProfile.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
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
    },
  });

  if (!chef || !chef.active || chef.suspended) notFound();
  const selectedDate = bookingCreateSchema.shape.eventDate.safeParse(searchParams.eventDate);
  const selectedGuests = Number(searchParams.guests);

  const [session, agg, reviews, completed, blocked, mealPhotos] = await Promise.all([
    getAppSession(),
    prisma.review.aggregate({
      where: { chefId: chef.userId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { chefId: chef.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.booking.count({ where: { chefId: chef.userId, status: "COMPLETED" } }),
    prisma.chefBlockedDay.findMany({
      where: { userId: chef.userId, day: { gte: todayIST() } },
      orderBy: { day: "asc" },
      take: 200,
      select: { day: true },
    }),
    prisma.mealPhoto.findMany({ where: { chefId: chef.id }, orderBy: [...mealPhotoOrder], select: mealPhotoSelect }),
  ]);

  const viewer = !session?.user ? "guest" : session.user.id === chef.userId ? "owner" : "customer";

  // A pending or accepted request blocks sending another one to the same chef.
  const customerId = viewer === "customer" ? session?.user.id : undefined;
  // Expire old unanswered requests first, so they don't hide the booking form.
  if (customerId) await settleStaleBookings({ customerId, chefId: chef.userId });
  const existing = customerId
    ? await prisma.booking.findFirst({
        where: {
          customerId,
          chefId: chef.userId,
          status: { in: ["REQUESTED", "ACCEPTED"] },
        },
        select: { status: true },
      })
    : null;
  const existingStatus =
    existing && (existing.status === "REQUESTED" || existing.status === "ACCEPTED") ? existing.status : null;

  const avg = agg._avg.rating;
  const count = agg._count._all;
  const menu = menuLines(chef.sampleMenu);

  return (
    <div className={pageClass}>
      <Link
        href="/chefs"
        className="group inline-flex items-center gap-1 text-sm font-medium text-leaf underline underline-offset-4"
      >
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-1">
          ←
        </span>
        Back to chefs
      </Link>

      <header className="mt-4 flex animate-fade-up flex-col gap-5 sm:flex-row sm:items-center">
        {chef.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chef.photoUrl}
            alt={chef.displayName}
            className="h-48 w-full flex-none rounded-2xl object-cover shadow-soft ring-4 ring-sage sm:h-44 sm:w-44"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-48 w-full flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-sage to-cream font-heading text-6xl font-bold text-leaf shadow-soft ring-4 ring-sage sm:h-44 sm:w-44"
          >
            {chef.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold sm:text-4xl">{chef.displayName}</h1>
            {chef.verified && (
              <span className="rounded-full bg-leaf px-2.5 py-0.5 text-xs font-semibold text-white">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-ink/70">
            <PinIcon className="h-4 w-4 flex-none" />
            {chef.city} · {chef.yearsExperience} yrs experience
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {avg ? (
              <span className="flex items-center gap-1.5 font-semibold">
                <StarIcon className="h-4 w-4 text-saffron" />
                {avg.toFixed(1)}
                <span className="font-normal text-ink/70">
                  ({count} {count === 1 ? "review" : "reviews"})
                </span>
              </span>
            ) : (
              <span className="text-ink/70">No reviews yet</span>
            )}
            {completed > 0 && (
              <span className="text-ink/70">
                {completed} {completed === 1 ? "booking" : "bookings"} completed
              </span>
            )}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {chef.cuisines.map((cuisine) => (
              <li key={cuisine} className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-medium capitalize">
                {cuisine}
              </li>
            ))}
          </ul>
          <a href="#book" className={`${primaryButton} mt-4`}>
            Request this chef
          </a>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          {mealPhotos.length > 0 && <div className="min-w-0 lg:col-span-2"><MealGallery photos={mealPhotos} chefName={chef.displayName} /></div>}
          <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-leaf/25 bg-white/40 p-5 shadow-soft sm:grid-cols-4 lg:col-span-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Price</dt>
              <dd className="mt-0.5 font-bold">{formatINR(chef.pricePerPerson)} / guest</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Cooks for</dt>
              <dd className="mt-0.5 font-bold">Up to {chef.maxGuests} guests</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Experience</dt>
              <dd className="mt-0.5 font-bold">{chef.yearsExperience} years</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Completed</dt>
              <dd className="mt-0.5 font-bold">{completed} {completed === 1 ? "booking" : "bookings"}</dd>
            </div>
          </dl>

          <section>
            <h2 className="text-2xl font-bold">About</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-line">{chef.bio}</p>
          </section>

          <Reveal>
          {menu.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold">Sample menu</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {menu.map((dish, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-sage px-4 py-2.5 text-sm font-medium transition duration-200 hover:bg-saffron/25 motion-safe:hover:-translate-y-0.5"
                  >
                    {dish}
                  </li>
                ))}
              </ul>
            </section>
          )}
          </Reveal>

          <Reveal>
          <section className="rounded-2xl border-2 border-dashed border-leaf/60 p-5">
            <h2 className="text-2xl font-bold">What to expect</h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-2">
              {expect.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-forest font-heading text-sm font-bold text-saffron">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm text-ink/80">{step}</p>
                </li>
              ))}
            </ol>
          </section>
          </Reveal>

          <Reveal>
          <section>
            <h2 className="text-2xl font-bold">Reviews</h2>
            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-ink/80">
                No reviews yet. Reviews only come from completed bookings made on Saffron.
              </p>
            ) : (
              <ul className="mt-3 grid gap-4 xl:grid-cols-2">
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-2xl border border-leaf/25 bg-white/40 p-4 shadow-soft transition duration-200 hover:shadow-lift"
                  >
                    <p className="text-saffron" aria-label={`${review.rating} out of 5 stars`}>
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </p>
                    {review.comment && <p className="mt-1">{review.comment}</p>}
                    <p className="mt-2 text-xs text-ink/70">
                      {firstName(review.customer.name)} · {formatDateIST(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </Reveal>
        </div>

        <div className="min-w-0 space-y-4">
          <BookingForm
            initialEventDate={selectedDate.success ? searchParams.eventDate : ""}
            initialGuests={Number.isInteger(selectedGuests) && selectedGuests >= 1 && selectedGuests <= chef.maxGuests ? selectedGuests : undefined}
            chefProfileId={chef.id}
            chefName={chef.displayName}
            pricePerPerson={chef.pricePerPerson}
            maxGuests={chef.maxGuests}
            viewer={viewer}
            existingStatus={existingStatus}
            unavailableDays={blocked.map((b) => b.day)}
          />
          {session?.user && viewer !== "owner" && <ReportForm targetType="chef" targetId={chef.id} />}

          <div className="rounded-2xl bg-sage p-5 shadow-soft">
            <h2 className="font-bold">Booking safely</h2>
            <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-leaf" />
                {chef.verified
                  ? "Saffron has checked this chef's ID."
                  : "This chef isn't verified yet. Verified chefs have had their ID checked by Saffron."}
              </li>
              <li className="flex gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-leaf" />
                Your address and phone are shared only if the chef accepts.
              </li>
              <li className="flex gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-leaf" />
                You pay the chef directly after the meal. Nothing is charged online.
              </li>
              <li className="flex gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-leaf" />
                You can cancel any time before the event.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
