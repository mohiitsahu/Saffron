import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { getBookingFor, getBookingsFor } from "@/lib/bookings";
import BookingsView from "@/components/BookingsView";
import { pageClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string | string[]; booking?: string | string[] };

export default async function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAppSession();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/bookings");
  }

  const target = typeof searchParams.booking === "string" && searchParams.booking.length <= 100 ? searchParams.booking : null;
  const focused = target ? await getBookingFor(session.user.id, target) : null;
  // Opening one update must not fetch and serialize the entire booking history.
  const { asCustomer, asChef } = focused ? { asCustomer: [], asChef: [] } : await getBookingsFor(session.user.id);
  const showChefTabs = session.user.isChef || asChef.length > 0;
  const tabParam = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;

  return (
    <div className={pageClass}>
      <h1 className="text-3xl font-bold sm:text-4xl">My bookings</h1>
      <p className="mt-1 text-ink/70">Track your requests and bookings in one place.</p>

      <div className="mt-6">
        <BookingsView
          key={`${tabParam ?? "requests"}:${target ?? ""}`}
          focusedBooking={focused}
          asChef={asChef}
          asCustomer={asCustomer}
          showChefTabs={showChefTabs}
          initialTab={tabParam === "mine" ? "mine" : "requests"}
        />
      </div>
    </div>
  );
}
