/**
 * Decides which source labels are Grades, and which grade system each belongs to.
 *
 * ── A Grade is evidenced, never manufactured ────────────────────────────────
 *
 * A Grade exists only where a source explicitly evidences a named product variant that is
 * useful as a selectable technical variant. Three consequences, all of them enforced here:
 *
 *   1. A result column whose header is a RESULT BASIS is not a Grade. Thirty-nine King
 *      Power documents have exactly one result column headed `Average Results`; that names
 *      what the numbers are, not which variant they describe. Those products have NO grades
 *      and their facts hang off the Product.
 *
 *   2. A product with no variant concept has no Grade. The fifteen Addilex additives have
 *      no viscosity grade, no ISO VG and no variant axis at all.
 *
 *   3. A label that merely restates the product name adds nothing, and a performance
 *      CLASSIFICATION is not a viscosity grade. `Quenching` under `quenching oil` and `TC`
 *      under `TWO-Stroke Engine Oil` are both rejected here by name; `TC` becomes a
 *      `CLASSIFICATION_STATED` claim instead. Neither may ever become a row.
 *
 * There is no synthetic or default Grade anywhere in this file, and no code path creates one
 * to make the table shape uniform.
 *
 * ── gradeSystem, and why NULL is a real answer ──────────────────────────────
 *
 * `GradeSystem` has three members — SAE, ISO_VG, NLGI. The sources also use
 * product-specific designations (`ATF-3`, `HSB-T-32 Plus`, `HL 22`, `VB-22`, `KD-32`,
 * `GL5 85W90`) which are none of those. Those classify as NULL, which the schema documents
 * as "not yet safely classified" — a real state, not a gap to fill by inference.
 *
 * ── Entangled labels stay verbatim ──────────────────────────────────────────
 *
 * HSB grade labels frequently carry a performance class AND a viscosity grade in one string:
 * `SM/CF 10W40`, `SG/CD 20W50`, `SF/CC 40`. Splitting them is a technical judgement, not an
 * import rule, so the label is stored exactly as printed and the entanglement is flagged.
 */

import { GradeSystem } from "../../../prisma/generated/enums";

import type { PlanFlag, RawGrade } from "./catalog-import.types";

/**
 * Result-basis headers that must never be read as a grade label. Matched
 * case-insensitively after whitespace collapsing.
 */
const RESULT_BASIS_HEADERS: readonly string[] = [
  "average results",
  "average result",
  "typical values",
  "typical value",
  "results",
  "result",
];

/**
 * Labels rejected as Grades by explicit decision, with the reason. Keyed by the workbook row
 * they appear under, because the same string could legitimately be a grade elsewhere.
 */
export const REJECTED_GRADE_LABELS: ReadonlyMap<number, ReadonlyMap<string, string>> = new Map([
  [
    153,
    new Map([
      [
        "Quenching",
        "The label restates the product name (`quenching oil`) and carries no additional " +
          "information. Not a variant.",
      ],
    ]),
  ],
  [
    219,
    new Map([
      [
        "TC",
        "TC is a two-stroke PERFORMANCE CLASSIFICATION, not a viscosity grade or a variant. " +
          "Recorded as a CLASSIFICATION_STATED claim instead.",
      ],
    ]),
  ],
]);

/** An SAE viscosity grade: `10W-40`, `10W40`, `5W60`, `SAE 40`, `40`, `50`, `30`. */
const SAE_MULTIGRADE = /^(?:sae\s*)?\d{1,2}w[-\s]?\d{1,3}$/i;
const SAE_MONOGRADE = /^(?:sae\s*)?(?:20|30|40|50|60)$/i;
/** A performance class prefix followed by an SAE grade: `SM/CF 10W40`, `CJ4 15W40`, `SG 20W50`. */
const CLASS_PLUS_SAE = /^[a-z]{1,3}[0-9]?(?:\/[a-z]{1,3}[0-9]?)?\s+\d{1,2}w[-\s]?\d{1,3}$/i;
const CLASS_PLUS_SAE_MONO = /^[a-z]{1,3}[0-9]?(?:\/[a-z]{1,3}[0-9]?)?\s+(?:20|30|40|50|60)$/i;

const ISO_VG = /^iso\s*vg\s*(\d{1,4})$/i;
const NLGI = /^nlgi\s*\d(?:\.\d)?$/i;

/**
 * The ISO 3448 viscosity grade series. A label of the form `ISO VG n` whose n is not in the
 * series is still recorded verbatim, but it is flagged: `ISO VG 11`, `12` and `34` appear in
 * one King Power document and no such standard grades exist.
 */
const ISO_3448_SERIES: ReadonlySet<number> = new Set([
  2, 3, 5, 7, 10, 15, 22, 32, 46, 68, 100, 150, 220, 320, 460, 680, 1000, 1500, 2200, 3200,
]);

/** Returns the ISO VG number when the label is an off-series ISO VG grade, else null. */
export function offSeriesIsoVgNumber(label: string): number | null {
  const match = ISO_VG.exec(label.replace(/\s+/g, " ").trim());
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return ISO_3448_SERIES.has(value) ? null : value;
}

/** Does the label pack a performance class and a viscosity grade into one string? */
export function isEntangledGradeLabel(label: string): boolean {
  const text = label.replace(/\s+/g, " ").trim();
  return CLASS_PLUS_SAE.test(text) || CLASS_PLUS_SAE_MONO.test(text);
}

export function isResultBasisHeader(label: string): boolean {
  return RESULT_BASIS_HEADERS.includes(label.replace(/\s+/g, " ").trim().toLowerCase());
}

/**
 * Classifies a grade label's system. Conservative by construction: anything that is not
 * unmistakably SAE, ISO VG or NLGI returns null rather than being forced into one.
 */
export function classifyGradeSystem(label: string): GradeSystem | null {
  const text = label.replace(/\s+/g, " ").trim();
  if (ISO_VG.test(text)) return GradeSystem.ISO_VG;
  if (NLGI.test(text)) return GradeSystem.NLGI;
  if (SAE_MULTIGRADE.test(text) || SAE_MONOGRADE.test(text)) return GradeSystem.SAE;
  if (CLASS_PLUS_SAE.test(text) || CLASS_PLUS_SAE_MONO.test(text)) return GradeSystem.SAE;
  return null;
}

export interface GradeDecision {
  readonly label: string;
  readonly accepted: boolean;
  readonly gradeSystem: GradeSystem | null;
  readonly sortOrder: number;
  readonly flags: readonly PlanFlag[];
}

/**
 * Decides one product's grade set. Duplicate labels within a product are rejected rather
 * than de-duplicated: `product_grades` is unique on `(product_id, label)`, and two source
 * columns that print the same label are a source or extraction problem a human must see.
 */
export function decideGrades(workbookRow: number, rawGrades: readonly RawGrade[]): GradeDecision[] {
  const rejected = REJECTED_GRADE_LABELS.get(workbookRow);
  const seen = new Map<string, number>();
  const decisions: GradeDecision[] = [];

  for (const raw of rawGrades) {
    const flags: PlanFlag[] = [];
    const label = raw.label;

    if (isResultBasisHeader(label)) {
      decisions.push({
        label,
        accepted: false,
        gradeSystem: null,
        sortOrder: raw.sortOrder,
        flags: [
          {
            code: "GRADE_REJECTED_RESULT_BASIS",
            severity: "info",
            detail: `"${label}" is a result basis, not a variant. No Grade created.`,
          },
        ],
      });
      continue;
    }

    const rejection = rejected?.get(label);
    if (rejection) {
      decisions.push({
        label,
        accepted: false,
        gradeSystem: null,
        sortOrder: raw.sortOrder,
        flags: [{ code: "GRADE_REJECTED_NOT_A_VARIANT", severity: "info", detail: rejection }],
      });
      continue;
    }

    const previous = seen.get(label);
    if (previous !== undefined) {
      decisions.push({
        label,
        accepted: false,
        gradeSystem: null,
        sortOrder: raw.sortOrder,
        flags: [
          {
            code: "GRADE_DUPLICATE_LABEL",
            severity: "conflict",
            detail:
              `Grade label "${label}" appears twice for this product (positions ${previous} ` +
              `and ${raw.sortOrder}). product_grades is unique on (product, label).`,
          },
        ],
      });
      continue;
    }
    seen.set(label, raw.sortOrder);

    const gradeSystem = classifyGradeSystem(label);
    if (gradeSystem === null) {
      flags.push({
        code: "GRADE_SYSTEM_UNCLASSIFIED",
        severity: "review",
        detail:
          `"${label}" is a product-specific designation, not SAE, ISO VG or NLGI. ` +
          `gradeSystem is left NULL rather than forced.`,
      });
    }
    const offSeries = offSeriesIsoVgNumber(label);
    if (offSeries !== null) {
      flags.push({
        code: "GRADE_ISO_VG_OFF_SERIES",
        severity: "review",
        detail:
          `"${label}" is written as an ISO VG grade, but ${offSeries} is not in the ISO 3448 ` +
          `series. Recorded verbatim; the source may be printing something other than an ISO VG.`,
      });
    }
    if (isEntangledGradeLabel(label)) {
      flags.push({
        code: "GRADE_LABEL_ENTANGLED",
        severity: "review",
        detail:
          `"${label}" carries a performance class and a viscosity grade in one string. ` +
          `Stored verbatim; splitting them is a technical decision, not an import rule.`,
      });
    }

    decisions.push({ label, accepted: true, gradeSystem, sortOrder: raw.sortOrder, flags });
  }

  return decisions;
}
