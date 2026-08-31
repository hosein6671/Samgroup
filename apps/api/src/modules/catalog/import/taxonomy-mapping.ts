/**
 * Maps each authoritative row onto the frozen Product Family set, a proposed ProductType,
 * and proposed Segment memberships.
 *
 * ── What is frozen and what is proposed ─────────────────────────────────────
 *
 * The six Product Family keys are frozen (ADR-007) and this file never adds to them.
 * `Base Oils` stays a public family with ZERO imported products: no workbook row cites a
 * base-oil source, and inventing one to fill the family would be fabrication.
 *
 * ProductTypes are PROPOSALS **at this stage of the pipeline**, and that is what
 * `PROPOSED_PRODUCT_TYPE_KEYS` still means here: this planner proposes a type per row and
 * persists nothing. Read the name as "what the planner proposes", not as "unapproved".
 *
 * ── The vocabulary itself is approved; the planner's stage name is not ──────
 *
 * The eight keys below were APPROVED AS VOCABULARY on 31 August 2026 by ADR-020, together
 * with their display names, closing ADR-008's "Product Type names and slugs — not one is
 * approved" deferral. The constant keeps its name deliberately: renaming an export is a code
 * change with no decision behind it, and the name is now part of the record of how the
 * vocabulary arrived. Cite ADR-020 for this vocabulary's authority rather than an import
 * approval: the reviewed records for PRODUCT-DATA-2C-A (identities) and PRODUCT-DATA-2C-B2B
 * (running the import) each record something else, and whether an earlier conversation also
 * approved these names is neither asserted nor denied there.
 *
 * The sentence here previously read "No `product_types` row exists yet". That was true when
 * written on 23 August 2026 and stopped being true when the ratified import ran; the second
 * half — that this gate persists none — is unchanged and still correct.
 *
 * There is deliberately no `Others` ProductType — the workbook's
 * `سایر محصولات Others products` block is a filing convenience, not a product class, and it
 * decomposes on row-level evidence into antifreeze/coolants and greases. ADR-020 closes the
 * set at eight, so a ninth type needs its own approval rather than an edit here.
 *
 * ── The one mapping that cannot be a table ──────────────────────────────────
 *
 * Gear oils have no single family. Automotive transmission and axle duty belongs to the
 * automotive family, industrial gear duty to the industrial family, and marine-specific
 * gear duty to the marine family — so each gear row is decided on its own evidence, and a
 * row whose evidence disagrees with itself becomes a CONFLICT rather than a guess.
 *
 * Five rows do exactly that. The workbook files `ATF Grade`, `GL-5 Grade`, `GL-4 Grade`,
 * `GL-3 Grade` and `GL-I Grade` under `روغن های دریایی Marine Oils`, while the HSB
 * catalogue prints them in its Gear section with no marine qualifier and their designations
 * (API GL-x, ATF) are automotive gear and transmission classes. Excel's category membership
 * is authoritative as PROVENANCE and is preserved untouched; the family it implies is
 * contradicted by the source document and by the designations, so the family is not
 * decided here.
 */

import type { WorkbookProductRow } from "./catalog-import.types";

/** The six frozen Product Family keys — the default-locale `Category.slug` (ADR-009). */
export const PRODUCT_FAMILY_KEYS = [
  "base-oils",
  "lubricant-additives",
  "engine-oils-automotive-lubricants",
  "industrial-oils-lubricants",
  "marine-oils-lubricants",
  "antifreeze-coolants",
] as const;

export type ProductFamilyKey = (typeof PRODUCT_FAMILY_KEYS)[number];

/**
 * The eight ProductType keys the planner proposes per row — and, since ADR-020 (31 August
 * 2026), the approved vocabulary itself. `apply/reference-data.ts` reads this same constant
 * to build the `product_types` rows, and its display names are ADR-020's approved names.
 * No `others`, by decision, and the set is closed at eight.
 */
export const PROPOSED_PRODUCT_TYPE_KEYS = [
  "engine-oils",
  "industrial-oils",
  "lubricant-additives",
  "gear-oils",
  "marine-oils",
  "hydraulic-oils",
  "antifreeze-coolants",
  "greases",
] as const;

export type ProductTypeKey = (typeof PROPOSED_PRODUCT_TYPE_KEYS)[number];

/** The eight approved, persisted Segment slugs (ADR-008). */
export const SEGMENT_KEYS = [
  "passenger-cars",
  "trucks-buses",
  "construction-mining",
  "agriculture",
  "gardening",
  "motorcycle-atv",
  "industry",
  "marine",
] as const;

export type SegmentKey = (typeof SEGMENT_KEYS)[number];

// The workbook's category block labels, verbatim, after whitespace collapsing.
const CATEGORY_ENGINE_OIL = "روغن موتور Engine oil";
const CATEGORY_INDUSTRIAL = "روغن های صنعتی Industrial Oils";
const CATEGORY_GEAR = "روغن های دنده Gear oils";
const CATEGORY_HYDRAULIC = "روغن های سیستم هیدرولیک Hydraulic oils";
const CATEGORY_MARINE = "روغن های دریایی Marine Oils";
const CATEGORY_ADDITIVES = "افرودنی ها Additives";
const CATEGORY_OTHERS = "سایر محصولات Others products";

const KNOWN_CATEGORIES: readonly string[] = [
  CATEGORY_ENGINE_OIL,
  CATEGORY_INDUSTRIAL,
  CATEGORY_GEAR,
  CATEGORY_HYDRAULIC,
  CATEGORY_MARINE,
  CATEGORY_ADDITIVES,
  CATEGORY_OTHERS,
];

// `نوع محصول` values, verbatim.
const TYPE_ANTIFREEZE = "ضد یخ";
const TYPE_GREASE = "گریس";
const TYPE_MOTORCYCLE = "روغن موتور سیکلت";
const TYPE_MANUAL_TRANSMISSION = "دنده دستی";
const TYPE_AUTOMATIC = "اتوماتیک";

/**
 * The five rows whose family the EVIDENCE cannot decide. Listed explicitly rather than
 * pattern-matched: a conflict set that grows silently because a regular expression matched
 * something new is a conflict set nobody reviews.
 *
 * The evidence still conflicts — that is why the owner had to decide. These row numbers are
 * the ratification-time position of the five, kept so a workbook that carries no identifier
 * column can still be mapped; `RATIFIED_MARINE_GEAR_DECISIONS` is the authority once one does.
 */
export const GEAR_FAMILY_CONFLICT_ROWS: readonly number[] = [234, 237, 240, 243, 246];

/**
 * One reviewed decision: which family an evidence-conflicted row belongs to, and on whose
 * authority.
 */
export interface RatifiedFamilyDecision {
  readonly sourceRef: string;
  /** The row's position when the decision was made. Evidence, never identity (ADR-011). */
  readonly ratifiedAtRow: number;
  /** The exact public name when the decision was made, so a rename is visible in review. */
  readonly ratifiedName: string;
  readonly productFamilyKey: ProductFamilyKey;
  readonly productTypeKey: ProductTypeKey;
}

/**
 * The owner's ratified resolution of the five Marine/Gear rows (PRODUCT-DATA-2C-A).
 *
 * ── What was decided, and by whom ───────────────────────────────────────────
 *
 * The evidence genuinely conflicts and still does: Excel files these five under
 * `روغن های دریایی Marine Oils`, while the HSB catalogue prints them in its GEAR section
 * with no marine qualifier, and their designations (API GL-5/GL-4/GL-3/GL-I, ATF) are
 * automotive gear and transmission classes. Nothing in the technical sources proves marine
 * duty, and this table does not claim otherwise.
 *
 * The owner selected the authoritative Excel category as the governing authority for the
 * PUBLIC Product Family. That is an OWNER DECISION about publication, not a technical
 * finding — so the family below is authority-derived, and the contradicting Gear evidence is
 * preserved in `basis` rather than dropped, because a decision that hides what it overruled
 * cannot be re-reviewed.
 *
 * ── Keyed by sourceRef, on purpose ──────────────────────────────────────────
 *
 * Keyed by RATIFIED sourceRef, not by row number and not by name. Row position moves the
 * moment anyone inserts a row, and `GL-x Grade` is a name shape the workbook could
 * legitimately reuse. Once the master workbook declares its references, a row that moves
 * carries this decision with it. The row numbers remain only as the fallback for a workbook
 * with no identifier column, and as the evidence of where each row sat when it was decided.
 */
export const RATIFIED_MARINE_GEAR_DECISIONS: readonly RatifiedFamilyDecision[] = [
  {
    sourceRef: "SAMCAT-W1-R234",
    ratifiedAtRow: 234,
    ratifiedName: "ATF Grade",
    productFamilyKey: "marine-oils-lubricants",
    productTypeKey: "gear-oils",
  },
  {
    sourceRef: "SAMCAT-W1-R237",
    ratifiedAtRow: 237,
    ratifiedName: "GL-5 Grade",
    productFamilyKey: "marine-oils-lubricants",
    productTypeKey: "gear-oils",
  },
  {
    sourceRef: "SAMCAT-W1-R240",
    ratifiedAtRow: 240,
    ratifiedName: "GL-4 Grade",
    productFamilyKey: "marine-oils-lubricants",
    productTypeKey: "gear-oils",
  },
  {
    sourceRef: "SAMCAT-W1-R243",
    ratifiedAtRow: 243,
    ratifiedName: "GL-3 Grade",
    productFamilyKey: "marine-oils-lubricants",
    productTypeKey: "gear-oils",
  },
  {
    sourceRef: "SAMCAT-W1-R246",
    ratifiedAtRow: 246,
    ratifiedName: "GL-I Grade",
    productFamilyKey: "marine-oils-lubricants",
    productTypeKey: "gear-oils",
  },
];

const DECISIONS_BY_SOURCE_REF = new Map(
  RATIFIED_MARINE_GEAR_DECISIONS.map((decision) => [decision.sourceRef, decision]),
);
const DECISIONS_BY_RATIFIED_ROW = new Map(
  RATIFIED_MARINE_GEAR_DECISIONS.map((decision) => [decision.ratifiedAtRow, decision]),
);

/**
 * Finds the reviewed decision for a row. The declared `sourceRef` wins whenever the workbook
 * carries one, because that is the only identifier that survives a re-sort; the
 * ratification-time row number is consulted only when it does not.
 */
export function ratifiedFamilyDecisionFor(
  row: WorkbookProductRow,
  sourceRef?: string,
): RatifiedFamilyDecision | null {
  if (sourceRef !== undefined) return DECISIONS_BY_SOURCE_REF.get(sourceRef) ?? null;
  return DECISIONS_BY_RATIFIED_ROW.get(row.rowNumber) ?? null;
}

export interface TaxonomyProposal {
  readonly productFamilyKey: ProductFamilyKey | null;
  readonly productTypeKey: ProductTypeKey | null;
  readonly segmentKeys: readonly SegmentKey[];
  readonly categoryRecognised: boolean;
  readonly conflict: string | null;
  /** Why the family came out the way it did, for the manifest's reviewer. */
  readonly basis: string;
}

/**
 * Decomposes the `Others` block. Antifreeze and grease are the only two values `نوع محصول`
 * takes there, and both are explicit — nothing is inferred from the product name.
 */
function mapOthers(row: WorkbookProductRow): TaxonomyProposal | null {
  if (row.productTypeLabel === TYPE_ANTIFREEZE) {
    return {
      productFamilyKey: "antifreeze-coolants",
      productTypeKey: "antifreeze-coolants",
      segmentKeys: [],
      categoryRecognised: true,
      conflict: null,
      basis: `Others decomposed by نوع محصول "${TYPE_ANTIFREEZE}" (antifreeze/coolant).`,
    };
  }
  if (row.productTypeLabel === TYPE_GREASE) {
    return {
      productFamilyKey: "industrial-oils-lubricants",
      productTypeKey: "greases",
      segmentKeys: ["industry"],
      categoryRecognised: true,
      conflict: null,
      basis: `Others decomposed by نوع محصول "${TYPE_GREASE}" (grease).`,
    };
  }
  return null;
}

/**
 * Segment proposals, and the discipline applied to them.
 *
 * Only DIRECT source evidence produces a proposal:
 *   - `روغن موتور سیکلت` states motorcycle duty -> `motorcycle-atv`
 *   - the Industrial and Hydraulic category blocks state industrial duty -> `industry`
 *   - the Marine category block states marine duty -> `marine`
 *
 * `بنزینی` (gasoline) and `دیزلی` (diesel) describe the FUEL, not the vehicle class, so
 * neither yields `passenger-cars` or `trucks-buses` here. Both are plausible and neither is
 * evidenced by the workbook, and a Segment is a buyer-facing navigation claim: a wrong one
 * puts a heavy-duty diesel oil in front of a car owner. They are left to review.
 */
function proposeSegments(row: WorkbookProductRow): SegmentKey[] {
  const segments: SegmentKey[] = [];
  if (row.productTypeLabel === TYPE_MOTORCYCLE) segments.push("motorcycle-atv");
  if (row.categoryLabel === CATEGORY_INDUSTRIAL || row.categoryLabel === CATEGORY_HYDRAULIC) {
    segments.push("industry");
  }
  if (row.categoryLabel === CATEGORY_MARINE) segments.push("marine");
  return segments;
}

export function mapTaxonomy(row: WorkbookProductRow, sourceRef?: string): TaxonomyProposal {
  const segmentKeys = proposeSegments(row);
  const categoryRecognised = KNOWN_CATEGORIES.includes(row.categoryLabel);

  if (!categoryRecognised) {
    return {
      productFamilyKey: null,
      productTypeKey: null,
      segmentKeys,
      categoryRecognised: false,
      conflict: `Workbook category "${row.categoryLabel}" is not one of the seven known blocks.`,
      basis: "Unrecognised category block; no family or type proposed.",
    };
  }

  switch (row.categoryLabel) {
    case CATEGORY_ENGINE_OIL:
      return {
        productFamilyKey: "engine-oils-automotive-lubricants",
        productTypeKey: "engine-oils",
        segmentKeys,
        categoryRecognised: true,
        conflict: null,
        basis: "Engine oil category maps directly to the automotive family.",
      };

    case CATEGORY_INDUSTRIAL:
      return {
        productFamilyKey: "industrial-oils-lubricants",
        productTypeKey: "industrial-oils",
        segmentKeys,
        categoryRecognised: true,
        conflict: null,
        basis: "Industrial Oils category maps directly to the industrial family.",
      };

    case CATEGORY_HYDRAULIC:
      return {
        productFamilyKey: "industrial-oils-lubricants",
        productTypeKey: "hydraulic-oils",
        segmentKeys,
        categoryRecognised: true,
        conflict: null,
        basis: "Hydraulic oils are an industrial-family product type.",
      };

    case CATEGORY_ADDITIVES:
      return {
        productFamilyKey: "lubricant-additives",
        productTypeKey: "lubricant-additives",
        segmentKeys,
        categoryRecognised: true,
        conflict: null,
        basis: "Additives category maps directly to the additives family.",
      };

    case CATEGORY_GEAR: {
      // Every row in this block is manual-transmission or automatic-transmission duty —
      // automotive driveline, not industrial gearboxes. Row-level, from `نوع محصول`.
      const automotive =
        row.productTypeLabel === TYPE_MANUAL_TRANSMISSION ||
        row.productTypeLabel === TYPE_AUTOMATIC;
      if (automotive) {
        return {
          productFamilyKey: "engine-oils-automotive-lubricants",
          productTypeKey: "gear-oils",
          segmentKeys,
          categoryRecognised: true,
          conflict: null,
          basis:
            `Gear row decided at row level: نوع محصول "${row.productTypeLabel}" states ` +
            `automotive transmission/gear duty.`,
        };
      }
      return {
        productFamilyKey: null,
        productTypeKey: "gear-oils",
        segmentKeys,
        categoryRecognised: true,
        conflict:
          `Gear row states no duty in نوع محصول, so automotive, industrial and marine ` +
          `gear duty cannot be distinguished. Family not guessed.`,
        basis: "Gear row with no duty evidence.",
      };
    }

    case CATEGORY_MARINE: {
      const decision = ratifiedFamilyDecisionFor(row, sourceRef);
      if (decision) {
        return {
          productFamilyKey: decision.productFamilyKey,
          productTypeKey: decision.productTypeKey,
          segmentKeys,
          categoryRecognised: true,
          // Resolved by an owner decision, so it is no longer a conflict — but the evidence
          // it overruled is spelled out here so the audit trail still carries both sides.
          conflict: null,
          basis:
            `OWNER DECISION (${decision.sourceRef}, ratified at row ` +
            `${String(decision.ratifiedAtRow)} as "${decision.ratifiedName}"): the ` +
            `authoritative Excel category "${CATEGORY_MARINE}" governs the public Product ` +
            `Family, giving ${decision.productFamilyKey}. The contradicting evidence stands ` +
            `and is not overturned: the HSB catalogue prints this row in its GEAR section ` +
            `with no marine qualifier, and its designation is an API GL/ATF automotive gear ` +
            `and transmission class, which is why the ProductType is ` +
            `${decision.productTypeKey}. Marine duty is NOT claimed to be proven by the ` +
            `technical sources; the family is set on Excel's authority alone.`,
        };
      }
      if (GEAR_FAMILY_CONFLICT_ROWS.includes(row.rowNumber)) {
        return {
          productFamilyKey: null,
          productTypeKey: "gear-oils",
          segmentKeys,
          categoryRecognised: true,
          conflict:
            `Excel files this row under "${CATEGORY_MARINE}", but the HSB catalogue prints ` +
            `it in its Gear section and its designation is an automotive gear/transmission ` +
            `class. Marine-specific gear duty is not evidenced and is not assumed.`,
          basis: "Gear row requiring row-level mapping; evidence conflicts.",
        };
      }
      return {
        productFamilyKey: "marine-oils-lubricants",
        productTypeKey: "marine-oils",
        segmentKeys,
        categoryRecognised: true,
        conflict: null,
        basis: "Marine Oils category maps directly to the marine family.",
      };
    }

    case CATEGORY_OTHERS: {
      const decomposed = mapOthers(row);
      if (decomposed) return decomposed;
      return {
        productFamilyKey: null,
        productTypeKey: null,
        segmentKeys,
        categoryRecognised: true,
        conflict:
          `Row is in the Others block with نوع محصول "${row.productTypeLabel}", which is ` +
          `neither antifreeze nor grease. No Others ProductType exists to fall back on.`,
        basis: "Others block, undecomposable on the stated evidence.",
      };
    }

    default:
      return {
        productFamilyKey: null,
        productTypeKey: null,
        segmentKeys,
        categoryRecognised: true,
        conflict: `No mapping rule for category "${row.categoryLabel}".`,
        basis: "No mapping rule.",
      };
  }
}
