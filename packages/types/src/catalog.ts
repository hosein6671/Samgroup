/**
 * The catalog resources' wire shapes — API_CONTRACT_FINAL.md §2.3.
 *
 * Shared rather than declared inside `apps/web` so the frontend client and any later consumer
 * read one declaration. The same caveat as `api.ts` applies: `apps/api` keeps its own DTOs and is
 * untouched in this gate, so this is a transcription of the contract, not `tsc`-enforced
 * agreement with the backend.
 */

import type { SeoFields } from "./seo";

/**
 * One category, as `GET /categories` and `GET /categories/:slug` both serve it.
 *
 * `name` and `slug` carry the REQUESTED locale's values, resolved server-side from
 * `content_translations`; the row's own columns hold the default locale
 * (INTERNATIONALIZATION_STRATEGY.md §3). A category is therefore reachable at a translated slug
 * and answers with the same `id` — which is why `id`, not `slug`, is the join key, while `slug`
 * in the DEFAULT locale is the canonical Product Family identifier (ADR-009 §1).
 *
 * ── `seo` is deliberately not modelled ──────────────────────────────────────
 *
 * `GET /categories/:slug` additionally carries `seo: SeoFields` (§2.3) — `GET /categories` does
 * not. It is absent here on purpose rather than by oversight: consuming it is explicitly out of
 * scope for the first integration gate, extra JSON properties do not affect parsing, and a
 * declared shape that nothing reads is surface that can drift unnoticed. It is added, with
 * `SeoFields` from this same package, by the gate that consumes it.
 */
export type CategoryResponse = {
  id: string;
  name: string;
  /** The requested locale's slug. In the default locale this is the canonical family identifier. */
  slug: string;
  /** Null for a top-level category — the six Product Families the site is built around. */
  parentId: string | null;
};

/**
 * One row of `GET /products` — API_CONTRACT_FINAL.md §2.7, transcribed from `apps/api`'s own
 * `ProductListItemResponse` field for field.
 *
 * `name`, `slug` and `description` carry the REQUESTED locale's values, resolved server-side from
 * `content_translations`, on the same fallback rule as `CategoryResponse`.
 *
 * ── What the list deliberately does NOT carry ───────────────────────────────
 *
 * **No `segments`, no `productType`, no `specifications`, no `images`, no `seo`.** All five are
 * `GET /products/:slug` fields and the backend's `PRODUCT_SELECT` is explicit that the list stays
 * without them — media because a page of rows would mean a join per row, taxonomy because ADR-008
 * made `?segment=`/`?productType=` list-only *filters* rather than list *fields*. This declaration
 * therefore says what the wire says. A consumer that needs a product's Segments reads the detail
 * endpoint; widening this shape is a backend gate, not a frontend one.
 *
 * `createdAt` is modelled because it is on the wire and this type claims to be the row. Nothing in
 * `apps/web` reads it yet — the list is served in the API's default `name` order.
 */
export type ProductListItemResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The owning category's id — never its slug. Join key, not a route segment. */
  categoryId: string;
  /** ISO 8601. */
  createdAt: string;
};

/**
 * One Segment a product belongs to — ADR-007 §4, where Segment ↔ Product is many-to-many.
 *
 * `name` and `slug` only, and the omissions are the backend's decision rather than this file
 * declaring less than the wire carries: the internal id is withheld because a Segment is a
 * navigation/facet axis and never URL ancestry, and `sortOrder` is withheld because it decides the
 * order of the array and has no meaning once the array is ordered.
 */
export type ProductSegmentResponse = {
  name: string;
  slug: string;
};

/** A product's PRIMARY Product Type — single-valued in v2, and null while no ProductType row is approved. */
export type ProductTypeResponse = {
  name: string;
  slug: string;
};

/**
 * One `Specification` row, returned verbatim.
 *
 * `Specification` is not one of the entity types `content_translations` covers, so there is no
 * translated form — these three values read the same in every locale.
 */
export type ProductSpecificationResponse = {
  id: string;
  key: string;
  value: string;
  unit: string | null;
};

/**
 * One public product image.
 *
 * "Public" is expressed by the API as `type = image`, not by a visibility flag: COA, SDS, TDS and
 * every other document are `file`/`document` rows and are excluded by that filter, which is why a
 * consumer can render this array without having to check anything itself.
 */
export type ProductImageResponse = {
  id: string;
  url: string;
  altText: string | null;
};

/**
 * One product, as `GET /products/:slug` serves it — API_CONTRACT_FINAL.md §2.3, transcribed from
 * `apps/api`'s own `ProductDetailResponse` field for field.
 *
 * `name`, `slug` and `description` carry the REQUESTED locale's values; so do `category`,
 * `segments` and `productType`, each resolved through the same `content_translations` overlay. When
 * any of them fell back to the default locale the response says so in `meta.localeFallback` — which
 * is envelope metadata rather than a field here, and is surfaced by the client alongside the record.
 *
 * ── What is on the wire and is NOT declared ─────────────────────────────────
 *
 * `createdAt` is on this endpoint and is modelled, because this type claims to be the record.
 * Nothing else is omitted: unlike `CategoryResponse`, whose `seo` block is deliberately unmodelled
 * until a gate consumes it, this shape is declared complete because the Product Detail page reads
 * across most of it and a half-declared record would invite the next reader to guess.
 *
 * `seo` is declared and **not yet consumed** — the page's `generateMetadata` reads `name` and
 * `description` directly. Wiring `SeoFields` through to the Metadata API is the SEO gate's work,
 * and doing it here would be that gate arriving early.
 */
export type ProductDetailResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** ISO 8601. */
  createdAt: string;
  /** The owning Product Family, localized in the same request rather than a second round trip. */
  category: CategoryResponse;
  /** Ordered by the Segment's publishing order. Empty when the product belongs to no Segment. */
  segments: ProductSegmentResponse[];
  /** Null when the product has no primary Product Type — the state of every row in Phase 1. */
  productType: ProductTypeResponse | null;
  specifications: ProductSpecificationResponse[];
  images: ProductImageResponse[];
  seo: SeoFields;
};
