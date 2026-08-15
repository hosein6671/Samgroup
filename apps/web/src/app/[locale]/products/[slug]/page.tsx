import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { getCategoryContent } from "@/features/products/category/data";
import { resolveCategoryPage } from "@/features/products/category/resolve-category-page";
import { ProductDetailTemplate } from "@/features/products/detail/product-detail-template";
import { ProductUnavailable } from "@/features/products/detail/product-unavailable";
import { resolveProduct } from "@/features/products/detail/resolve-product-page";
import { isReservedProductSlug } from "@/features/products/reserved-slugs";
import { getProductsByCategory } from "@/lib/products";

/**
 * The shared Product namespace route — `/{locale}/products/{slug}`.
 *
 * ── One segment, two entity types, one discriminator ────────────────────────
 *
 * ADR-010 §2 puts Product Family and Product Detail in ONE namespace served by ONE dynamic segment,
 * because the App Router cannot express `products/[categorySlug]` and `products/[productSlug]` as
 * siblings. This is that segment, and it now serves both. The discriminator ADR-010 §2 requires is
 * `resolveSlug` below — exactly one of them, in exactly one place.
 *
 * The order is the frozen policy, not a convenience:
 *
 *   1. **Reserved** (`finder`, `segments`, `types`) → 404, without asking anything. ADR-010 §4
 *      reserves them against Families and Products alike, so they can be answered before either
 *      branch is consulted, and a Product can never occupy one.
 *   2. **Family** → the local content registry. **Family precedence** (ADR-010 §5) is expressed by
 *      this check running first and returning without a Product lookup ever being issued.
 *   3. **Product** → `GET /products/:slug`, the only branch that touches the network to decide
 *      whether a page exists.
 *
 * Step 2 before step 3 is what "Family wins" means operationally. It is belt-and-braces rather than
 * load-bearing — ADR-011's database triggers make a colliding Product slug unwritable, so the
 * ambiguity this ordering resolves cannot currently occur — and the ordering stays because a rule
 * that is only enforced in one layer is a rule that moves when that layer does.
 *
 * ── Which failures may become a 404, and which may never ────────────────────
 *
 * ADR-010 §7 freezes it: infrastructure failure must never become a canonical-content 404. Three
 * properties keep that true here rather than leaving it to be remembered.
 *
 * First, the Family set is read from a local module. No API answers "which families exist", so no
 * API can make one stop existing, and `resolveCategoryPage` still never returns `null` for an API
 * condition — every failure renders the fixture and reports the cause.
 *
 * Second, the Product branch distinguishes its outcomes at the source (`lib/products.ts`), and only
 * ONE of them reaches `notFound()`: `not-found`, which is the API stating that no product answers
 * this slug. `unreachable` and `api-error` — a stopped service, a timeout, a 5xx, a malformed
 * payload — render `ProductUnavailable` instead.
 *
 * Third, `dynamicParams` is now `true`, so an unrecognised slug is no longer answered by the router
 * before this file runs. That makes the 404 decision this file's own, and the two clauses above are
 * what it is allowed to base it on.
 */

/**
 * There is deliberately NO `generateStaticParams` and NO `dynamicParams` on this segment.
 *
 * ── Why they were removed, with the mechanism stated ────────────────────────
 *
 * The previous gate enumerated the six Family slugs here and closed the segment with
 * `dynamicParams = false`, which was correct while the namespace held one entity type. Opening it
 * for Product Detail was expected to be a one-line flip to `true`. **It is not**, and the reason is
 * worth recording because it is not obvious from the flag's own documentation:
 *
 * `dynamicParams` on THIS segment does not override `dynamicParams = false` on the PARENT
 * `[locale]` layout. With `generateStaticParams` present here, Next builds the closed cross-product
 * of *locales × these slugs*, and any pair outside it 404s **at the router, before this file runs**.
 * Verified rather than assumed: with the layout closed and this function present, a Product URL
 * 404d in 29ms with no request reaching the API and no code in this file executing; removing this
 * function alone made the same URL render, while `/xx/...` kept 404ing.
 *
 * So the enumeration is gone rather than the parent's closure — which is the change that stays
 * local to this segment. The alternative, opening the `[locale]` segment, would trade a frozen
 * routing property (FRONTEND_ARCHITECTURE §2: `dynamicParams = false` is what makes `/xx` a 404
 * without the middleware having to recognise locales) for a build-time optimisation.
 *
 * ── What is actually lost: nothing measurable ───────────────────────────────
 *
 * The six Family pages are no longer prerendered at build time. They were not meaningfully
 * prerendered before either: this route reads `searchParams` for the Segment filter and every fetch
 * beneath it is `cache: "no-store"`, so it has rendered per request since the Product list landed.
 * The build's `●` marker claimed otherwise, and a check of `.next/server/app/en/products/` found no
 * emitted HTML for these routes — they had already bailed to dynamic.
 *
 * ── What still answers an unknown URL ───────────────────────────────────────
 *
 * `/xx/products/anything` still 404s at the router: the `[locale]` segment keeps its own
 * `generateStaticParams` and `dynamicParams = false`, so an unknown LOCALE never reaches this file
 * and never costs a catalog lookup. What reaches this file is a known locale with an arbitrary
 * slug, and deciding what that means is exactly this file's job.
 */

/**
 * The page's `<title>` and description, read straight from the content registry.
 *
 * ── No fetch, and that is the requirement rather than an optimisation ───────
 *
 * It calls `getCategoryContent`, **not** `resolveCategoryPage`: metadata comes from the fixture and
 * nothing else. Routing it through the resolver would issue a second `GET /categories/:slug` per
 * page — Next runs `generateMetadata` and the component as separate calls — and would make a
 * `<title>` depend on a network hop that is allowed to fail.
 *
 * `data.seo` is on the wire for this endpoint and is **not** consumed. That is a later gate
 * (`lib/catalog.ts` says so at the point the field is skipped), and P2 is not the SEO launch.
 *
 * ── No `robots`, no canonical, no `hreflang` ────────────────────────────────
 *
 * `app/[locale]/layout.tsx` declares `robots: { index: false, follow: false }` for this whole tree
 * and every page inherits it, so a route-level override would be a second answer to a settled
 * question. Canonical and `hreflang` are ADR-010 Non-Goals; §8 also records that the alternate set
 * would hold nothing but the default locale until translated slugs exist, so emitting one now would
 * publish a single-entry claim about a localization that has not happened.
 *
 * The six proof routes each carried these two strings as a literal. They now live in the fixtures,
 * character-for-character — see `CategoryPageMeta`.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  /*
   * The Family branch is unchanged: fixture only, no fetch. See the note above for why that is a
   * requirement rather than an optimisation.
   */
  const content = getCategoryContent(slug);
  if (content) {
    return { title: content.meta.title, description: content.meta.description };
  }

  /*
   * A reserved slug has no page and therefore nothing to describe. Returned before the lookup so a
   * reserved path never reaches the catalog.
   */
  if (isReservedProductSlug(slug)) return {};

  /*
   * The Product branch DOES fetch, because a Product has no local content to read a title from —
   * and it costs no extra request: `resolveProduct` is memoized per request with React's `cache`,
   * so this call and the component's below are one round trip that cannot disagree.
   *
   * `product.seo` carries `metaTitle`/`metaDescription` and is deliberately not consumed — mapping
   * `SeoFields` onto the Metadata API is the SEO gate's work. `name` and `description` are what the
   * page renders, so they are what it is titled with, and the API already falls its own SEO record
   * back to exactly these two values.
   *
   * Every non-success outcome returns `{}` rather than inventing a title: a 404 and an unavailable
   * page have nothing to describe, and naming the requested slug in a `<title>` would echo
   * caller-supplied text while implying the product is real.
   */
  const result = await resolveProduct(slug, locale);
  if (!result.ok) return {};

  return {
    title: result.record.name,
    ...(result.record.description === null ? {} : { description: result.record.description }),
  };
}

/**
 * The `?segment=` filter, read off the URL and normalized to what the client may send.
 *
 * Three shapes arrive here and each has one honest reading:
 *
 * - **absent, or blank** → no filter. A trimmed-empty value is the same request as no value, which
 *   is also how the API's own `normalizeFilter` reads it.
 * - **one value** → the filter, passed through unchanged. It is **not** validated against the
 *   frontend's Segment registry: whether a slug names a Segment is the API's answer (400
 *   VALIDATION_ERROR on `segment`, surfaced as its own state), and checking it here as well would
 *   put a second authority in front of a contract ADR-008 already fixed.
 * - **repeated** (`?segment=a&segment=b`) → no filter. ADR-008 explicitly defers multi-value
 *   taxonomy filtering, so there is no defined meaning to honour; picking one of the two would be
 *   inventing that meaning, and it stays visible because no chip renders as active.
 */
function readSegmentParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();

  return trimmed === "" ? null : trimmed;
}

export default async function ProductFamilyPage({
  params,
  searchParams,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string; slug: string }>;
  /**
   * Reading this opts the route into dynamic rendering, which costs nothing here: every fetch this
   * page issues is `cache: "no-store"`, so the route was already dynamic before the filter existed
   * (`lib/api-client.ts` records how that was verified).
   *
   * It is read for the Family branch only — `?segment=` narrows a family's product list, and a
   * Product Detail page has no list for it to narrow. The filter never decides whether a page
   * exists; the slug does.
   */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);

  /*
   * ── 1. Reserved ───────────────────────────────────────────────────────────
   *
   * Answered first and answered locally. ADR-010 §4 reserves `finder`, `segments` and `types`
   * against Families and Products alike, so neither branch below can legitimately claim one, and
   * asking the catalog about them would be treating reserved route space as a possible product.
   *
   * A 404 is the honest answer while the routes they are reserved FOR are unbuilt — the same answer
   * any other unclaimed slug gets. When the Product Finder ships as a static `finder/page.tsx`
   * sibling it outranks this dynamic segment and this clause stops being reached.
   */
  if (isReservedProductSlug(slug)) notFound();

  /*
   * ── 2. Family — and this is what "Family precedence" means ────────────────
   *
   * The local content registry decides, and a hit returns without any Product lookup being issued
   * at all. Everything below this point is unchanged from the previous gate: the same resolver, the
   * same fail-open, the same `Suspense`-boundaried product list, the same `?segment=` filter.
   */
  const content = getCategoryContent(slug);

  if (content) {
    const activeSegment = readSegmentParam(query.segment);

    /*
     * The product list is started here and deliberately NOT awaited. Data access stays at the route
     * (FRONTEND_ARCHITECTURE §7) while the promise travels down to a `Suspense` boundary in the
     * template, so a slow catalog service delays one section instead of eleven. It cannot reject —
     * `getProductsByCategory` reports every API condition as a value.
     */
    const products = getProductsByCategory(slug, locale, activeSegment ?? undefined);

    /*
     * `locale` is forwarded so the API can resolve the family's `name` in it — the one API-owned
     * value this page renders. It is also what scopes the resolver's slug guard, which is only a
     * valid identity test in the default locale.
     */
    const page = await resolveCategoryPage(slug, locale);

    /*
     * Unreachable: `content` above came from the same registry the resolver reads, so a fixture
     * cannot be present for one and absent for the other. Kept because it is the resolver's
     * contract — `null` means "no fixture registered" and never an API condition — and because a
     * silent `page!` here would be the assertion this route must not make.
     */
    if (!page) notFound();

    return (
      <ProductCategoryTemplate
        content={page.content}
        family={page.family}
        locale={locale}
        products={products}
        activeSegment={activeSegment}
      />
    );
  }

  /*
   * ── 3. Product ────────────────────────────────────────────────────────────
   *
   * The only branch that asks the network whether a page exists, and therefore the only one where
   * ADR-010 §7 has teeth. `?segment=` is not read here: it is a Product Family filter, and a
   * Product Detail page has no list for it to narrow.
   *
   * There is no `Suspense` boundary around this. A boundary streams a *part* of a page while the
   * rest renders — but here the fetch decides whether the page exists at all, so there is nothing
   * that could honestly render before it resolves. Streaming a shell and then replacing it with a
   * 404 would emit a page that says a product exists and then retract it.
   */
  const result = await resolveProduct(slug, locale);

  if (result.ok) {
    return (
      <ProductDetailTemplate
        product={result.record}
        locale={locale}
        localeFallback={result.localeFallback}
      />
    );
  }

  /*
   * The ONE condition allowed to 404: the API answered, and its answer was that no product carries
   * this slug in this locale. That is a fact about the catalog, and a canonical 404 is the correct
   * representation of it.
   */
  if (result.reason === "not-found") notFound();

  /*
   * Everything else — service down, refused, timed out, 5xx, or a 200 that is not a product. The
   * page's existence is UNKNOWN, and ADR-010 §7 forbids reporting unknown as absent. Reported
   * server-side so the condition is visible in logs rather than only to the visitor.
   */
  console.warn(
    `[product:${slug}] rendering unavailable state — ` +
      (result.reason === "unreachable"
        ? "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)"
        : `the API answered, but not with a product (HTTP ${String(result.status)})`),
  );

  return <ProductUnavailable locale={locale} />;
}
