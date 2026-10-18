import Link from "next/link";
import { formatINR } from "@/lib/format";

export type ChefCardData = {
  id: string;
  displayName: string;
  city: string;
  cuisines: string[];
  pricePerPerson: number;
  maxGuests: number;
  yearsExperience: number;
  photoUrl: string | null;
  verified: boolean;
};

export default function ChefCard({
  chef,
  avg,
  count,
  completed = 0,
}: {
  chef: ChefCardData;
  avg: number | null;
  count: number;
  completed?: number;
}) {
  return (
    <Link
      href={`/chefs/${chef.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-leaf/25 bg-cream shadow-soft transition duration-300 hover:border-leaf/60 hover:shadow-lift motion-safe:hover:-translate-y-1"
    >
      <div className="overflow-hidden">
        {chef.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chef.photoUrl}
            alt={chef.displayName}
            className="h-44 w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-sage to-cream font-heading text-5xl font-bold text-leaf transition-transform duration-700 ease-out group-hover:scale-105"
          >
            {chef.displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold">{chef.displayName}</h3>
          {chef.verified && (
            <span className="rounded-full bg-leaf px-2.5 py-0.5 text-xs font-semibold text-white">
              ✓ Verified
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-ink/70">
          {chef.city} · {chef.yearsExperience} yrs experience
        </p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {chef.cuisines.slice(0, 3).map((cuisine) => (
            <li key={cuisine} className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-medium capitalize">
              {cuisine}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2 border-t border-dashed border-leaf/40 pt-3">
            <p className="text-sm">
              <span className="text-base font-bold">{formatINR(chef.pricePerPerson)}</span> per person
              <span className="block text-xs text-ink/70">Up to {chef.maxGuests} guests</span>
            </p>
            <p className="text-right text-sm">
              {avg ? (
                <>
                  <span className="text-saffron" aria-hidden="true">★</span> {avg.toFixed(1)}{" "}
                  <span className="text-ink/70">({count})</span>
                </>
              ) : (
                <span className="text-ink/70">New on Saffron</span>
              )}
              {completed > 0 && (
                <span className="block text-xs text-ink/70">
                  {completed} {completed === 1 ? "booking" : "bookings"} done
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}