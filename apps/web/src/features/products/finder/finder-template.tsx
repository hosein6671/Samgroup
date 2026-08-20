import { Suspense } from "react";
import type { ReactNode } from "react";

/*
 * The same stylesheet arrangement the category and detail templates use, and for the same stated
 * reasons: `flagship.css` declares the `[data-brand="flagship"]` scope this page's tokens resolve
 * inside, `product-list.css` is imported because the filter chips, the count, the card grid and the
 * notices are its constructions reused verbatim, and `finder.css` holds only what is this page's
 * own. Importing a stylesheet is what reusing a component honestly costs.
 *
 * `products.css` is deliberately NOT imported. It is here that the pattern stops: this page renders
 * no `.pr-*` construction, because it does not render the shared closing CTA — see below.
 */
import "../../home/flagship.css";
import "../product-list.css";
import "./finder.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { FinderFilters } from "./sections/filters";
import { FinderHero } from "./sections/hero";
import { FinderResults, FinderResultsSkeleton } from "./sections/results";

import type { FinderQuery } from "./finder-query";
import type { ProductListResult } from "@/lib/products";

/**
 * The Product Finder — `/{locale}/products/finder`.
 *
 * ── A short page, and deliberately so ───────────────────────────────────────
 *
 * Hero, filters, results. There is no editorial section, no documentation register, no industries
 * strip and no related content, and none of that is an oversight: this page is a tool, everything
 * it could say about the catalog is either a control or a result, and no source document supplies
 * approved copy for anything in between.
 *
 * **The shared closing CTA is absent, and that is the one deviation from the other product pages
 * worth stating.** SITE_STRUCTURE §3 specifies that block for the Products landing and the six
 * family pages; its first action is "View Product Finder", which on this page would be a link to
 * the page the visitor is already reading. A self-referential next step is worse than no next step,
 * so the block is omitted rather than edited into a variant — editing it would change what the
 * landing and the six family pages render.
 *
 * ── Filters render before results, and independently of them ────────────────
 *
 * The route creates the product-list promise and does **not** await it, so the hero and both filter
 * rows stream immediately while `GET /products` is in flight, and only the results block waits.
 * Without that boundary a hung catalog service would hold the whole page for up to the API client's
 * ten-second timeout — including the controls, which are the one part of this page that owes the
 * catalog service nothing and the one part a visitor could use to try something else.
 *
 * Data access stays at the route (FRONTEND_ARCHITECTURE §7): this template awaits nothing and
 * fetches nothing.
 *
 * ── Entirely server-rendered ────────────────────────────────────────────────
 *
 * Not one component in this tree carries `"use client"`. Every filter is a link, the results are a
 * grid of Server Components, and the reveals are the design system's scroll-driven CSS. The only
 * client JavaScript on the page is the header's, inherited from the shared chrome — the same budget
 * every other page on the platform holds to. Filter state lives in the URL, so refresh, Back,
 * bookmarking and link-sharing work by construction rather than by being implemented.
 */
export function ProductFinderTemplate({
  locale,
  locales,
  query,
  products,
}: {
  /** The active locale segment. Half of every link this page emits. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /** The normalized filter state, exactly as the route read it off the URL. */
  readonly query: FinderQuery;
  /** Created by the route and deliberately un-awaited — see the boundary note above. */
  readonly products: Promise<ProductListResult>;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <FinderHero locale={locale} />

        {/*
         * One section rather than two. The filter bar and the list it produces are a single
         * statement — controls, then what they selected — and splitting them across two sections
         * would put the page's own vertical rhythm between a control and its result.
         */}
        <section className="fs-sec pf-sec" data-surface="light">
          <div className="fs-wrap">
            <FinderFilters locale={locale} query={query} />

            <Suspense fallback={<FinderResultsSkeleton />}>
              <FinderResults products={products} locale={locale} query={query} />
            </Suspense>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
