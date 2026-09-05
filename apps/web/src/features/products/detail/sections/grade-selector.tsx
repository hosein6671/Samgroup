import type { ReactNode } from "react";

import { gradeSlug } from "../grade-selection";

import type { ProductGradeSummaryResponse } from "@sam-group/types";

/**
 * The Grade/variant selector — item 7 of the owner's required Product Detail section order,
 * rendered only when the product has two or more `ProductGrade` children (a single grade has
 * nothing to select between, and a leaf product with none renders no selector at all — see
 * `grade-selection.ts`'s own doc comment for why this is a query parameter, not a route change).
 *
 * ── Links, not a widget — the same pattern `CategoryCatalog`'s `SegmentFilter` already uses ────
 *
 * Every tab is a plain `<a>` to this same page with `?grade={slug}`. No client component, no
 * `onClick`, no keydown handler: an anchor is natively focusable with Tab and activatable with
 * Enter, and the browser's own history is the state machine — exactly `SegmentFilter`'s own
 * reasoning, reused rather than re-derived. The active grade carries `aria-current="true"` and
 * `data-active`, matching that component's convention for the same relationship.
 *
 * ── Marking a grade under review, without inventing a value for it ──────────
 *
 * `hasApprovedData: false` renders a small "Under review" note beside that grade's label — never
 * a placeholder value, and never a reason to omit the grade from the list (the owner's own
 * instruction: "expose all public grades clearly ... clearly mark a grade whose data is under
 * review"). Selecting it is what shows `ProductSpecifications`'s existing "Technical data is
 * under review." panel for that grade specifically, via `specificationsForGrade`'s filtering —
 * this component only ever links to a grade; it does not decide what displays once there.
 *
 * A Server Component. No state, no JavaScript.
 */
export function GradeSelector({
  grades,
  activeGrade,
  baseHref,
}: {
  readonly grades: readonly ProductGradeSummaryResponse[];
  readonly activeGrade: ProductGradeSummaryResponse | null;
  /** The product's own canonical path, e.g. `/en/products/base-oil-group-i` — grade links are
   * `${baseHref}?grade={slug}`, never a second route segment (ADR-007 §4 / ADR-010 §2). */
  readonly baseHref: string;
}): ReactNode {
  if (grades.length < 2) return null;

  return (
    <nav className="pd-grade-selector" aria-label="Select a grade">
      <p className="pd-grade-selector-label">Grade</p>
      <ul className="pd-grade-list">
        {grades.map((grade) => {
          const isActive = activeGrade?.id === grade.id;
          return (
            <li key={grade.id}>
              <a
                className="pd-grade-chip"
                href={`${baseHref}?grade=${gradeSlug(grade.label)}`}
                data-active={isActive ? "true" : undefined}
                aria-current={isActive ? "true" : undefined}
              >
                {grade.label}
                {!grade.hasApprovedData && <span className="pd-grade-pending">Under review</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
