import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { firstName, formatDateIST, formatINR, menuLines } from "@/lib/format";
import BookingForm from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function ChefProfilePage({ params }: { params: { id: string } }) {
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
    },
  });

  if (!chef || !chef.active) notFound();

  const [session, agg, reviews] = await Promise.all([
    getServerSession(authOptions),
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
  ]);

  const viewer = !session?.user ? "guest" : session.user.id === chef.userId ? "owner" : "customer";

  // A pending, accepted or declined request blocks sending another one to the same chef.
  const customerId = viewer === "customer" ? session?.user.id : undefined;
  const existing = customerId
    ? await prisma.booking.findFirst({
        where: {
          customerId,
          chefId: chef.userId,
          status: { in: ["REQUESTED", "ACCEPTED", "DECLINED"] },
        },
        select: { status: true },
      })
    : null;
  const existingStatus =
    existing && (existing.status === "REQUESTED" || existing.status === "ACCEPTED" || existing.status === "DECLINED")
      ? existing.status
      : null;

  const avg = agg._avg.rating;
  const count = agg._count._all;
  const menu = menuLines(chef.sampleMenu);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/chefs" className="text-sm font-medium text-leaf underline underline-offset-4">
        ← Back to chefs
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {chef.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chef.photoUrl}
            alt={chef.displayName}
            className="h-48 w-full flex-none rounded-xl object-cover sm:h-40 sm:w-40"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-48 w-full flex-none items-center justify-center rounded-xl bg-sage/40 font-heading text-6xl font-bold text-leaf sm:h-40 sm:w-40"
          >
            {chef.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{chef.displayName}</h1>
            {chef.verified && (
              <span className="rounded-full bg-leaf px-2.5 py-0.5 text-xs font-semibold text-white">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-ink/70">
            {chef.city} · {chef.yearsExperience} yrs experience
          </p>
          <p className="mt-2">
            {avg ? (
              <>
                <span className="text-saffron" aria-hidden="true">★</span> {avg.toFixed(1)}{" "}
                <span className="text-ink/70">
                  ({count} {count === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span className="text-ink/70">No reviews yet</span>
            )}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {chef.cuisines.map((cuisine) => (
              <li key={cuisine} className="rounded-full bg-sage/40 px-2.5 py-0.5 text-xs font-medium capitalize">
                {cuisine}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-leaf/25 p-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Price</dt>
          <dd className="text-lg font-bold">{formatINR(chef.pricePerPerson)} per person</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Cooks for</dt>
          <dd className="text-lg font-bold">Up to {chef.maxGuests} guests</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-xl font-bold">About</h2>
        <p className="mt-2 whitespace-pre-line">{chef.bio}</p>
      </section>

      {menu.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Sample menu</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {menu.map((dish, i) => (
              <li key={i}>{dish}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <BookingForm
          chefProfileId={chef.id}
          chefName={chef.displayName}
          pricePerPerson={chef.pricePerPerson}
          maxGuests={chef.maxGuests}
          viewer={viewer}
          existingStatus={existingStatus}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-ink/80">
            No reviews yet. Reviews only come from completed bookings made on Saffron.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-leaf/25 p-4">
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
    </div>
  );
}