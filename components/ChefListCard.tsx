import Link from "next/link";
import { ArrowUpRightIcon, CheckCircleIcon, PinIcon, StarIcon } from "@/components/Icons";
import { formatINR, menuLines } from "@/lib/format";

export type ChefListData = {
  id: string;
  displayName: string;
  city: string;
  cuisines: string[];
  pricePerPerson: number;
  maxGuests: number;
  yearsExperience: number;
  photoUrl: string | null;
  verified: boolean;
  bio: string;
  sampleMenu: string;
};

export default function ChefListCard({
  chef,
  avg,
  count,
  completed = 0,
  bookingQuery = "",
}: {
  chef: ChefListData;
  avg: number | null;
  count: number;
  completed?: number;
  bookingQuery?: string;
}) {
  const dishes = menuLines(chef.sampleMenu).slice(0, 3);
  const tags = dishes.length > 0 ? dishes : chef.cuisines.slice(1, 4);

  return (
    <Link
      href={`/chefs/${chef.id}${bookingQuery ? `?${bookingQuery}` : ""}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-leaf/25 bg-cream shadow-soft transition duration-300 hover:border-leaf/60 hover:shadow-lift md:flex-row motion-safe:hover:-translate-y-0.5"
    >
      <div className="relative h-52 w-full flex-none overflow-hidden md:h-auto md:min-h-[14rem] md:w-1/3">
        {chef.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chef.photoUrl}
            alt={chef.displayName}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sage to-cream font-heading text-7xl font-bold text-leaf transition-transform duration-700 ease-out group-hover:scale-105"
          >
            {chef.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        {chef.verified && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm font-semibold shadow-sm">
            <CheckCircleIcon className="h-4 w-4 text-leaf" />
            Verified chef
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          {chef.cuisines[0] && (
            <span className="rounded-md bg-sage px-3 py-1 text-sm font-medium capitalize">
              {chef.cuisines[0]}
            </span>
          )}
          <p className="text-right text-sm font-semibold">
            {avg ? (
              <span className="flex items-center justify-end gap-1.5">
                <StarIcon className="h-4 w-4 text-saffron" />
                {avg.toFixed(1)} <span className="font-normal text-ink/60">({count})</span>
              </span>
            ) : (
              <span className="font-normal text-ink/60">New on Saffron</span>
            )}
            {completed > 0 && (
              <span className="block text-xs font-normal text-ink/60">
                {completed} {completed === 1 ? "booking" : "bookings"} done
              </span>
            )}
          </p>
        </div>

        <h2 className="mt-3 text-2xl font-bold">{chef.displayName}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-ink/70">
          <PinIcon className="h-4 w-4 flex-none" />
          {chef.city} · {chef.yearsExperience} yrs experience · up to {chef.maxGuests} guests
        </p>

        <p className="mt-3 line-clamp-2 text-ink/80">{chef.bio}</p>

        {tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li
                key={tag}
                className="max-w-full truncate rounded-md border border-leaf/30 px-3 py-1 text-sm capitalize"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-leaf/20 pt-4">
          <p className="text-ink/70">
            <span className="text-2xl font-bold text-ink">{formatINR(chef.pricePerPerson)}</span> / guest
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 group-hover:bg-forest">
            Request a chef
            <ArrowUpRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
