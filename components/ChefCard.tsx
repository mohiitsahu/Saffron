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
}: {
  chef: ChefCardData;
  avg: number | null;
  count: number;
}) {
  return (
    <Link
      href={`/chefs/${chef.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-leaf/25 bg-cream transition-shadow hover:border-leaf hover:shadow-md"
    >
      {chef.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={chef.photoUrl} alt={chef.displayName} className="h-44 w-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-44 w-full items-center justify-center bg-sage/40 font-heading text-5xl font-bold text-leaf"
        >
          {chef.displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{chef.displayName}</h2>
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
            <li key={cuisine} className="rounded-full bg-sage/40 px-2.5 py-0.5 text-xs font-medium capitalize">
              {cuisine}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-end justify-between gap-2 border-t border-dashed border-leaf/40 pt-3">
          <p className="text-sm">
            <span className="text-base font-bold">{formatINR(chef.pricePerPerson)}</span> per person
            <span className="block text-xs text-ink/70">
              Up to {chef.maxGuests} guests
            </span>
          </p>
          <p className="text-sm">
            {avg ? (
              <>
                <span className="text-saffron" aria-hidden="true">★</span> {avg.toFixed(1)}{" "}
                <span className="text-ink/70">({count})</span>
              </>
            ) : (
              <span className="text-ink/70">No reviews yet</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}