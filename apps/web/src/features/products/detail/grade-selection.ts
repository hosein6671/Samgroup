import type { ProductGradeSummaryResponse, ProductSpecificationResponse } from "@sam-group/types";

/**
 * The Grade/variant selector's whole state machine, kept out of any component so it is testable
 * without rendering anything and reusable between the server page and the template.
 *
 * ── Why a query parameter, and why the label rather than the id ─────────────
 *
 * `?grade=` — not a route segment — because ADR-007/ADR-010 already freeze the canonical URL as
 * flat (`/{locale}/products/{product-slug}`) with Family and Grade as facets, never ancestry; a
 * second dynamic segment here would be exactly the "changed route" this gate is required to
 * justify and report, for a need a query parameter already meets. The value is a slugified
 * LABEL ("sn-150"), not the database id: `ProductGrade.label` is unique per product (the same
 * invariant `@@unique([productId, label])` already enforces), so it is a safe correlation key,
 * and a shareable URL reading `?grade=sn-150` is legible in a way `?grade=3f2e...` is not.
 *
 * ── Never a fallback to another grade's values ───────────────────────────────
 *
 * An unresolved or missing parameter defaults to the FIRST grade in publishing order — never to
 * "whichever grade happens to have data". `specificationsForGrade` then filters strictly to that
 * one grade (plus Product-level facts, which apply regardless of grade); it does not search for
 * a substitute when the active grade has nothing approved. The empty state that follows from an
 * empty filtered array is `ProductSpecifications`'s own existing "Technical data is under
 * review." panel — this module manufactures no second one.
 */

/** A URL-safe, human-legible form of a grade label — "SN 150" → "sn-150". */
export function gradeSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The grade a request names, or the catalog's own first grade when the parameter is absent,
 * unresolved, or names something else on this product. `grades` is assumed already ordered by
 * `ProductGrade.sortOrder` — the API's own contract — so "first" here is "first published".
 */
export function resolveActiveGrade(
  grades: readonly ProductGradeSummaryResponse[],
  requestedSlug: string | null,
): ProductGradeSummaryResponse | null {
  if (grades.length === 0) return null;
  const requested =
    requestedSlug === null
      ? undefined
      : grades.find((grade) => gradeSlug(grade.label) === requestedSlug);
  return requested ?? grades[0] ?? null;
}

/**
 * The specifications relevant to one selected grade: this grade's own rows, plus every
 * Product-level row (`grade: null`), which describes the product as a whole and applies
 * regardless of which grade is selected. Correlated by `grade.label` — the only field
 * `ProductSpecificationResponse.grade` carries — which is safe for exactly the uniqueness
 * reason `gradeSlug`'s own doc comment states.
 *
 * When the product has no grades at all (`activeGrade` is `null`), every specification is
 * already either Product-level or belongs to the product's own unlisted grade-in-name — nothing
 * is filtered, matching today's behaviour for a leaf product exactly.
 */
export function specificationsForGrade(
  specifications: readonly ProductSpecificationResponse[],
  activeGrade: ProductGradeSummaryResponse | null,
): ProductSpecificationResponse[] {
  if (activeGrade === null) return [...specifications];
  return specifications.filter(
    (specification) =>
      specification.grade === null || specification.grade.label === activeGrade.label,
  );
}
