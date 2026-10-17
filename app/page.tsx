import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ChefCard from "@/components/ChefCard";
import HomeSearch from "@/components/HomeSearch";
import { chefCardSelect, getChefCities, getRatingMap } from "@/lib/chefs";
import { outlineButton } from "@/lib/ui";

export const dynamic = "force-dynamic";

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
      take: 3,
      select: chefCardSelect,
    }),
    getChefCities(),
  ]);
  const ratings = await getRatingMap(chefs.map((c) => c.userId));

  return (
    <div>
      <section className="bg-leaf text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            A home chef, cooking in your own kitchen.
          </h1>
          <p className="mt-4 max-w-xl text-lg">
            Book a chef for a family dinner, a birthday or a house party. You pay the chef directly
            after the meal.
          </p>

          <div className="mt-8">
            <HomeSearch chefCities={chefCities} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold">Featured chefs</h2>
        {chefs.length === 0 ? (
          <p className="mt-4 text-ink/80">Chefs are joining soon. Check back shortly.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chefs.map((chef) => {
              const rating = ratings.get(chef.userId);
              return <ChefCard key={chef.id} chef={chef} avg={rating?.avg ?? null} count={rating?.count ?? 0} />;
            })}
          </div>
        )}
        <p className="mt-6">
          <Link href="/chefs" className="font-semibold text-leaf underline underline-offset-4">
            See all chefs
          </Link>
        </p>
      </section>

      <section className="bg-sage/25">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-xl border-2 border-dashed border-leaf/60 bg-cream p-5">
                <p className="font-heading text-sm font-bold uppercase tracking-wide text-leaf">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-ink/80">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-leaf/30 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Are you a chef?</h2>
            <p className="mt-1 text-ink/80">List your services and get booking requests from your city.</p>
          </div>
          <Link href="/cook-with-us" className={outlineButton}>
            Cook with us
          </Link>
        </div>
      </section>
    </div>
  );
}