import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChefForm from "@/components/ChefForm";

export const dynamic = "force-dynamic";

export default async function CookWithUsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/cook-with-us");
  }

  const [profile, user] = await Promise.all([
    prisma.chefProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">{profile ? "Edit your chef profile" : "Cook with Saffron"}</h1>
      <p className="mt-2 text-ink/80">
        Customers see your name, city, cuisines, price and menu. Your phone number stays hidden until
        you accept a booking.
      </p>
      <ChefForm
        isExisting={Boolean(profile)}
        initial={{
          displayName: profile?.displayName ?? session.user.name ?? "",
          bio: profile?.bio ?? "",
          city: profile?.city ?? "",
          cuisines: profile?.cuisines.join(", ") ?? "",
          pricePerPerson: profile ? String(profile.pricePerPerson) : "",
          maxGuests: profile ? String(profile.maxGuests) : "10",
          yearsExperience: profile ? String(profile.yearsExperience) : "0",
          phone: user?.phone ?? "",
          photoUrl: profile?.photoUrl ?? "",
          sampleMenu: profile?.sampleMenu ?? "",
          active: profile?.active ?? true,
        }}
      />
    </div>
  );
}