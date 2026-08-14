import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductsExperience } from "@/features/products/products-experience";

/**
 * The Products landing page, on its canonical route — `/{locale}/products`.
 *
 * `ProductsExperience` is rendered **unchanged**, exactly as `HomeExperience` was when the
 * homepage lifted: the component takes no props, reads no locale, performs no fetch, and supplies
 * the `#main-content` target the root layout's skip link points at. Its own header note called
 * this lift "this file unchanged plus swapping `products-data.ts` from fixtures to
 * `GET /api/v1/categories`" — **only the first half is this gate.** The fixture swap is the
 * Products-landing analogue of what `resolveCategoryPage` did for the Family pages, and it needs
 * its own fail-open decision and its own drift reporting rather than arriving as a side effect of
 * a route promotion.
 *
 * ── Why this is a page and not a segment ────────────────────────────────────
 *
 * It sits one level above `products/[slug]`, not beside it. The two match different path depths,
 * so nothing here competes with the Product Family route and nothing here is a discriminator —
 * ADR-010 §2's shared namespace begins at the segment below this file. `finder`, `segments` and
 * `types` stay 404s for the reason they already were: they are absent from the content registry
 * that generates `[slug]`'s params, and §4 reserves them without a route-level exception.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment is the parent's, and `app/[locale]/layout.tsx` already generates it from
 * the `Locale` table and closes it with `dynamicParams = false`. This route introduces no dynamic
 * segment of its own, so it has nothing to enumerate — restating either here would be a second
 * copy of the locale source that PROJECT_HANDOFF §6.9 keeps singular.
 *
 * In practice neither would change the output anyway: the layout awaits `getLocaleByCode` on every
 * render and `apiGet` is `cache: "no-store"`, so every route in this tree is server-rendered rather
 * than prerendered. A fetch-free page under this layout still comes out dynamic — `/{locale}` is
 * already the proof of that.
 *
 * ── Metadata, and what is deliberately absent ───────────────────────────────
 *
 * The title and description are the proof route's own two strings, character for character.
 *
 * **No `robots`.** `app/[locale]/layout.tsx` declares `robots: { index: false, follow: false }` for
 * this whole tree and every page inherits it; a route-level override would be a second answer to a
 * settled question. **No canonical and no `hreflang`** — both are ADR-010 Non-Goals, and P3a is a
 * route promotion, not the SEO launch.
 *
 * ── The proof route is still live ───────────────────────────────────────────
 *
 * `/design-proof/products` renders this same experience until a later gate redirects it, per
 * ADR-010 §9's order. Two URLs answering is the transition's shape, not a duplication left behind:
 * both trees carry `noindex, nofollow` from their own layouts, and the proof route is what this
 * one is validated against.
 */
export const metadata: Metadata = {
  title: "Products — Sam Group",
  description:
    "Base oils, lubricant additives, engine oils, industrial and marine lubricants, antifreeze and coolants — six product families from Sam Group.",
};

export default function ProductsPage(): ReactNode {
  return <ProductsExperience />;
}
