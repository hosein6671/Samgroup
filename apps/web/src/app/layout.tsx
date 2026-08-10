import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Inter_Tight } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Root layout.
 *
 * `lang`/`dir` are hardcoded to the default locale here **only because locale routing does not
 * exist yet**. Under the planned structure this file carries no locale at all — the `[locale]`
 * layout sets `<html lang dir>` from the `Locale` table
 * (docs/frontend/FRONTEND_ARCHITECTURE.md §2). Nothing here is the shape of that layout.
 *
 * **Fonts are self-hosted, not linked.** The prototype pulls three families from the Google
 * Fonts CDN; `next/font` downloads and serves them from our own origin at build time instead.
 * That is the documented rule (FRONTEND_ARCHITECTURE §13) and it matters more here than usual:
 * ADR-005 puts the whole platform on one VPS with no third-party edge, so a render-blocking
 * request to fonts.googleapis.com would be a cross-origin round trip on the critical path,
 * plus a GDPR exposure this audience's procurement teams do ask about.
 *
 * It also closes a defect that has been open since A-2: the design tokens named "Inter" as
 * self-hosted and no font file has ever shipped. Everything until now rendered in a fallback.
 */
const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display-src",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body-src",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sam Group — Engineering Premium Energy Solutions",
  description:
    "Sam Group delivers advanced petroleum products, lubricants, base oils and industrial solutions engineered for global industries.",
  // A proof route, not a public surface. Indexing is enabled when this lifts to app/[locale].
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en" dir="ltr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
