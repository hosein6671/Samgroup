/**
 * Turns a printed value into the normalized shape `specifications` stores, without ever
 * discarding what was printed.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 * `displayValue` is the source's own text. The numeric columns are a SEPARATE, additional
 * reading of it, produced only when the text can be read numerically with no judgement. The
 * two are never expected to be derivable from one another, and when parsing fails the
 * numerics are left null rather than guessed — a specification limit that changed shape on
 * the way in is not a limit.
 *
 * ── What is deliberately NOT converted ──────────────────────────────────────
 *
 * The HSB catalogue prints a solidus where a decimal point belongs — `23/6` for 23.6 cSt,
 * `5/1` for 5.1 — the Persian decimal-separator convention. Every one of those is
 * PLAUSIBLE and none is EVIDENCED, so this module refuses them: `23/6` parses to no number,
 * is flagged `SOURCE_SLASH_DECIMAL`, and waits for a per-value technical decision. An
 * importer that read it as a fraction, a date or a ratio would corrupt the catalogue
 * silently, and one that "obviously" read it as 23.6 would be inventing the value.
 *
 * Copper-strip results (`1a`) and foaming pairs (`5/0`) are also slash-bearing and are NOT
 * the same case. `1a` is a CODE, recognisable by shape alone. `5/0` is a coupled PAIR — and
 * crucially it is NOT distinguishable from `23/6` by shape, so the caller must say whether
 * a pair is expected. That comes from the PROPERTY: ASTM D892 defines a foaming result as a
 * tendency/stability pair, and nothing else in these sources does. A value-shape heuristic
 * would have read `23/6` as a pair and buried the very defect this module exists to surface.
 *
 * ── g/cm³ vs kg/m³ ──────────────────────────────────────────────────────────
 *
 * Both appear for density and they differ by a factor of 1000. Nothing here converts
 * between them. The unit is stored as printed and comparison across the two is a review
 * decision, not an import one.
 */

import { SpecValueType } from "../../../prisma/generated/enums";

import type { PlanFlag } from "./catalog-import.types";

/** Values whose printed text states the property is reported rather than limited. */
const REPORT_ONLY_TEXT = new Set(["report", "reported", "report only", "to report"]);

/** ASTM D130 / D4048 copper-strip classification codes. */
const CORROSION_CODE = /^[1-4][a-d]$/i;

/** A foaming or corrosion tendency/stability pair: two integers coupled by a solidus. */
const PAIR_VALUE = /^(\d+)\s*\/\s*(\d+)$/;

/** A slash between digits where at least one side is not a whole small integer pair. */
const SLASH_DECIMAL = /^-?\d+\s*\/\s*\d+$/;

const PLAIN_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** `900-933`, `12.0-18.0`, `265-295`, and the spaced `1050 -1100` the sources also print. */
const RANGE_VALUE = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*[-–—]\s*([+-]?(?:\d+\.?\d*|\.\d+))$/;

/** `≥180`, `Min 170`, `> 1`, `0.45 min`, and their maximum counterparts. */
const MIN_PREFIX = /^(?:≥|>=|>|min\.?|not less than)\s*([+-]?(?:\d+\.?\d*|\.\d+))$/i;
const MIN_SUFFIX = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(?:min\.?)$/i;
const MAX_PREFIX = /^(?:≤|<=|<|max\.?|no more than|not more than)\s*([+-]?(?:\d+\.?\d*|\.\d+))$/i;
const MAX_SUFFIX = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(?:max\.?)$/i;

export interface NormalizedValue {
  readonly valueType: SpecValueType;
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly pairFirst: string | null;
  readonly pairSecond: string | null;
  readonly flags: readonly PlanFlag[];
}

export interface NormalizeOptions {
  /**
   * Whether the PROPERTY this value belongs to is one whose method reports a coupled pair.
   * Defaults to false, so an unrecognised property can never turn `23/6` into a pair.
   */
  readonly allowPair?: boolean;
}

/**
 * Normalizes a printed value.
 *
 * A negative range is genuinely ambiguous in these sources — `-30--24` cannot be told from
 * a single negative number followed by noise — so only unambiguous forms are read, and the
 * order of the tests below is the order of decreasing certainty.
 */
export function normalizeValue(rawValue: string, options: NormalizeOptions = {}): NormalizedValue {
  const text = rawValue.replace(/\s+/g, " ").trim();
  const none: NormalizedValue = {
    valueType: SpecValueType.TEXT,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    flags: [],
  };

  if (text.length === 0) return none;

  if (REPORT_ONLY_TEXT.has(text.toLowerCase())) {
    return { ...none, valueType: SpecValueType.REPORT_ONLY };
  }

  if (CORROSION_CODE.test(text)) {
    return { ...none, valueType: SpecValueType.CODE };
  }

  const pair = PAIR_VALUE.exec(text);
  if (options.allowPair === true && pair?.[1] !== undefined && pair[2] !== undefined) {
    return {
      valueType: SpecValueType.PAIR,
      numericMin: null,
      numericMax: null,
      pairFirst: pair[1],
      pairSecond: pair[2],
      flags: [],
    };
  }

  if (PLAIN_NUMBER.test(text)) {
    return { ...none, valueType: SpecValueType.POINT, numericMin: text };
  }

  const range = RANGE_VALUE.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (low <= high) {
      return {
        valueType: SpecValueType.RANGE,
        numericMin: range[1],
        numericMax: range[2],
        pairFirst: null,
        pairSecond: null,
        flags: [],
      };
    }
    return {
      ...none,
      flags: [
        {
          code: "SOURCE_RANGE_INVERTED",
          severity: "conflict",
          detail: `Printed range "${text}" has a lower bound above its upper bound.`,
        },
      ],
    };
  }

  const minimum = MIN_PREFIX.exec(text)?.[1] ?? MIN_SUFFIX.exec(text)?.[1];
  if (minimum !== undefined) {
    return { ...none, valueType: SpecValueType.MINIMUM, numericMin: minimum };
  }

  const maximum = MAX_PREFIX.exec(text)?.[1] ?? MAX_SUFFIX.exec(text)?.[1];
  if (maximum !== undefined) {
    return { ...none, valueType: SpecValueType.MAXIMUM, numericMax: maximum };
  }

  if (SLASH_DECIMAL.test(text)) {
    return {
      ...none,
      flags: [
        {
          code: "SOURCE_SLASH_DECIMAL",
          severity: "conflict",
          detail:
            `"${text}" uses a solidus where a decimal point belongs (Persian convention). ` +
            `Not converted: the value is plausible but not evidenced. Needs per-value sign-off.`,
        },
      ],
    };
  }

  return { ...none, flags: [] };
}

/**
 * Classifies what the source said about the unit. `DIMENSIONLESS` is asserted only from the
 * dictionary — a blank unit cell on a property that normally carries one is `ABSENT`, which
 * is a different and reviewable fact.
 */
export function classifyUnit(
  rawUnit: string,
  allowedUnits: readonly string[] | null,
): "STATED" | "ABSENT" | "DIMENSIONLESS" | "UNRECOGNIZED" {
  const unit = rawUnit.trim();
  if (unit.length === 0) {
    if (allowedUnits !== null && allowedUnits.length === 0) return "DIMENSIONLESS";
    return "ABSENT";
  }
  if (allowedUnits === null) return "STATED";
  if (allowedUnits.length === 0) return "UNRECOGNIZED";
  return allowedUnits.includes(unit) ? "STATED" : "UNRECOGNIZED";
}
