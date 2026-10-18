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
    isChef
      ? { href: "/chef", label: "Chef profile" }
      : { href: "/cook-with-us", label: "Cook with us" },
  ];
  if (user) links.push({ href: "/bookings", label: "My bookings", alert: true });

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-forest shadow-[0_8px_24px_-14px_rgba(0,0,0,0.55)]">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-2.5">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded font-heading text-2xl font-extrabold tracking-tight text-saffron focus-visible:outline-cream"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6 transition-transform duration-500 group-hover:rotate-12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3c-2.6 2-3.4 4.8-2.6 7.6L12 13l2.6-2.4C15.4 7.8 14.6 5 12 3z" />
            <path d="M9.4 10.6C6.8 10.2 4.6 8.4 3.8 5.6c2.8-.2 5 .8 6 2.6" />
            <path d="M14.6 10.6c2.6-.4 4.8-2.2 5.6-5-2.8-.2-5 .8-6 2.6" />
            <path d="M12 13v8" />
          </svg>
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