import { FONT_VARIABLES } from "../fonts";

import "../globals.css";
import "@/features/admin/admin.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The Admin surface's **root layout** — it owns `<html>` and `<body>` for `/login` and `/admin/*`.
 *
 * ── The third root layout, and the same positional rule as the other two ────
 *
 * The App Router resolves the root layout positionally: the first `layout` file walking down from
 * `app/` owns the document for everything beneath it. `app/layout.tsx` was deleted so
 * `app/[locale]/layout.tsx` could set a per-locale `lang`/`dir`, which left `design-proof` needing
 * its own; the `(admin)` group needs one for the same structural reason. A route group's
 * parentheses keep it out of the URL, so these pages are `/login` and `/admin`, not
 * `/(admin)/login`.
 *
 * Navigating between this tree and the public tree is a full page load, exactly as it is between
 * the public tree and the proof tree. Nothing links across: the Admin surface is not in
 * `site-routes.ts`, no public page links to it, and it links to no public page.
 *
 * ── `lang="en" dir="ltr"`, fixed ────────────────────────────────────────────
 *
 * Not negotiated, and not read from the `Locale` table. FRONTEND_ARCHITECTURE §1: Admin UI language
 * is a *preference*, not routing — the surface sits outside `[locale]` precisely so it never
 * acquires three URLs, a `hreflang` set, or a place in `generateStaticParams`. A future
 * language-preference mechanism changes what this attribute reads from; it does not put a locale in
 * the path.
 *
 * ── `noindex, nofollow` covers both routes from one place ───────────────────
 *
 * SECURITY.md §Non-indexable by construction requires the Admin area to carry no SEO surface. This
 * layout is the nearest shared ancestor of `/login` and `/admin`, so one declaration covers both
 * and a future Admin route inherits it without anyone having to remember. `nocache` and
 * `noarchive` are included because a login form and an operator's identity should not sit in a
 * search engine's cache even if a crawler reached them.
 *
 * No global `robots.ts` is added here — that is a public-site file and belongs to its own gate.
 * Nothing regresses by its absence: no `robots.txt` exists today, so there is no allow rule this
 * surface is slipping past.
 */
export const metadata: Metadata = {
  title: "SAM Group Admin",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function AdminRootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en" dir="ltr" className={FONT_VARIABLES}>
      <body className="ad-root">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
