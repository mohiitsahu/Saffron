import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckCircleIcon } from "@/components/Icons";
import ChefForm from "@/components/ChefForm";

export const dynamic = "force-dynamic";

const tips = [
  "Use a clear, well-lit photo of you cooking or of your best dish.",
  "List 3 to 6 signature dishes in your sample menu.",
  "Set a maximum guest count you can cook for comfortably.",
  "Your phone number stays private until you accept a booking.",
  "Verified chefs get a badge and rank first. Saffron checks IDs by hand.",
];

export default async function CookWithUsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin?callbackUrl=/cook-with-us");
  }

  const [profile, user] = await Promise.all([
    prisma.chefProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {profile && (
        <Link href="/chef" className="text-sm font-medium text-leaf underline underline-offset-4">
          ← Back to my profile
        </Link>
      )}

      <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div>
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

        <aside className="rounded-2xl border-2 border-dashed border-leaf/60 bg-sage p-5 shadow-soft lg:sticky lg:top-20">
          <h2 className="text-lg font-bold">Tips for a great profile</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-2.5">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-leaf" />
                {tip}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}