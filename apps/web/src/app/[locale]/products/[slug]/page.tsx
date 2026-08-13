import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductCategoryTemplate } from "@/features/products/category/category-template";
import { getCategoryContent, publishedCategorySlugs } from "@/features/products/category/data";
import { resolveCategoryPage } from "@/features/products/category/resolve-category-page";

/**
 * The canonical Product Family route — `/{locale}/products/{slug}`.
 *
 * ── What this file is, and what it deliberately is not ──────────────────────
 *
 * ADR-010 §2 puts Product Family and Product Detail in ONE namespace served by ONE dynamic
 * segment, because the App Router cannot express `products/[categorySlug]` and
 * `products/[productSlug]` as siblings. This is that segment. It is **not** yet that route: P2
 * implements the Product Family branch only, and Product Detail remains unimplemented.
 *
 * There is therefore no discriminator here, and that absence is the design rather than a stub.
 * ADR-010 §2 requires exactly one shared discriminator when two entity types occupy the namespace;
 * with one entity type there is nothing to discriminate, and writing a two-branch resolution now
 * would be building the mechanism that ADR names — before the ADR authorizes it, and against data
 * that cannot exercise it. When Products arrive, the branch is added in ONE place, and the honest
 * seam is the pair below: `generateStaticParams` stops being the whole answer, and `dynamicParams`
 * flips to `true`.
 *
 * ── Why `notFound()` is unreachable from anything the network does ──────────
 *
 * ADR-010 §7 freezes it: infrastructure failure must never become a canonical-content 404. Two
 * structural properties enforce that here rather than a rule anyone has to remember.
 *
 * First, the slug set below is read from a local module. No API answers "which families exist", so
 * no API can make one stop existing.
 *
 * Second, `resolveCategoryPage` never returns `null` for an API condition — every failure renders
 * the fixture and reports the cause. `null` means only "no fixture is registered", which under
 * `dynamicParams = false` cannot happen at all.
 *
 * The 404s this route does serve are the honest kind: a slug outside the generated set names
 * nothing, and the router answers that without consulting anything.
 */

/**
 * The six canonical Product Family slugs — every default-locale `Category.slug` in the registry.
 *
 * ── Local, on purpose ───────────────────────────────────────────────────────
 *
 * `publishedCategorySlugs()` reads the content registry, not `GET /categories`. That is what keeps
 * the Category API out of the build: `apps/web` already fails its build loudly when the LOCALE API
 * cannot say which locales exist (`app/[locale]/layout.tsx`), because that answer decides which
 * pages exist at all and nothing can stand in for it. A family's existence is a different kind of
 * fact — the fixture holds it, and ADR-010 §7 scopes the fail-open policy to exactly the period in
 * which it does. Querying the catalog here would convert an approved fail-open into a second build
 * hard dependency, for a set of six values that are frozen.
 *
 * ── The locale dimension is the parent's ────────────────────────────────────
 *
 * This returns slugs only. The `[locale]` segment generates its own params from the Locale table
 * and the framework crosses the two, so the emitted set is *active locales × these six* without
 * either level enumerating the other — and adding a language stays a database row.
 *
 * ── What is NOT here ────────────────────────────────────────────────────────
 *
 * **No translated slugs.** None exist: `content_translations` holds no `slug` row for any Category,
 * and ADR-010 §8 states the launch position plainly — `fa` and `ar` Product Family URLs are served
 * at the default-locale English slug, which is what the six values below produce under every locale
 * prefix. Those URLs are the default-locale slug under a non-default prefix. **They are not
 * localized slugs**, and generating a translated param that no row backs would be inventing the
 * vocabulary ADR-009 §3 says is resolved server-side.
 *
 * **No `finder`, `segments` or `types`.** ADR-010 §4 reserves all three in this namespace. They are
 * absent because they are not families — not special-cased, because a route-level exception would
 * be an enforcement mechanism, and §6 deliberately did not select one. Emitting them would be the
 * real harm: it would mint a `[slug]` page for a path a future static sibling must own, and a static
 * segment outranking a dynamic one is exactly what keeps those paths free.
 *
 * **No Product slugs.** There are no Products.
 */
export function generateStaticParams(): { slug: string }[] {
  return publishedCategorySlugs().map((slug) => ({ slug }));
}

/**
 * The segment is closed to the generated set — a slug that is not one of the six 404s at the router,
 * before this file's code runs at all.
 *
 * It is the same mechanism `app/[locale]/layout.tsx` uses to make `/xx` a 404, and it is what gives
 * P2 the correct answer for a non-family slug without writing a Product branch: nothing here has to
 * decide what `/en/products/some-product` means, because Product Detail does not exist and the
 * router never reaches this file to be asked.
 *
 * **This flips to `true` with Product Detail**, whose slug set is not statically enumerable — ADR-007
 * Recorded Conflict 3 keeps products out of the sitemap. One line, and the seam is stated here so
 * that gate does not have to rediscover it.
 */
export const dynamicParams = false;

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
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = getCategoryContent(slug);

  /*
   * Unreachable while `dynamicParams = false` holds. An empty object rather than a throw, because
   * a page that is about to 404 has no metadata to describe and should not fail first.
   */
  if (!content) return {};

  return { title: content.meta.title, description: content.meta.description };
}

export default async function ProductFamilyPage({
  params,
}: {
  // A Promise in Next 15 — awaited below rather than destructured in the signature.
  readonly params: Promise<{ locale: string; slug: string }>;
}): Promise<ReactNode> {
  const { locale, slug } = await params;

  /*
   * `locale` is forwarded so the API can resolve the family's `name` in it — the one API-owned
   * value this page renders. It is also what scopes the resolver's slug guard, which is only a
   * valid identity test in the default locale.
   */
  const page = await resolveCategoryPage(slug, locale);
  if (!page) notFound();

  return <ProductCategoryTemplate content={page.content} family={page.family} />;
}
