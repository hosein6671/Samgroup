import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductFinderTemplate } from "@/features/products/finder/finder-template";
import { readFinderQuery } from "@/features/products/finder/finder-query";
import { getProducts } from "@/lib/products";
import { getActiveLocales } from "@/lib/locales";

/**
 * The Product Finder route — `/{locale}/products/finder`.
 *
 * ── This file is what un-reserves `finder` ──────────────────────────────────
 *
 * `finder` is one of the three slugs ADR-010 §4 reserves inside `/{locale}/products/{slug}`, and
 * until now it answered 404 through `reserved-slugs.ts` — a *declaration* consulted by the shared
 * `[slug]` segment, never the enforcement of anything. `reserved-slugs.ts` anticipated this file
 * precisely: "When the Product Finder ships it becomes a static `finder/page.tsx` sibling, a static
 * segment outranks a dynamic one in the App Router, and this entry stops being consulted at all."
 *
 * That is exactly what happened, and nothing else did. **The reserved-slug guard in `[slug]` is
 * unchanged and stays unchanged.** It still lists all three values, still answers before any
 * catalog lookup, and still returns a 404 for `segments` and `types`. Its `finder` entry is now
 * unreachable through routing rather than removed, and removing it would be wrong twice over: the
 * database's `product_slug_reserved()` is the authority (ADR-011) and still rejects a `Product` or
 * `Category` claiming any of the three, and a declaration that dropped a value the database still
 * reserves would be a declaration that lies.
 *
 * Precedence is the App Router's own rule — a static segment is matched before a dynamic sibling —
 * so `/{locale}/products/finder` reaches this file and never reaches the shared discriminator. It
 * is verified rather than assumed; the gate's report records the check.
 *
 * ── Filtering is the API's, in full ─────────────────────────────────────────
 *
 * This route reads five query parameters — `category`, `segment`, `productType`, `q` and `page` —
 * normalizes them, and passes them to `GET /products`. Nothing here fetches a wider set and narrows
 * it, nothing here validates a slug against a local vocabulary, and nothing here decides what
 * combining the three taxonomy axes with the search term means: ADR-008 fixed those semantics,
 * `buildWhere` composes them as sibling `where` keys that Prisma ANDs, and a second implementation
 * in `apps/web` could only ever agree with the first by coincidence.
 *
 * **Pagination is the API's too, and this route makes exactly one request for it.** `page` is passed
 * through; `limit` and `sort` are not sent at all, so the endpoint's `limit=20` and `sort=name`
 * stand. A page past the end of the result set is answered by the response's own `meta` — a 200
 * carrying zero rows and a real `total` — and rendered as its own state. It is never retried, never
 * clamped into a second request, and never converted into a 404: this route issues one fetch per
 * render whatever `?page=` says.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * This route introduces no dynamic segment of its own. The `[locale]` segment belongs to
 * `app/[locale]/layout.tsx`, which already generates it from the `Locale` table and closes it with
 * `dynamicParams = false`; restating either here would be a second copy of the locale source that
 * PROJECT_HANDOFF §6.9 keeps singular. `/xx/products/finder` therefore 404s at the router, exactly
 * as every other route in this tree does.
 *
 * The route is dynamic regardless: it reads `searchParams`, and every fetch beneath it is
 * `cache: "no-store"`.
 */

/**
 * The page's `<title>` and description — two fixed strings, and no fetch.
 *
 * A finder has no record behind it to be titled from, and titling it from the ACTIVE FILTERS would
 * be worse than useless: `?category=` is caller-supplied text, so a filtered title would either
 * echo an arbitrary string into the document head or need the same registry lookup the page already
 * treats as non-authoritative. One page, one name.
 *
 * **No `robots`.** `app/[locale]/layout.tsx` declares `robots: { index: false, follow: false }` for
 * this whole tree and every page inherits it; a route-level override would be a second answer to a
 * settled question. **No canonical and no `hreflang`** — both are ADR-010 Non-Goals, and this gate
 * is not the SEO launch. A filtered finder URL is exactly the kind of page that will need a
 * canonical decision when indexing is switched on, and making that decision here would be making it
 * silently.
 */
const FINDER_TITLE = "Product Finder | SAM Group";
const FINDER_DESCRIPTION =
  "Search SAM Group products by name, grade, or public specification, then narrow the published range by product family, buyer segment, and product type.";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = `/${locale}/products/finder`;

  return {
    title: FINDER_TITLE,
    description: FINDER_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "SAM Group",
      title: FINDER_TITLE,
      description: FINDER_DESCRIPTION,
      url: canonical,
      locale,
    },
    twitter: { card: "summary", title: FINDER_TITLE, description: FINDER_DESCRIPTION },
  };
}

export default async function ProductFinderPage({
  params,
  searchParams,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string }>;
  /**
   * The filter state. Reading it opts the route into dynamic rendering, which costs nothing here:
   * the product fetch is `cache: "no-store"`, so the route was already dynamic before the filters
   * existed.
   */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale }, rawQuery] = await Promise.all([params, searchParams]);
  const locales = await getActiveLocales();

  const query = readFinderQuery(rawQuery);

  /*
   * Started here and deliberately NOT awaited. Data access stays at the route
   * (FRONTEND_ARCHITECTURE §7) while the promise travels down to a `Suspense` boundary inside the
   * template, so a slow catalog service delays the results block instead of the hero and the
   * controls. It cannot reject — `getProducts` reports every API condition as a value.
   *
   * `?? undefined` converts the page's `null` — "not filtered on this axis" — into the client's
   * "omit this parameter". The two spellings are kept distinct rather than unified: `null` is a
   * state the UI renders as an active "All" chip, `undefined` is a parameter that never appears on
   * the wire, and collapsing them would make one module's absent value the other's default.
   */
  const products = getProducts(locale, {
    category: query.category ?? undefined,
    segment: query.segment ?? undefined,
    productType: query.productType ?? undefined,
    q: query.q ?? undefined,
    /*
     * `page` needs no `?? undefined`: it is never null, because an absent or malformed `?page=` is
     * already page 1 by the time it reaches here. The client omits page 1 from the request, so a
     * first-page finder issues exactly the request it issued before pagination existed.
     */
    page: query.page,
  });

  return (
    <ProductFinderTemplate locales={locales} locale={locale} query={query} products={products} />
  );
}
