/**
 * The reference vocabulary an apply reconciles before it writes a single Product.
 *
 * ── Three dictionaries, three different rules ───────────────────────────────
 *
 * `ProductType` and `SpecProperty` are approved vocabulary and are inserted whole.
 * `SpecPropertyMapping` is not: it records what a source LABEL was taken to mean, together
 * with how confident that reading is, and the confidence changes what the row is allowed to
 * cause.
 *
 * ── Why MEDIUM and LOW are still written ────────────────────────────────────
 *
 * A mapping the importer was unsure about is exactly the thing a reviewer needs to see. The
 * schema already separates recording from believing: `confidence` says how good the reading
 * is, `review_status` says whether anyone agreed with it, and `resolveProperty` resolves ONLY
 * a HIGH mapping — so a MEDIUM or LOW row can never produce a Specification no matter what is
 * stored. Writing them is therefore safe and is the honest option; dropping them would throw
 * away the record of every uncertain reading the import made.
 *
 * Every mapping is written `SOURCE_RECORDED`. None is ever APPROVED: that is a human decision
 * belonging to the review service (ADR-014 §8), and there is no path here that produces one.
 */

import { MappingConfidence, TechnicalReviewStatus } from "../../../../prisma/generated/enums";

import { SPEC_PROPERTY_MAPPINGS, SPEC_PROPERTY_SEED } from "../spec-property-dictionary";
import { PROPOSED_PRODUCT_TYPE_KEYS } from "../taxonomy-mapping";

import * as ids from "./identities";

/** A ProductType row the apply would reconcile, keyed by its approved slug. */
export interface ProductTypeRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/**
 * The eight approved ProductType keys, with a display name derived from the key rather than
 * invented. No translation is created: translated vocabulary is unapproved (ADR-009 §3).
 */
export function productTypeRows(): readonly ProductTypeRow[] {
  return PROPOSED_PRODUCT_TYPE_KEYS.map((slug) => ({
    id: ids.productTypeId(slug),
    slug,
    name: slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  }));
}

export interface SpecPropertyRow {
  readonly key: string;
  readonly canonicalMeaning: string;
  readonly quantity: string;
  readonly valueKind: string;
  readonly allowedUnits: readonly string[];
  readonly methodRequirement: string;
}

/** The 26 HIGH-confidence dictionary entries. Keyed by `key`, which IS the identity. */
export function specPropertyRows(): readonly SpecPropertyRow[] {
  return SPEC_PROPERTY_SEED.map((property) => ({
    key: property.key,
    canonicalMeaning: property.canonicalMeaning,
    quantity: property.quantity,
    valueKind: property.valueKind,
    allowedUnits: property.allowedUnits,
    methodRequirement: property.methodRequirement,
  }));
}

export interface SpecPropertyMappingRow {
  readonly id: string;
  readonly rawProperty: string;
  readonly rawUnit: string | null;
  readonly specPropertyKey: string | null;
  readonly confidence: MappingConfidence;
  readonly reviewStatus: TechnicalReviewStatus;
  readonly note: string | null;
  /** True only for HIGH mappings that name a seeded key: the only rows that can normalize. */
  readonly maySpecify: boolean;
}

/**
 * All reviewed mappings, with confidence preserved verbatim and review status pinned to
 * `SOURCE_RECORDED`.
 */
export function specPropertyMappingRows(): readonly SpecPropertyMappingRow[] {
  const seeded = new Set(SPEC_PROPERTY_SEED.map((property) => property.key));
  return SPEC_PROPERTY_MAPPINGS.map((mapping) => {
    const rawUnit = mapping.rawUnit === "" ? null : mapping.rawUnit;
    const maySpecify =
      mapping.confidence === MappingConfidence.HIGH &&
      mapping.specPropertyKey !== null &&
      seeded.has(mapping.specPropertyKey);
    return {
      id: ids.specPropertyMappingId(mapping.rawProperty, rawUnit),
      rawProperty: mapping.rawProperty,
      rawUnit,
      specPropertyKey: mapping.specPropertyKey,
      confidence: mapping.confidence,
      // Never APPROVED. Recording a reading is not agreeing with it.
      reviewStatus: TechnicalReviewStatus.SOURCE_RECORDED,
      note: mapping.note ?? null,
      maySpecify,
    };
  });
}

export class ReferenceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceDataError";
  }
}

/**
 * Refuses reference data that would let an uncertain reading become a published fact.
 * Asserted rather than assumed, because "only HIGH normalizes" lives in a different file and
 * a future edit there must not be able to change what this one writes.
 */
export function assertReferenceDataSafe(): void {
  for (const row of specPropertyMappingRows()) {
    if (row.reviewStatus !== TechnicalReviewStatus.SOURCE_RECORDED) {
      throw new ReferenceDataError(`${row.rawProperty}: a mapping is never written APPROVED.`);
    }
    if (row.maySpecify && row.confidence !== MappingConfidence.HIGH) {
      throw new ReferenceDataError(
        `${row.rawProperty}: a ${row.confidence} mapping may never produce a Specification.`,
      );
    }
    if (
      row.specPropertyKey !== null &&
      row.confidence !== MappingConfidence.HIGH &&
      row.maySpecify
    ) {
      throw new ReferenceDataError(`${row.rawProperty}: uncertain mapping marked specifiable.`);
    }
  }
}

/** Counts an apply would reconcile, for the preflight report. */
export function referenceDataCounts(): {
  productTypes: number;
  specProperties: number;
  specPropertyMappings: number;
  highMappings: number;
  deferredMappings: number;
} {
  const mappings = specPropertyMappingRows();
  const high = mappings.filter((row) => row.confidence === MappingConfidence.HIGH).length;
  return {
    productTypes: productTypeRows().length,
    specProperties: specPropertyRows().length,
    specPropertyMappings: mappings.length,
    highMappings: high,
    deferredMappings: mappings.length - high,
  };
}
