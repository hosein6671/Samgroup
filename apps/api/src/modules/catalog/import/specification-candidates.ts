/**
 * The line between a SourceFact and a Specification, and the database shape that decides it.
 *
 * ── Two different things that were being counted as one ─────────────────────
 *
 * Every technical observation this importer extracts becomes a `source_facts` row: verbatim,
 * immutable, evidence. That is unconditional — a reading whose property nobody has mapped is
 * still a reading, and losing it would lose the only record of what the document printed.
 *
 * A `specifications` row is a different claim. It says: this product has THIS controlled
 * property, with THIS value, in THIS shape. It can only be made when the property resolves to
 * an approved dictionary entry AND the printed value can be read into the shape the database
 * enforces. Reporting all 1,528 technical facts as planned Specifications, while also
 * reporting that 31 raw labels have no approved mapping, states both at once.
 *
 * ── What a withheld fact does and does not do ───────────────────────────────
 *
 * A withheld fact keeps its raw property, value, unit, method, qualifier and grade label; it
 * produces a review conflict; it produces NO `specifications` row; and it never causes a
 * `spec_properties` entry to be invented. `resolveProperty` can only return a key that is
 * already seeded, so there is no code path that could.
 *
 * ── Why the CHECK constraints are simulated here ────────────────────────────
 *
 * `specifications_value_shape` and `specifications_normalized_complete` are the real gate. An
 * importer that plans a row PostgreSQL would reject has not planned anything — it has planned
 * a failure at apply time, when the workbook is no longer in front of anyone. Simulating both
 * CHECKs, plus the `numeric(20,6)` domain of the four numeric columns, is what makes "1,046
 * valid Specification candidates" a statement about the database rather than about hope.
 */

import { SpecValueType } from "../../../prisma/generated/enums";

/** Why a technical fact produced no Specification row. Every one is reported. */
export type WithholdReason =
  | "PROPERTY_UNKNOWN"
  | "PROPERTY_MAPPING_NOT_APPROVED"
  | "PROPERTY_ELEMENT_CONTENT"
  | "VALUE_SHAPE_UNREADABLE"
  | "VALUE_SHAPE_REJECTED_BY_DATABASE"
  | "DISPLAY_VALUE_EMPTY";

/** The columns `specifications_value_shape` and `_normalized_complete` actually look at. */
export interface SpecificationShape {
  readonly propertyKey: string | null;
  readonly displayValue: string;
  readonly valueType: SpecValueType | null;
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly pairFirst: string | null;
  readonly pairSecond: string | null;
}

export interface ShapeVerdict {
  readonly valid: boolean;
  /** One line per violated constraint, naming the constraint by its database name. */
  readonly violations: readonly string[];
}

/** `numeric(20, 6)`: at most 20 significant digits, at most 6 of them after the point. */
const DECIMAL_20_6 = /^[+-]?(\d{1,14})(?:\.(\d{1,6}))?$/;

function decimalViolation(column: string, value: string | null): string | null {
  if (value === null) return null;
  const text = value.trim();
  if (!DECIMAL_20_6.test(text)) {
    return (
      `${column} = "${value}" does not fit numeric(20,6). PostgreSQL would either reject it ` +
      `or round it, and a specification limit that changes on the way in is not a limit.`
    );
  }
  return null;
}

function present(value: string | null): boolean {
  return value !== null;
}

/**
 * Applies the two `specifications` CHECK constraints, and the numeric domain, to a candidate.
 *
 * Written as the same CASE the migration is written as, in the same order, so the two can be
 * read side by side. Every message names the constraint it comes from.
 */
export function validateSpecificationShape(shape: SpecificationShape): ShapeVerdict {
  const violations: string[] = [];

  const min = present(shape.numericMin);
  const max = present(shape.numericMax);
  const first = present(shape.pairFirst);
  const second = present(shape.pairSecond);

  const requireShape = (ok: boolean, expected: string): void => {
    if (!ok) {
      violations.push(
        `specifications_value_shape: value_type = ${String(shape.valueType)} requires ${expected}, ` +
          `and this row has numeric_min=${String(shape.numericMin)}, ` +
          `numeric_max=${String(shape.numericMax)}, pair_first=${String(shape.pairFirst)}, ` +
          `pair_second=${String(shape.pairSecond)}.`,
      );
    }
  };

  switch (shape.valueType) {
    case SpecValueType.POINT:
      requireShape(min && !max && !first && !second, "numeric_min only");
      break;
    case SpecValueType.MINIMUM:
      requireShape(min && !max && !first && !second, "numeric_min only");
      break;
    case SpecValueType.MAXIMUM:
      requireShape(max && !min && !first && !second, "numeric_max only");
      break;
    case SpecValueType.RANGE:
      requireShape(min && max && !first && !second, "numeric_min and numeric_max");
      if (min && max && Number(shape.numericMin) > Number(shape.numericMax)) {
        violations.push(
          `specifications_value_shape: value_type = RANGE requires numeric_min <= numeric_max, ` +
            `and "${String(shape.numericMin)}" > "${String(shape.numericMax)}".`,
        );
      }
      break;
    case SpecValueType.PAIR:
      requireShape(first && second && !min && !max, "pair_first and pair_second");
      break;
    default:
      // TEXT, REPORT_ONLY, CODE and NULL all land in the migration's ELSE branch.
      requireShape(!min && !max && !first && !second, "all four numeric columns empty");
      break;
  }

  for (const [column, value] of [
    ["numeric_min", shape.numericMin],
    ["numeric_max", shape.numericMax],
    ["pair_first", shape.pairFirst],
    ["pair_second", shape.pairSecond],
  ] as const) {
    const violation = decimalViolation(column, value);
    if (violation !== null) violations.push(violation);
  }

  if (shape.valueType !== null) {
    if (shape.propertyKey === null) {
      violations.push(
        `specifications_normalized_complete: a row with a value_type must name a dictionary ` +
          `property, and property_key is NULL.`,
      );
    }
    if (shape.displayValue.trim().length === 0) {
      violations.push(
        `specifications_normalized_complete: a row with a value_type must carry a non-blank ` +
          `display_value.`,
      );
    }
  }

  return { valid: violations.length === 0, violations };
}

/** A candidate that will become a `specifications` row, with the shape already checked. */
export interface SpecificationCandidateDecision {
  readonly emit: boolean;
  readonly withholdReason: WithholdReason | null;
  readonly detail: string | null;
  readonly violations: readonly string[];
}

export interface CandidateInput {
  /** What `resolveProperty` said about the raw label. */
  readonly propertyOutcome: "resolved" | "mapping-not-approved" | "element-content" | "unknown";
  readonly propertyKey: string | null;
  readonly displayValue: string;
  readonly valueType: SpecValueType | null;
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly pairFirst: string | null;
  readonly pairSecond: string | null;
  /** True when `normalizeValue` refused the printed text — a slash decimal, an inverted range. */
  readonly valueUnreadable: boolean;
}

/**
 * Decides whether one technical fact may become a Specification.
 *
 * The order is deliberate: the property gate first, because a value normalized under an
 * uncontrolled key is not normalized; then the value gate; then the database.
 */
export function decideSpecificationCandidate(
  input: CandidateInput,
): SpecificationCandidateDecision {
  if (input.propertyOutcome === "unknown") {
    return {
      emit: false,
      withholdReason: "PROPERTY_UNKNOWN",
      detail:
        "No approved mapping exists for this source label. The reading is kept as an " +
        "immutable SourceFact; no Specification row and no SpecProperty is created.",
      violations: [],
    };
  }
  if (input.propertyOutcome === "mapping-not-approved") {
    return {
      emit: false,
      withholdReason: "PROPERTY_MAPPING_NOT_APPROVED",
      detail:
        "The mapping for this label is proposed but not approved. It lives in " +
        "spec_property_mappings and resolves to no propertyKey until a human agrees with it.",
      violations: [],
    };
  }
  if (input.propertyOutcome === "element-content") {
    return {
      emit: false,
      withholdReason: "PROPERTY_ELEMENT_CONTENT",
      detail:
        "Elemental content is modelled as element plus unit, which the current dictionary " +
        "does not express. Recorded as a SourceFact only.",
      violations: [],
    };
  }
  if (input.propertyKey === null) {
    return {
      emit: false,
      withholdReason: "PROPERTY_UNKNOWN",
      detail: "The property resolved without a dictionary key, which is not a resolution.",
      violations: [],
    };
  }
  if (input.valueUnreadable) {
    return {
      emit: false,
      withholdReason: "VALUE_SHAPE_UNREADABLE",
      detail:
        "The printed value could not be read into a normalized shape without inventing it. " +
        "Kept verbatim as a SourceFact and left for a per-value technical decision.",
      violations: [],
    };
  }
  if (input.displayValue.trim().length === 0) {
    return {
      emit: false,
      withholdReason: "DISPLAY_VALUE_EMPTY",
      detail: "The source cell is empty, so there is nothing a reader could be shown.",
      violations: [],
    };
  }

  const verdict = validateSpecificationShape({
    propertyKey: input.propertyKey,
    displayValue: input.displayValue,
    valueType: input.valueType,
    numericMin: input.numericMin,
    numericMax: input.numericMax,
    pairFirst: input.pairFirst,
    pairSecond: input.pairSecond,
  });
  if (!verdict.valid) {
    return {
      emit: false,
      withholdReason: "VALUE_SHAPE_REJECTED_BY_DATABASE",
      detail:
        "The normalized row would violate a specifications CHECK constraint. Withheld rather " +
        "than planned, so the apply gate cannot fail on it later.",
      violations: verdict.violations,
    };
  }

  return { emit: true, withholdReason: null, detail: null, violations: [] };
}
