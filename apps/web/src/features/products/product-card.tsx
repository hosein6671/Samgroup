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
 * ── Not a link, and that is load-bearing ────────────────────────────────────
 *
 * There is no `<a>` in this component. `/{locale}/products/{slug}` is a shared namespace serving
 * the Product Family branch only (ADR-010 §2); the Product branch and its discriminator are a
 * separate gate, and `dynamicParams = false` on that segment means a product slug 404s at the
 * router today. A card that linked would produce a broken link on every row, so the card does not
 * accept an `href` at all — a component that cannot be given one cannot acquire one by accident
 * before the route exists.
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
export function ProductCard({ product }: { readonly product: ProductListItemResponse }): ReactNode {
  return (
    <article className="pl-card">
      <h3 className="pl-card-name">{product.name}</h3>

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
