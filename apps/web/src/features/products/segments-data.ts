/**
 * The approved Segment vocabulary, as the frontend's filter control needs it.
 *
 * ── READ THIS BEFORE CHANGING A LINE OF IT ──────────────────────────────────
 *
 * This is a **mirror of approved reference data, not a source of it**. Every name, slug and
 * position below is copied verbatim from `prisma/seed-catalog.ts`'s `APPROVED_SEGMENTS`, which is
 * itself the eight persisted Segments ADR-008 §4 approves, in the approved navigation order. No
 * entry here was authored, shortened, re-worded or re-ordered, and none may be: a Segment that
 * exists here and not in `sam_platform` is a filter the API answers 400 for, and a Segment that
 * exists there and not here is a filter no visitor can reach.
 *
 * `Other` is absent, and its absence is the decision rather than an omission — ADR-008 resolves it
 * as vocabulary rather than a persisted row. Nine approved names, eight Segments.
 *
 * ── Why a frontend registry exists at all ───────────────────────────────────
 *
 * Because there is currently no API path to this list, and the honest options were all worse.
 *
 * - **`GET /segments` does not exist.** ADR-007's own Deferred list names the standalone Segment
 *   and Product Type endpoints as not implemented, and building one is a backend gate.
 * - **`GET /products` does not carry a product's Segments.** `PRODUCT_SELECT` is list-only by
 *   decision (ADR-008 made the taxonomy a *filter* on this endpoint, not a *field*), so the set
 *   cannot be derived from the rows the page already has.
 * - **`GET /products/:slug` does carry them**, and reading it once per listed product would be a
 *   request per row to populate a filter bar — an N+1 against a public endpoint, in exchange for
 *   the same eight values.
 *
 * So the vocabulary is declared here, exactly once, and everything else about the filter is the
 * backend's: which products a Segment selects, whether a slug resolves at all, and what an
 * unresolvable one means (400 VALIDATION_ERROR, surfaced as its own state). This file decides
 * nothing except which chips are drawn.
 *
 * **The same pattern is already load-bearing one level up.** `products-data.ts` mirrors the six
 * approved Categories, including their canonical slugs, and merges the API's `name` over it when
 * the API answers. This is that arrangement for the second axis, minus the merge — there is no
 * endpoint to merge from.
 *
 * **It replaces this file the moment a Segment endpoint exists.** At that point the fetch lands in
 * `lib/products.ts` beside the list client and this module is deleted, not kept in sync.
 *
 * ── What is NOT here ────────────────────────────────────────────────────────
 *
 * **No Product Type — it has its own registry now.** This note used to read "No ProductType name or
 * slug is approved (ADR-008), `product_types` holds zero rows, and every non-blank `?productType=`
 * answers 400", and every clause of it is out of date: ADR-020 approved the eight slugs and display
 * names on 31 August 2026, the table holds those eight rows, and the endpoint filters on them. The
 * vocabulary lives in `product-types-data.ts`, a sibling of this file rather than a section of it,
 * because the two are separate axes over Product (ADR-020 §3) and merging their registries would be
 * the first step towards deriving one from the other — which ADR-008 forbids and ADR-020 restates.
 *
 * **No per-family Segment lists.** ADR-007 leaves the per-Segment Product Type lists open and
 * nothing approves a Family→Segment mapping, so every family offers every Segment and the backend
 * decides what each one returns. A family/segment pair with no products is a real, reachable state
 * and is rendered as one.
 *
 * **No translated names.** `content_translations` holds no Segment row, so `fa`/`ar` would fall
 * back to these same strings even if they were fetched. Localizing this list is the gate that
 * approves `fa`/`ar` catalog vocabulary.
 */

export type ProductSegment = {
  /** The approved `Segment.slug` — the exact value sent as `?segment=`. */
  readonly slug: string;
  /** The approved `Segment.name`, verbatim. */
  readonly name: string;
};

/** The eight persisted Segments of ADR-008 §4, in `Segment.sortOrder` order. */
export const SEGMENTS: readonly ProductSegment[] = [
  { slug: "passenger-cars", name: "Passenger Cars" },
  { slug: "trucks-buses", name: "Trucks and Buses" },
  { slug: "construction-mining", name: "Construction and Mining" },
  { slug: "agriculture", name: "Agriculture" },
  { slug: "gardening", name: "Gardening" },
  { slug: "motorcycle-atv", name: "Motorcycle & ATV" },
  { slug: "industry", name: "Industry" },
  { slug: "marine", name: "Marine" },
];

/**
 * The approved name for a slug, or `null` for a slug this vocabulary does not contain.
 *
 * `null` is not an error here and must not be treated as one. A hand-typed `?segment=` reaches the
 * page as caller-supplied text; whether it names a real Segment is the API's answer, not this
 * module's, and the page sends it either way. This exists so an ACTIVE filter can be labelled with
 * the approved name rather than with the raw query string.
 */
export function segmentName(slug: string): string | null {
  return SEGMENTS.find((segment) => segment.slug === slug)?.name ?? null;
}
