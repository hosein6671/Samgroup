import type { ReactNode } from "react";

import { ROUTES } from "@/features/site/site-routes";

/**
 * The Product Finder hero — breadcrumb, title, and one neutral sentence about what the tool does.
 *
 * ── Nothing here is a claim about the catalog ───────────────────────────────
 *
 * No count, no range, no capability and no marketing copy. The only substantive sentence describes
 * the two controls immediately below it, which is a fact about this page rather than an assertion
 * about products — and no source document supplies approved copy for this page, so anything richer
 * would be invented (CLAUDE.md §4).
 *
 * **It does not restate the four facets the landing page's teaser names.** That teaser describes
 * category, industry, application and packaging; this page offers two axes, because those are the
 * two the API can actually filter on today. Repeating the teaser's four here would promise controls
 * that are not on the page.
 *
 * ── The breadcrumb is two crumbs, and stops ─────────────────────────────────
 *
 * Products → Product Finder. `/{locale}/products/finder` is a structural route rather than a
 * catalog entity, so it has no family above it and no localized slug of its own — the URL is the
 * same fixed English path in every locale (PROJECT_HANDOFF §6.12), with only the prefix varying.
 *
 * A Server Component. No state, no JavaScript.
 */
export function FinderHero({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec pf-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pf-hero-inner">
        <nav className="pf-crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <a href={`/${locale}${ROUTES.products}`}>Products</a>
            </li>
            {/* The current page: marked as such rather than linked to itself. */}
            <li aria-current="page">Product Finder</li>
          </ol>
        </nav>

        <h1 className="fs-d1 pf-title">Product Finder</h1>

        <p className="fs-lead pf-lead">
          Narrow the published range by product family, by segment, or by both together. Each
          selection is part of the address, so a filtered view can be shared, bookmarked and
          reopened exactly as it was.
        </p>
      </div>
    </section>
  );
}
