import type { CategoryResponse } from "./category.response";
import type { SeoFields } from "@sam-group/types";

/**
 * The wire shapes of the product endpoints — API_CONTRACT_FINAL.md §2.3.
 *
 * `name`, `slug` and `description` carry the requested locale's values, resolved from
 * `content_translations`; the row's own columns hold the default locale
 * (INTERNATIONALIZATION_STRATEGY.md §3).
 *
 * `SeoFields` is contracted for `GET /products/:slug` only, so it appears on
 * ProductDetailResponse and on neither the list row nor the nested category.
 */

/** One row of `GET /products`. Deliberately without media: a list of 20 products would mean 20 more joins for imagery no list layout is specified to need. */
export type ProductListItemResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The owning category's id. Its localized name and slug come from `GET /categories`. */
  categoryId: string;
  /** ISO 8601. Serialized here rather than left as a `Date`, so the wire shape does not depend on the JSON serializer in front of it. */
  createdAt: string;
};

/**
 * `key`/`value`/`unit` are returned verbatim. `Specification` is not one of the entity types
 * `content_translations` covers (see common/content/content-entity-type.ts), so there is no
 * translated form to resolve and inventing one would mean writing rows no other module reads.
 */
export type ProductSpecificationResponse = {
  id: string;
  key: string;
  value: string;
  unit: string | null;
};

/**
 * A public product image. `Media` has no visibility column, so "public" is expressed as
 * `type = image`: COA/SDS/TDS and every other document are `file`/`document` rows and are
 * excluded by the type filter, not by a flag that could be forgotten.
 */
export type ProductImageResponse = {
  id: string;
  url: string;
  altText: string | null;
};

/**
 * One Segment a product belongs to — ADR-007 §4, where Segment is first-class and Product ↔
 * Segment is many-to-many.
 *
 * `name` and `slug` only. The id is deliberately absent: Segment is a navigation/facet axis,
 * not canonical URL ancestry, and nothing on a product page addresses a Segment by id. So is
 * `sortOrder` — it decides the order of this array and has no meaning once the array is
 * ordered. Both are selected internally, because localization keys on the id.
 */
export type ProductSegmentResponse = {
  name: string;
  slug: string;
};

/**
 * A product's PRIMARY Product Type — single-valued in v2 (ADR-007 §4), and null while no
 * ProductType row is approved. The same two fields, withheld for the same reasons.
 */
export type ProductTypeResponse = {
  name: string;
  slug: string;
};

export type ProductDetailResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  /** Localized alongside the product, in the same request — not a second round trip for the client. */
  category: CategoryResponse;
  /** Ordered by `Segment.sortOrder`. Empty when the product belongs to no Segment. */
  segments: ProductSegmentResponse[];
  /** Null when the product has no primary Product Type — the Phase 1 state of every row. */
  productType: ProductTypeResponse | null;
  specifications: ProductSpecificationResponse[];
  images: ProductImageResponse[];
  /** The requested locale's SEO record, with `hreflang` alternates — SEO_ARCHITECTURE.md §0. */
  seo: SeoFields;
};
