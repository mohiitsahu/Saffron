import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { formatDateIST } from "@/lib/format";
import AdminChefRow from "@/components/AdminChefRow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin | Saffron", robots: { index: false, follow: false } };

export default async function AdminPage() {
  // Anyone who isn't an admin sees the normal "page not found", so the page's existence isn't revealed.
  if (!(await getAdminSession())) notFound();

  const chefs = await prisma.chefProfile.findMany({
    // Chefs waiting for review come first, newest first.
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      displayName: true,
      city: true,
      photoUrl: true,
      verified: true,
      active: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const waiting = chefs.filter((c) => !c.verified).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="mt-1 text-ink/70">
        {chefs.length} chef{chefs.length === 1 ? "" : "s"} · {waiting} waiting for review. Check the photo and
        profile, then verify, hide or remove the photo.
      </p>

      {chefs.length === 0 ? (
        <p className="mt-8 text-ink/70">No chefs have signed up yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {chefs.map((chef) => (
            <AdminChefRow
              key={chef.id}
              chef={{
                id: chef.id,
                displayName: chef.displayName,
                city: chef.city,
                email: chef.user.email ?? "no email",
                photoUrl: chef.photoUrl,
                verified: chef.verified,
                active: chef.active,
                createdAt: formatDateIST(chef.createdAt),
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
