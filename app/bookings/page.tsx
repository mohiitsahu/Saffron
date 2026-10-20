import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bookingSelect, getBookingsFor, serializeBooking } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import BookingsView from "@/components/BookingsView";
import { pageClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string | string[]; booking?: string | string[] };

export default async function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin?callbackUrl=/bookings");
  }

  const { asCustomer, asChef } = await getBookingsFor(session.user.id);
  const target = typeof searchParams.booking === "string" && searchParams.booking.length <= 100 ? searchParams.booking : null;
  const focused = target ? await prisma.booking.findFirst({ where: { id: target, OR: [{ customerId: session.user.id }, { chefId: session.user.id }] }, select: bookingSelect }) : null;
  const showChefTabs = session.user.isChef || asChef.length > 0;
  const tabParam = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;

  return (
    <div className={pageClass}>
      <h1 className="text-3xl font-bold sm:text-4xl">My bookings</h1>
      <p className="mt-1 text-ink/70">Track your requests and bookings in one place.</p>

      <div className="mt-6">
        <BookingsView
          key={`${tabParam ?? "requests"}:${target ?? ""}`}
          focusedBooking={focused ? serializeBooking(focused, session.user.id) : null}
          asChef={asChef}
          asCustomer={asCustomer}
          showChefTabs={showChefTabs}
          initialTab={tabParam === "mine" ? "mine" : "requests"}
        />
      </div>
    </div>
  );
}
