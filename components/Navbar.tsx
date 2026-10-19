import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { countPendingRequests } from "@/lib/notifications";
import NavMenu from "@/components/NavMenu";
import NavShell from "@/components/NavShell";

export default async function Navbar() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  const isChef = Boolean(user?.isChef);
  const isAdmin = user?.role === "ADMIN";
  const pendingRequests = user && isChef ? await countPendingRequests(user.id) : 0;

  const links: { href: string; label: string; alert?: boolean }[] = [
    { href: "/chefs", label: "Find a chef" },
    isChef
      ? { href: "/chef", label: "Chef profile" }
      : { href: "/cook-with-us", label: "Cook with us" },
  ];
  if (user) links.push({ href: "/bookings", label: "My bookings", alert: true });
  if (isAdmin) links.push({ href: "/admin", label: "Admin" });

  return (
    <NavShell>
      <Link
        href="/"
        className="group inline-flex items-center gap-2.5 rounded font-heading text-2xl font-extrabold tracking-tight text-saffron focus-visible:outline-cream"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-192.png"
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105"
        />
        Saffron
      </Link>
      <NavMenu
        links={links}
        signedIn={Boolean(user)}
        name={user?.name ?? user?.email ?? ""}
        isChef={isChef}
        pendingRequests={pendingRequests}
      />
    </NavShell>
  );
}