import type { Metadata } from "next";
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
        <footer className="border-t border-leaf/20">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink/70">
            <p className="font-heading font-semibold text-leaf">Saffron</p>
            <p className="mt-1">
              You pay the chef directly after the meal. Saffron never holds your money.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}