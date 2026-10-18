import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const heading = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saffron: hire a home chef",
  description: "Book a home chef to cook in your own kitchen for dinners, birthdays and house parties.",
};

const footerLink =
  "inline-block rounded text-sm text-cream/80 transition duration-200 hover:text-saffron hover:underline hover:underline-offset-4 focus-visible:outline-cream motion-safe:hover:translate-x-0.5";
const footerHeading = "text-xs font-semibold uppercase tracking-widest text-saffron";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="bg-forest text-cream">
          <div aria-hidden="true" className="h-1 bg-gradient-to-r from-transparent via-saffron/80 to-transparent" />
          <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-heading text-2xl font-extrabold text-saffron">Saffron</p>
              <p className="mt-2 text-sm text-cream/80">Home chefs, cooking in your own kitchen.</p>
            </div>

            <nav aria-label="For customers">
              <h2 className={footerHeading}>For customers</h2>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/chefs" className={footerLink}>
                    Find a chef
                  </Link>
                </li>
                <li>
                  <Link href="/bookings" className={footerLink}>
                    My bookings
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="For chefs">
              <h2 className={footerHeading}>For chefs</h2>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/cook-with-us" className={footerLink}>
                    Cook with us
                  </Link>
                </li>
                <li>
                  <Link href="/chef" className={footerLink}>
                    Your chef profile
                  </Link>
                </li>
              </ul>
            </nav>

            <div>
              <h2 className={footerHeading}>Our promise</h2>
              <ul className="mt-3 space-y-2 text-sm text-cream/80">
                <li>Verified chefs carry a badge</li>
                <li>Your address stays private until a chef accepts</li>
                <li>You pay the chef directly after the meal</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10">
            <p className="mx-auto max-w-screen-2xl px-4 py-4 text-xs text-cream/70">
              © {new Date().getFullYear()} Saffron. Saffron never holds or moves your money.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}