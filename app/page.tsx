import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ChefCard from "@/components/ChefCard";
import DoodlePattern from "@/components/DoodlePattern";
import HomeSearch from "@/components/HomeSearch";
import { chefCardSelect, getChefCities, getCompletedMap, getRatingMap } from "@/lib/chefs";
import { accentButton } from "@/lib/ui";

export const dynamic = "force-dynamic";

const FEATURED = 4;

// Spans for the "Are you a chef?" card, indexed by how many chefs there are (0 to 3),
// so the featured row is always full at every screen width.
const ctaSpans = [
  "sm:col-span-2 lg:col-span-3 xl:col-span-4",
  "lg:col-span-2 xl:col-span-3",
  "sm:col-span-2 lg:col-span-1 xl:col-span-2",
  "lg:col-span-3 xl:col-span-1",
];

const steps = [
  {
    title: "Find a chef",
    text: "Search by city, cuisine and budget. Verified chefs are listed first.",
  },
  {
    title: "Send a request",
    text: "Pick the date, guests and address. The chef accepts or declines.",
  },
  {
    title: "Enjoy, then pay the chef",
    text: "Pay the chef directly by UPI or cash after the meal, then leave a review.",
  },
];

export default async function Home() {
  const [chefs, chefCities] = await Promise.all([
    prisma.chefProfile.findMany({
      where: { active: true },
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
      take: FEATURED,
      select: chefCardSelect,
    }),
    getChefCities(),
  ]);
  const userIds = chefs.map((c) => c.userId);
  const [ratings, completed] = await Promise.all([getRatingMap(userIds), getCompletedMap(userIds)]);

  return (
    <div>
      <section className="relative bg-forest text-cream">
        <DoodlePattern className="text-cream/[0.13]" />

        <div className="relative mx-auto w-full max-w-screen-2xl px-4 py-14 text-center sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-saffron">
            Private chefs for your home
          </p>
          <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            A chef in your kitchen. A table you can trust.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-cream/90">
            Book a verified home chef for a family dinner, a birthday or a house party. Your address
            stays private until the chef accepts, and you pay after the meal.
          </p>

          <div className="mx-auto mt-10 max-w-4xl text-left">
            <HomeSearch chefCities={chefCities} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">Featured chefs</h2>
            <p className="mt-1 text-ink/70">Verified chefs come first.</p>
          </div>
          <Link href="/chefs" className="font-semibold text-leaf underline underline-offset-4">
            See all chefs
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chefs.map((chef) => {
            const rating = ratings.get(chef.userId);
            return (
              <ChefCard
                key={chef.id}
                chef={chef}
                avg={rating?.avg ?? null}
                count={rating?.count ?? 0}
                completed={completed.get(chef.userId) ?? 0}
              />
            );
          })}

          {chefs.length < FEATURED && (
            <div
              className={`flex flex-col justify-center rounded-2xl border-2 border-dashed border-leaf/60 bg-sage p-6 ${ctaSpans[chefs.length]}`}
            >
              <h3 className="text-xl font-bold">Are you a chef?</h3>
              <p className="mt-2 max-w-xl text-ink/80">
                Join Saffron and get booking requests from people in your city. You choose your price
                and how many guests you cook for.
              </p>
              <div className="mt-4">
                <Link href="/cook-with-us" className={accentButton}>
                  Cook with us
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-sage">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:py-14">
          <h2 className="text-3xl font-bold">How it works</h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-2xl border-2 border-dashed border-leaf/60 bg-cream p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-heading text-sm font-bold text-saffron">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-ink/80">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {chefs.length >= FEATURED && (
        <section className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:py-14">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-leaf p-8 text-white sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">Are you a chef?</h2>
              <p className="mt-1 text-white/90">
                List your services and get booking requests from your city.
              </p>
            </div>
            <Link href="/cook-with-us" className={`${accentButton} focus-visible:outline-cream`}>
              Cook with us
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}