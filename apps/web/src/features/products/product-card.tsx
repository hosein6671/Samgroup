import type { ReactNode } from "react";

import type { ProductListItemResponse } from "@sam-group/types";

/**
 * One product, as `GET /products` serves it.
 *
 * Written against the LIST row rather than against a page, so the Product Finder and any later
 * product-bearing surface render the same card from the same shape. It holds no layout of its own
 * beyond the card — the grid belongs to whatever is listing them.
 *
 * ── It renders two fields, and that is the whole contract ───────────────────
 *
 * `name` and `description`. Nothing else is on the wire: `ProductListItemResponse` is `id`, `name`,
 * `slug`, `description`, `categoryId`, `createdAt`, and the last two are join key and timestamp.
 *
 * There is deliberately **no grade, no viscosity, no standard, no approval, no packaging, no
 * product code and no performance claim** anywhere in this component. Not blank — absent. Every one
 * of those is a technical or commercial claim, none is approved, and `Specification` rows do not
 * exist for any product in the database. A field that does not exist cannot be filled in with a
 * plausible guess, which is the same rule `category-contract.ts` states for the category fixtures.
 *
 * `segments` is absent for a different reason and it is worth keeping the two apart: a product's
 * Segments are real, approved data — they are simply not on the list endpoint (`PRODUCT_SELECT` is
 * list-only by decision). The Segment axis is exposed as a filter control beside the list instead
 * of as a badge on the card, so nothing here has to invent what the response did not carry.
 *
 * ── It links, now that there is somewhere to link to ────────────────────────
 *
 * The card previously took no `href` at all, deliberately, because the Product branch of the shared
 * namespace did not exist and every link would have 404d. That branch now exists, so each card is a
 * link to the product's canonical URL.
 *
 * **The URL is composed here rather than passed in**, and that is the safer arrangement rather than
 * the convenient one. The canonical shape is flat — `/{locale}/products/{product-slug}` (ADR-007
 * §4, ADR-010 §2) — with the Product Family a relationship and never URL ancestry. A caller passing
 * an `href` could pass a nested one; a caller passing a `locale` and letting the card build the
 * path cannot. The family page is the only caller today and it renders inside a family's URL, which
 * is exactly the context in which a nested link would look natural and be wrong.
 *
 * Two invariants make the link safe without this component checking anything. A Product slug cannot
 * equal a Family slug or a reserved value, because ADR-011's database triggers reject the write —
 * so no card can ever point at a Family page or into reserved route space. And the slug is the
 * REQUESTED locale's slug, resolved server-side, so the link stays inside the locale it was
 * rendered in.
 *
 * ── No demo badge ───────────────────────────────────────────────────────────
 *
 * The current rows are DEMO / PLACEHOLDER data, and nothing on the wire says so — `Product` has no
 * demo column and inventing a badge from a slug prefix would be this component asserting a data
 * classification it cannot see. It does not need to: the seeded names begin "SAM Demo" and the
 * seeded description opens "DEMO / PLACEHOLDER CONTENT", both of which this card renders verbatim.
 *
 * A Server Component. No state, no JavaScript.
 */
export function ProductCard({
  product,
  locale,
}: {
  readonly product: ProductListItemResponse;
  /** The active locale segment. Half of the canonical URL; the product's slug is the other half. */
  readonly locale: string;
}): ReactNode {
  return (
    <article className="pl-card">
      <h3 className="pl-card-name">
        {/*
         * The whole card is not the link — the heading is. A card-sized anchor wrapping a
         * five-line description gives a screen reader one enormous link name, and it takes the
         * description's text out of reach of selection. The heading carries the product's name,
         * which is the accessible name this link should have.
         */}
        <a className="pl-card-link" href={`/${locale}/products/${product.slug}`}>
          {product.name}
        </a>
      </h3>

      {/*
       * Clamped in CSS, never truncated in JavaScript. A string cut at a character count can end
       * mid-word or mid-clause and change what a sentence appears to say — which on a description
       * that opens with a placeholder disclaimer would be the one sentence worth not shortening.
       * The full text stays in the document; only its rendered height is bounded.
       */}
      {product.description !== null && product.description !== "" && (
        <p className="pl-card-summary">{product.description}</p>
      )}
    </article>
  );
}
