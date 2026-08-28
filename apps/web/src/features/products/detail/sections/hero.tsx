import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";

import type { ProductDetailResponse } from "@sam-group/types";

/**
 * The Product Detail hero — breadcrumb, name, description, and the product's classification.
 *
 * ── Everything here is API-backed ───────────────────────────────────────────
 *
 * Name, description, category and segments all come from `GET /products/:slug`. There is no
 * fixture behind product identity: unlike a Product Family, a Product has no local record to fall
 * back to, which is exactly why the route treats a failed lookup as a server condition rather than
 * rendering something in its place. Family-level buyer guidance appears later and never substitutes
 * for an API Product field.
 *
 * **Nothing is invented for an empty field.** A product with no Segments renders no Segment row —
 * not an empty one, not "—". A null `productType` renders no Product Type row at all, which is the
 * state of every product in the database while no Product Type vocabulary is approved (ADR-008).
 * The rule is the same one `category-contract.ts` states for the family fixtures: a value that does
 * not exist is absent, never filled in with something plausible.
 *
 * ── The breadcrumb is logical, not a URL hierarchy ──────────────────────────
 *
 * Products → Family → Product, which is how a buyer understands the catalog. It is deliberately NOT
 * how the URL is built: ADR-007 §4 and ADR-010 §2 make the canonical Product URL flat —
 * `/{locale}/products/{product-slug}` — with the family a *relationship* rather than URL ancestry.
 * So the middle crumb links to the family's own flat page and the trail composes no nested path.
 *
 * The family crumb is built from `product.category`, the record the API resolved, rather than from
 * the local family registry. That keeps one answer to "which family is this product in" — the
 * database's — and means the crumb cannot disagree with the product it sits above.
 *
 * A Server Component. No state, no JavaScript.
 */
export function ProductHero({
  product,
  locale,
  localeFallback,
}: {
  readonly product: ProductDetailResponse;
  readonly locale: string;
  /** True when part of this response was served in the default locale. Rendered as a notice. */
  readonly localeFallback: boolean;
}): ReactNode {
  return (
    <section className="fs-sec pd-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />

      <div className="fs-wrap pd-hero-inner">
        <nav className="pd-crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <a href={`/${locale}${ROUTES.products}`}>Products</a>
            </li>
            <li>
              {/*
               * `category.slug` is the API's answer in the requested locale. With no translated
               * Category slug in the database it is the default-locale slug in every locale, which
               * is the URL ADR-010 §8 launches for `fa`/`ar` — so this resolves in all three today.
               */}
              <a href={`/${locale}${ROUTES.products}/${product.category.slug}`}>
                {product.category.name}
              </a>
            </li>
            {/* The current page: marked as such rather than linked to itself. */}
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>

        <h1 className="fs-d1 pd-title">{product.name}</h1>

        {product.description !== null && product.description !== "" && (
          <p className="fs-lead pd-lead">{product.description}</p>
        )}

        {/*
         * The classification block. Each row renders only when the API supplied it, so a product
         * with no Segments and no Product Type renders no block at all rather than an empty frame.
         */}
        {(product.segments.length > 0 || product.productType !== null) && (
          <dl className="pd-facts">
            <div>
              <dt>Product family</dt>
              <dd>
                <a href={`/${locale}${ROUTES.products}/${product.category.slug}`}>
                  {product.category.name}
                  <Arrow size={12} />
                </a>
              </dd>
            </div>

            {product.segments.length > 0 && (
              <div>
                <dt>{product.segments.length === 1 ? "Segment" : "Segments"}</dt>
                <dd>
                  <ul className="pd-segments">
                    {product.segments.map((segment) => (
                      <li key={segment.slug}>{segment.name}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}

            {/*
             * Rendered only for a non-null Product Type. No row in `product_types` is approved, so
             * this is unreachable today — it is here because the field is on the wire and omitting
             * it would mean the page silently drops approved data the day the vocabulary lands.
             */}
            {product.productType !== null && (
              <div>
                <dt>Product type</dt>
                <dd>{product.productType.name}</dd>
              </div>
            )}
          </dl>
        )}

        {/*
         * The API's own `meta.localeFallback`, surfaced rather than hidden. It states a fact about
         * this response — part of it was served in the default locale because the requested one has
         * no translation — and a page that quietly showed English under `/fa` without saying so
         * would be misrepresenting the content. Not shown at all in the default locale, where there
         * is nothing to fall back from.
         */}
        {localeFallback && (
          <p className="pd-fallback-note">
            Some details are shown in the site&rsquo;s default language because this product has not
            been translated yet.
          </p>
        )}
      </div>
    </section>
  );
}
