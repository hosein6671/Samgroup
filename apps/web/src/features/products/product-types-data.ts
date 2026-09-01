/**
 * The Product Type vocabulary, as the Finder's filter control needs it.
 *
 * ── READ THIS BEFORE CHANGING A LINE OF IT ──────────────────────────────────
 *
 * This is a **mirror of persisted reference data, not a source of it**. Every slug below is a
 * `product_types.slug` in `sam_platform`, and the eight are the complete set the catalogue import
 * wrote from `PROPOSED_PRODUCT_TYPE_KEYS` in `apps/api`'s `import/taxonomy-mapping.ts`. No entry
 * here was authored, and none may be: a Product Type that exists here and not in `sam_platform` is
 * a filter the API answers **400 VALIDATION_ERROR** for, and one that exists there and not here is
 * a filter no visitor can reach.
 *
 * ── What approves these eight, and what does not ────────────────────────────
 *
 * **ADR-020, 31 August 2026.** It approves the eight slugs AND their display names as vocabulary,
 * closing ADR-008's "Product Type names and slugs — not one is approved" deferral, and it approves
 * showing them as a filter axis on this public Finder. The set is closed at eight; a ninth needs
 * its own approval, not an edit here.
 *
 * An earlier draft of this comment called the source "the ratified taxonomy". That overstated it:
 * `taxonomy-mapping.ts` calls the same list PROPOSED. Cite ADR-020, never an import approval, when
 * this vocabulary's authority is in question — PRODUCT-DATA-2C-A ratified 100 catalog IDENTITIES
 * and PRODUCT-DATA-2C-B2B approved RUNNING the import, and the reviewed records show no closure of
 * ADR-008's deferral, which is not the same as showing that no approval was ever given.
 *
 * ADR-020 approves nothing beyond that: no translation of any name or slug, no technical claim, no
 * new or changed per-product assignment, no Product Type page or endpoint, and no certification
 * that this control has passed technical or accessibility review. Product Type is also a
 * **separate axis**: it does not replace or rename the six Product Families, and the fact that
 * `lubricant-additives` and `antifreeze-coolants` name a Family and a Product Type alike is a
 * coincidence of vocabulary, never a merge.
 *
 * ── Why this exists, and why it did not before ──────────────────────────────
 *
 * `segments-data.ts` — the sibling registry for the other axis — carried a note saying a Product
 * Type control would be "a UI for a vocabulary that does not exist", because at the time
 * `product_types` held zero rows and every non-blank `?productType=` answered 400. **All three
 * halves of that are now out of date**, measured on 31 August 2026:
 *
 * | Claim                              | Measured                                        |
 * | ---------------------------------- | ----------------------------------------------- |
 * | `product_types` holds zero rows    | **8 rows**                                      |
 * | every `?productType=` answers 400  | `?productType=engine-oils` → **200, 33 of 100** |
 * | nothing carries a type             | **100 of 100 products** carry `product_type_id` |
 *
 * That coverage is the point. The Segment axis reaches **41** of the 100 products, because
 * `proposeSegments` derives only three of the eight approved Segment keys from the workbook's
 * category labels and the other five have no signal to derive from. This axis reaches all 100.
 *
 * ── The same boundary the Segment registry keeps ────────────────────────────
 *
 * There is no `GET /product-types` endpoint — ADR-007's Deferred list names the standalone Segment
 * and Product Type endpoints as not implemented, and building one is a backend gate. So the
 * vocabulary is declared here, exactly once, and everything else is the backend's: which products a
 * type selects, whether a slug resolves at all, and what an unresolvable one means. **This file
 * decides nothing except which chips are drawn.**
 *
 * It is replaced the moment that endpoint exists: the fetch lands in `lib/products.ts` beside the
 * list client and this module is deleted, not kept in sync.
 *
 * ── Order ───────────────────────────────────────────────────────────────────
 *
 * Alphabetical by name, which is the order `product_types` returns them in by slug and carries no
 * editorial claim about which type matters more. The Family row above it is in the frozen ADR-009
 * order because that order *is* approved; nothing approves an order for these.
 */

export type ProductTypeOption = {
  /** The `product_types.slug` — the value that goes on the wire as `?productType=`. */
  readonly slug: string;
  /** The `product_types.name`, verbatim. Never re-worded, never abbreviated for the chip. */
  readonly name: string;
};

export const PRODUCT_TYPES: readonly ProductTypeOption[] = [
  { slug: "antifreeze-coolants", name: "Antifreeze Coolants" },
  { slug: "engine-oils", name: "Engine Oils" },
  { slug: "gear-oils", name: "Gear Oils" },
  { slug: "greases", name: "Greases" },
  { slug: "hydraulic-oils", name: "Hydraulic Oils" },
  { slug: "industrial-oils", name: "Industrial Oils" },
  { slug: "lubricant-additives", name: "Lubricant Additives" },
  { slug: "marine-oils", name: "Marine Oils" },
] as const;

/**
 * The approved name for a slug, or `null` for a slug this vocabulary does not contain.
 *
 * `null` rather than the slug itself, and the two are not interchangeable. A `?productType=` value
 * reaches this page as caller-supplied text, and the finder's own rule for the sentence that names
 * the active selection is that an unapproved string is never echoed back as copy — echoing it would
 * put a value nobody approved where an ADR-020 display name belongs, in a locale where even the
 * approved names are unapproved in translation.
 *
 * The signature is `segmentName`'s, deliberately: the two axes are separate vocabularies, but a
 * caller that has to remember which one falls back to the raw slug is a caller that will get it
 * wrong. Whether an unrecognised slug is a real Product Type stays the API's answer — the request
 * is sent either way, and a 400 naming the field is surfaced as its own result state.
 */
export function productTypeName(slug: string): string | null {
  return PRODUCT_TYPES.find((type) => type.slug === slug)?.name ?? null;
}
