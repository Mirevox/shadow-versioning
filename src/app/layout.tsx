import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Mirevox Shadow Versioning",
  description:
    "Appcode-bound snapshot timeline across Confluence, SharePoint, Git, and testing — without forcing Git verbs on non-technical teammates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} antialiased`}
        style={{ fontFamily: "var(--font-body), sans-serif" }}
      >
        <div className="min-h-screen">
          <header className="border-b border-[var(--line)]/80 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <Link href="/" className="group flex items-baseline gap-3">
                <span
                  className="text-2xl tracking-tight text-[var(--ink)] sm:text-3xl"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  Mirevox
                </span>
                <span className="text-sm text-[var(--neon)]">Shadow Versioning</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
                <Link href="/docs/sync-model" className="hover:text-[var(--neon)]">
                  Sync model
                </Link>
                <a
                  href="https://github.com/Mirevox/shadow-versioning"
                  className="hover:text-[var(--neon)]"
                >
                  Repo
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
