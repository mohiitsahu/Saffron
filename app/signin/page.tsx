import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignInButton from "@/components/SignInButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in | Saffron" };

type SearchParams = {
  callbackUrl?: string | string[];
  error?: string | string[];
};

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "That email is already linked to a different sign-in method. Use the one you signed up with.",
  AccessDenied: "Access was denied. Try again, and allow Saffron to see your Google name and email.",
  Configuration: "Sign-in isn't set up correctly right now. Please try again in a few minutes.",
  OAuthCallback: "Google didn't complete the sign-in. Please try again.",
  OAuthSignin: "We couldn't start the Google sign-in. Please try again.",
  Callback: "We couldn't finish signing you in. Please try again.",
};

function one(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Only ever send people back to a page on this site.
function safeCallback(value?: string | string[]) {
  const raw = one(value);
  let path = "/";

  try {
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      path = raw;
    } else if (raw && process.env.NEXTAUTH_URL) {
      const url = new URL(raw);
      if (url.origin === new URL(process.env.NEXTAUTH_URL).origin) {
        path = url.pathname + url.search;
      }
    }
  } catch {
    path = "/";
  }

  return path.startsWith("/signin") || path.startsWith("/api/auth") ? "/" : path;
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const callbackUrl = safeCallback(searchParams.callbackUrl);

  const session = await getServerSession(authOptions);
  if (session?.user) redirect(callbackUrl);

  const errorCode = one(searchParams.error);
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? "Something went wrong while signing you in. Please try again."
    : "";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="animate-fade-up rounded-2xl border-2 border-dashed border-leaf bg-sage/70 p-6 shadow-lift sm:p-8">
        <p className="font-heading text-sm font-bold uppercase tracking-widest text-leaf">Welcome</p>
        <h1 className="mt-1 text-3xl font-bold">Sign in to Saffron</h1>
        <p className="mt-3 text-ink/80">
          Book a home chef for your next dinner, or list your own cooking. It takes one tap with your
          Google account.
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 animate-scale-in rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm font-medium text-danger"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-6 border-t-2 border-dashed border-leaf/50 pt-6">
          <SignInButton callbackUrl={callbackUrl} />
        </div>

        <p className="mt-4 text-xs text-ink/70">
          We use your Google name, email and photo to set up your account. We never post anything for
          you, and you pay chefs directly after the meal.
        </p>
      </div>

      <p className="mt-6 text-center text-sm">
        Just looking?{" "}
        <Link href="/chefs" className="font-medium text-leaf underline underline-offset-4">
          Browse chefs
        </Link>
      </p>
    </div>
  );
}