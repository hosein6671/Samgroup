import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FONT_VARIABLES } from "../fonts";

import "../globals.css";

/**
 * The proof tree's **root layout** — it owns `<html>` and `<body>` for `/design-proof/**`.
 *
 * ── This file changes nothing about the proof routes ────────────────────────
 *
 * It is the deleted `app/layout.tsx`, scoped. Same `lang="en" dir="ltr"`, same three font
 * variables, same `globals.css`, same skip link, same title, same description, same
 * `robots: { index: false, follow: false }` — because the eleven proof pages beneath it are
 * untouched by P1 and must render exactly as they did at `ec86a49`.
 *
 * It exists because the App Router resolves the root layout positionally: once `app/layout.tsx`
 * was deleted so that `app/[locale]/layout.tsx` could own `<html>` and set a per-locale `lang`
 * and `dir`, these pages had no layout above them, and a page with no root layout is a build
 * error. Two root layouts is the supported shape for that, not a workaround.
 *
 * ── One property this arrangement improves ──────────────────────────────────
 *
 * The `noindex` below is now **scoped by construction**. Under the single root layout it applied
 * site-wide and the canonical tree would have had to remember to override it; here the proof tree
 * carries its own and the canonical tree states its own. The two cannot leak into each other.
 *
 * ── Lifetime ────────────────────────────────────────────────────────────────
 *
 * Temporary by design. ADR-010 §9 sequences the proof routes: canonical route implemented,
 * validated, proof routes redirect to their canonical default-locale routes, then the proof
 * implementation is removed. This file is deleted with the pages it serves, at which point
 * `app/[locale]/layout.tsx` is the single root layout — which is why those redirects belong in
 * `next.config.ts` or middleware rather than in page files, since neither is a route and neither
 * needs a layout.
 */
export const metadata: Metadata = {
  title: "Sam Group — Engineering Premium Energy Solutions",
  description:
    "Sam Group delivers advanced petroleum products, lubricants, base oils and industrial solutions engineered for global industries.",
  // Proof routes are not a public surface. Unchanged from the layout this replaces; the canonical
  // tree declares its own, so nothing here reaches `/{locale}`.
  robots: { index: false, follow: false },
};

export default function DesignProofLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang="en" dir="ltr" className={FONT_VARIABLES}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
