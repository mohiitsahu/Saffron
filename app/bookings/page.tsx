import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBookingsFor } from "@/lib/bookings";
import BookingsView from "@/components/BookingsView";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string | string[] };

export default async function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin?callbackUrl=/bookings");
  }

  const { asCustomer, asChef } = await getBookingsFor(session.user.id);
  const showChefTabs = session.user.role === "CHEF" || asChef.length > 0;
  const tabParam = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">My bookings</h1>
      <p className="mt-1 text-ink/70">Track your requests and bookings in one place.</p>

      <div className="mt-6">
        <BookingsView
          asChef={asChef}
          asCustomer={asCustomer}
          showChefTabs={showChefTabs}
          initialTab={tabParam === "mine" ? "mine" : "requests"}
        />
      </div>
    </div>
  );
}