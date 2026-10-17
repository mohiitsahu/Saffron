import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBookingsFor } from "@/lib/bookings";
import BookingTicket from "@/components/BookingTicket";
import { primaryButton } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/bookings");
  }

  const { asCustomer, asChef } = await getBookingsFor(session.user.id);
  const showChefSection = session.user.role === "CHEF" || asChef.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">My bookings</h1>

      {showChefSection && (
        <section className="mt-8" aria-labelledby="chef-requests">
          <h2 id="chef-requests" className="text-xl font-bold">
            Requests for you
          </h2>
          {asChef.length === 0 ? (
            <p className="mt-2 text-ink/80">No requests yet. They will appear here when customers book you.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {asChef.map((booking) => (
                <BookingTicket key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10" aria-labelledby="my-requests">
        <h2 id="my-requests" className="text-xl font-bold">
          {showChefSection ? "Chefs you've booked" : "Your requests"}
        </h2>
        {asCustomer.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-leaf bg-sage/20 p-6">
            <h3 className="text-lg font-bold">No bookings yet</h3>
            <p className="mt-1 text-ink/80">Your requests will show up here as tickets, with their status.</p>
            <Link href="/chefs" className={`${primaryButton} mt-4`}>
              Find a chef
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {asCustomer.map((booking) => (
              <BookingTicket key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}