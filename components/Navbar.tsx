import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { countPendingRequests } from "@/lib/notifications";
import NavMenu from "@/components/NavMenu";

export default async function Navbar() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const isChef = user?.role === "CHEF";
  const pendingRequests = user && isChef ? await countPendingRequests(user.id) : 0;

  const links: { href: string; label: string; alert?: boolean }[] = [
    { href: "/chefs", label: "Find a chef" },
    {
      href: "/cook-with-us",
      label: isChef ? "Chef profile" : "Cook with us",
    },
  ];
  if (user) links.push({ href: "/bookings", label: "My bookings", alert: true });

  return (
    <header className="sticky top-0 z-40 border-b border-leaf/20 bg-cream">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
        <Link href="/" className="font-heading text-2xl font-extrabold text-saffron">
          Saffron
        </Link>
        <NavMenu
          links={links}
          signedIn={Boolean(user)}
          name={user?.name ?? user?.email ?? ""}
          isChef={isChef}
          pendingRequests={pendingRequests}
        />
      </div>
    </header>
  );
}