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
 * ProductTypes are PROPOSALS. No `product_types` row exists yet, and this gate persists
 * none. There is deliberately no `Others` ProductType — the workbook's
 * `سایر محصولات Others products` block is a filing convenience, not a product class, and it
 * decomposes on row-level evidence into antifreeze/coolants and greases.
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

/** The eight proposed ProductType keys. No `others`, by decision. */
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
 * The five rows whose family cannot be decided from the evidence available. Listed
 * explicitly rather than pattern-matched: a conflict set that grows silently because a
 * regular expression matched something new is a conflict set nobody reviews.
 */
export const GEAR_FAMILY_CONFLICT_ROWS: readonly number[] = [234, 237, 240, 243, 246];

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

export function mapTaxonomy(row: WorkbookProductRow): TaxonomyProposal {
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
