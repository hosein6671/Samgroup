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
 * A Specification's grade facet, when the fact belongs to one grade of the product rather than
 * to the product as a whole (ADR-014 §1). `label` is the source's exact wording, verbatim —
 * never parsed or reformatted. `gradeSystem` is null when the label has not been safely
 * classified against `sae`/`iso_vg`/`nlgi` yet, which is a real state, not a gap.
 *
 * Lowercased, matching the wire convention `catalog-review.service.ts`'s admin `toGradeRef`
 * already established for this same column — one enum, one casing, on both APIs.
 */
export type ProductSpecificationGradeResponse = {
  label: string;
  gradeSystem: "sae" | "iso_vg" | "nlgi" | null;
};

/**
 * The shape of a normalized value — what the numeric columns mean, never what the property is
 * (ADR-014 §3, `SpecValueType`). Null on every legacy, unnormalized row. Lowercased, again
 * matching `catalog-review.service.ts`'s existing wire convention for the same column.
 */
export type ProductSpecificationValueType =
  "point" | "range" | "minimum" | "maximum" | "text" | "report_only" | "code" | "pair";

/**
 * `key`/`value`/`unit` are returned verbatim. `Specification` is not one of the entity types
 * `content_translations` covers (see common/content/content-entity-type.ts), so there is no
 * translated form to resolve and inventing one would mean writing rows no other module reads.
 *
 * `value` prefers the normalized `displayValue` when a reviewer's approval carries one, and
 * falls back to the legacy `value` column otherwise — the two are never both rendered, because
 * they describe the same fact at two points in this table's history (ADR-014 §9). The
 * `specifications_normalized_complete` CHECK guarantees `displayValue` is non-empty on every row
 * that carries a `valueType`, so `value` is always the correct printed text; a caller never needs
 * to reconstruct one from `numericMin`/`numericMax`/`pairFirst`/`pairSecond` — those exist so a
 * caller can distinguish WHAT KIND of value it is (ADR-014 §3), not to re-derive its text.
 *
 * `method`, `qualifier` and `resultBasis` are additive fields (ADR-014 §§3–4), all already stored
 * on every `Specification` row and already covered by `v_specification_public`'s allow-list —
 * this is the first caller to read them. `qualifier` is the test CONDITION a numeric column
 * cannot express (e.g. "@ -25 °C", "After shear, 30 cycles (ASTM D6278)") — distinct from
 * `method`, which names the test itself, and never merged into it or into `key`.
 *
 * `resultBasis` is never null: the column itself defaults to `unspecified` so that a row can
 * never silently imply a claim about the number it never made. `numericMin`/`numericMax`/
 * `pairFirst`/`pairSecond` are serialized as decimal strings, never as JavaScript numbers —
 * `numeric(20,6)` does not fit in a double, and a specification limit that changes when
 * round-tripped is not a limit (the same reasoning `catalog-review.service.ts`'s `decimalString`
 * states about the column itself). `grade` is null for a Product-level fact and populated for a
 * Grade-level one.
 *
 * What stays off this type, deliberately: `propertyKey` (the internal dictionary key —
 * `SpecProperty.canonicalMeaning` is documented as "not a public label", so `key` remains the
 * only property label served) and every provenance column (`reviewStatus`, timestamps, evidence,
 * `SourceDocument`/`SourceFact` identity). ADR-014 §6 makes `SourceDocument` categorically
 * non-public — there is no public "revision" of a source document, and none is added here.
 */
export type ProductSpecificationResponse = {
  id: string;
  key: string;
  value: string;
  unit: string | null;
  method: string | null;
  qualifier: string | null;
  resultBasis: "average" | "typical" | "specification_limit" | "measured" | "unspecified";
  valueType: ProductSpecificationValueType | null;
  numericMin: string | null;
  numericMax: string | null;
  pairFirst: string | null;
  pairSecond: string | null;
  grade: ProductSpecificationGradeResponse | null;
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
