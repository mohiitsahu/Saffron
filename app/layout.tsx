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
          <div className="grid w-full gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <div>
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-96.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
                <p className="font-heading text-2xl font-extrabold text-saffron">Saffron</p>
              </div>
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
                <li><Link href="/cancellation" className={footerLink}>Cancellation and changes</Link></li>
                <li><Link href="/settings" className={footerLink}>Account settings</Link></li>
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
              <h2 className={footerHeading}>Help and information</h2>
              <ul className="mt-3 space-y-2 text-sm text-cream/80">
                <li><Link href="/help" className={footerLink}>Help and contact</Link></li>
                <li><Link href="/privacy" className={footerLink}>Privacy</Link></li>
                <li><Link href="/terms" className={footerLink}>Terms of use</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10">
            <p className="w-full px-4 py-4 text-xs text-cream/70 sm:px-6 lg:px-8">
              © {new Date().getFullYear()} Saffron. Saffron never holds or moves your money.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
