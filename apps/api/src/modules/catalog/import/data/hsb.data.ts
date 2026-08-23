/**
 * Reviewed transcription of the 34 matched entries in the Hirmand Shimi Baharan catalogue.
 *
 * ── How this was read, and why it is shaped like this ───────────────────────
 *
 * The catalogue is a 45-page PDF with NO text layer — every page is a single
 * 1239x1754 raster. Nothing machine-extractable exists in it, so the tables were read
 * visually, page by page, and frozen here. Every fact this file produces therefore carries
 * `MANUAL_TRANSCRIPTION`, and none of it is publishable without the sign-off that label
 * exists to demand.
 *
 * The literal below keeps the catalogue's OWN table shape — properties across the top,
 * one row per grade — instead of a flat list of 511 records. That is deliberate: a
 * reviewer checking this file holds the page next to it and compares a table to a table.
 * A flattened form would be harder to verify, and verifying it is the entire point.
 *
 * ── HSB's shape is transposed relative to King Power ────────────────────────
 *
 * King Power puts one property per row and grades in columns; HSB puts one GRADE per row
 * and properties in columns. `expandEntries` transposes it so both arrive as the same
 * (property, grade, value) triples downstream.
 *
 * ── Units are split out of the header, and blanks stay blank ────────────────
 *
 * HSB prints the unit inside the column header (`Density 15 °C Kg/m³`). The columns below
 * split it out so a unit means the same thing across all three sources. Where the header
 * carries NO unit — the grease table, and the density column on nine pages — the unit is
 * the empty string. It is not filled in from the method, even where the method implies one.
 *
 * ── Three things in here are wrong in the source, and stay wrong ────────────
 *
 *   * `23/6`, `23/2` and `5/1` print a solidus where a decimal point belongs. Not
 *     converted; `value-normalization` refuses them and flags each one.
 *   * The KD refrigerator table heads a SINGLE value column `Viscosity 40 100 °C` — two
 *     temperatures, one column. Which one the values belong to cannot be told from the
 *     page. Recorded verbatim and flagged; not resolved.
 *   * Page 34 prints `5-HSB GL-1 Grade` (numeral one) where the workbook writes `GL-I`
 *     (letter I). The workbook name is authoritative and unchanged; the difference is
 *     reported, not corrected.
 *
 * ── The licensing statement on the covers ───────────────────────────────────
 *
 * Both covers carry "UNDER LICENSE OF BRITISH PETROLEUM GLOBAL ENGLAND". It is a
 * DOCUMENT-level statement the publisher makes about ITSELF, not a statement about any of
 * these 34 products, so it is recorded once against the catalogue in
 * `HSB_DOCUMENT_CLAIMS` and NOT copied onto 34 products, which would misattribute it.
 */

import {
  ExtractionMethod,
  ProductClaimKind,
  ResultBasis,
} from "../../../../prisma/generated/enums";

import type {
  RawClaim,
  ReviewedSourceEntry,
  SourceDocumentDescriptor,
} from "../catalog-import.types";

/** The single document all 34 entries cite. One catalogue, one asset, 34 products. */
export const HSB_DOCUMENT_KEY = "HSB-CAT";

const RETRIEVED_AT = "2026-08-22T00:00:00.000Z";

export const HSB_DOCUMENTS: readonly SourceDocumentDescriptor[] = [
  {
    documentKey: HSB_DOCUMENT_KEY,
    // The workbook cites this catalogue by name, not by address; it was supplied as a file.
    locatorType: "UPLOADED_FILE",
    locatorValue: "HSB products.pdf",
    publisher: "Hirmand Shimi Baharan",
    title: "Hirmand Shimi Baharan product catalogue",
    sha256: "5ccd403859d793c5160216a9c5a391babb85bd180dadfa17fb9d83c85c502ee9",
    byteSize: 7487031,
    mediaType: "application/pdf",
    pageCount: 45,
    revisionLabel: null,
    retrievedAt: RETRIEVED_AT,
    defaultResultBasis: ResultBasis.UNSPECIFIED,
  },
];

/** A statement the DOCUMENT makes, about itself or its publisher — never about a product. */
export interface DocumentLevelClaim {
  readonly documentKey: string;
  readonly pageNumbers: readonly number[];
  readonly sourceText: string;
  readonly kind: ProductClaimKind;
  readonly detail: string;
}

export const HSB_DOCUMENT_CLAIMS: readonly DocumentLevelClaim[] = [
  {
    documentKey: HSB_DOCUMENT_KEY,
    pageNumbers: [1, 45],
    sourceText: "UNDER LICENSE OF BRITISH PETROLEUM GLOBAL ENGLAND",
    kind: ProductClaimKind.REFERENCE_ONLY,
    detail:
      "Printed on both covers beneath the publisher's own name. A third party's licensing " +
      "claim about itself: it is not SAM Group's, it does not transfer with the technical " +
      "data, and reproducing it or anything derived from it would be a false statement " +
      "about SAM Group. Recorded as provenance with no promotion path.",
  },
  {
    documentKey: HSB_DOCUMENT_KEY,
    pageNumbers: [1, 45],
    sourceText: "IAF accreditation mark and CE mark",
    kind: ProductClaimKind.REFERENCE_ONLY,
    detail:
      "Accreditation and conformity marks belonging to the publisher, on the publisher's " +
      "own covers. Same treatment as the licensing statement.",
  },
];

// ── Property column definitions ─────────────────────────────────────────────
// Each is [rawProperty, rawUnit, rawMethod] exactly as the page prints it, with the unit
// separated out of the header text. An empty unit means the header carried none.

type Column = readonly [property: string, unit: string, method: string];

const KV100_CST: Column = ["Viscosity 100 °C", "Cst", "ASTM D-445"];
const KV100_NO_UNIT: Column = ["Viscosity 100 °C", "", "ASTM D-445"];
const KV40_CST: Column = ["Viscosity 40 °C", "Cst", "ASTM D-445"];
const VI: Column = ["Viscosity Index", "", "ASTM D-2270"];
const FLASH: Column = ["Flash Point", "°C", "ASTM D-92"];
const POUR: Column = ["Pour Point", "°C", "ASTM D-97"];
const DENSITY_KGM3: Column = ["Density 15 °C", "Kg/m³", "ASTM D-4052"];
const DENSITY_NO_UNIT: Column = ["Density 15 °C", "", "ASTM D-4052"];
const TBN: Column = ["TBN", "MgKOH/g", "ASTM D-2896"];

/** The single ambiguous column: one value column headed with two temperatures. */
const KV_40_OR_100_AMBIGUOUS: Column = ["Viscosity 40 100 °C", "Cst", "ASTM D-445"];

const GREASE_PENETRATION: Column = ["Grease Worked penetration", "", "ASTM D-217"];
const GREASE_DROP_POINT: Column = ["Drop Point", "", "ASTM D-556"];
const GREASE_FREE_ALKALI: Column = ["Grease Free Alkali", "", "ASTM D-128"];
const GREASE_COPPER: Column = ["Grease Copper Corrosion", "", "ASTM D-4048"];

/** The six-column engine-oil table, with the unit printed on the density header. */
const ENGINE_SIX: readonly Column[] = [KV100_CST, VI, FLASH, POUR, DENSITY_KGM3, TBN];
/** The same table on the nine pages whose density header prints no unit. */
const ENGINE_SIX_NO_DENSITY_UNIT: readonly Column[] = [
  KV100_CST,
  VI,
  FLASH,
  POUR,
  DENSITY_NO_UNIT,
  TBN,
];
/** Five columns, no TBN. */
const FIVE_NO_TBN: readonly Column[] = [KV100_CST, VI, FLASH, POUR, DENSITY_NO_UNIT];
/** The split-viscosity industrial table: 40 °C and 100 °C each get their own value column. */
const SPLIT_VISCOSITY: readonly Column[] = [KV40_CST, KV100_CST, VI, FLASH, POUR, DENSITY_NO_UNIT];

interface HsbProduct {
  readonly workbookRow: number;
  /** 1-based page of the catalogue PDF. */
  readonly page: number;
  /** The catalogue's own entry heading, verbatim. */
  readonly entryTitle: string;
  readonly columns: readonly Column[];
  /** One row per grade: the verbatim grade label, then one value per column, in order. */
  readonly rows: readonly (readonly string[])[];
  readonly claims: readonly RawClaim[];
  /** Reviewer-facing notes attached to every fact of this entry. */
  readonly entryNote?: string;
}

const recommended = (text: string, page: number): RawClaim => ({
  sourceText: text,
  pageNumber: page,
});

export const HSB_PRODUCTS: readonly HsbProduct[] = [
  // ── Gasoline Engine Oil (pages 3–9) ───────────────────────────────────────
  {
    workbookRow: 69,
    page: 3,
    entryTitle: "1-HSB SN Grade",
    columns: ENGINE_SIX,
    rows: [
      ["SN 10W40", "15", "150", "210", "-33", "870", "9.5"],
      ["SN 5W40", "14.5", "165", "210", "-39", "855", "9.5"],
      ["SN 5W30", "11.7", "155", "210", "-36", "855", "9.5"],
      ["SN 0W20", "8", "160", "210", "-42", "850", "9.5"],
    ],
    claims: [
      recommended(
        "Multi grade HSB motor oil is made of high quality synthetics base oil and suitable additives which is recommended for modern gasoline cars.",
        3,
      ),
      {
        sourceText:
          "Meets the requirements of the manufacturers as regards extended oil change intervals",
        pageNumber: 3,
        note: "Names no manufacturer, so the conformance claim has no identifiable party.",
      },
    ],
  },
  {
    workbookRow: 72,
    page: 4,
    entryTitle: "2-HSB SM Grade",
    columns: ENGINE_SIX,
    rows: [
      ["SM/CF 10W40", "15", "150", "210", "-33", "870", "7.5"],
      ["SM/CF 5W40", "15", "165", "210", "-39", "860", "7.5"],
    ],
    claims: [
      recommended(
        "Multi grade HSB motor oil is made of high quality synthetic base oil and suitable additives which is recommended for modern gasoline car.",
        4,
      ),
    ],
  },
  {
    workbookRow: 75,
    page: 5,
    entryTitle: "3-HSB SL Grade",
    columns: ENGINE_SIX,
    rows: [
      ["SL/CF 10W40", "15", "150", "220", "-30", "865", "8.5"],
      ["SL/CF 20W50", "19", "130", "226", "-24", "884", "8.5"],
    ],
    claims: [
      recommended(
        "Multi grade HSB motor oil is made of high quality semi synthetic base oil and suitable additives which is recommended for gasoline cars.",
        5,
      ),
    ],
  },
  {
    workbookRow: 78,
    page: 6,
    entryTitle: "4-HSB SJ Grade",
    columns: ENGINE_SIX,
    rows: [
      ["SJ/CF 10W40", "15", "150", "220", "-30", "870", "8.5"],
      ["SJ/CF 20W50", "19", "130", "226", "-24", "885", "8.5"],
    ],
    claims: [
      recommended(
        "Multi Grade HSB motor oil is made of desirable mineral base oil and suitable additives which is recommended for gasoline cars.",
        6,
      ),
    ],
  },
  {
    workbookRow: 81,
    page: 7,
    entryTitle: "5-HSB SG Grade",
    columns: ENGINE_SIX,
    rows: [["SG/CD 20W50", "19", "125", "226", "-24", "890", "9"]],
    claims: [
      recommended(
        "Multi Grade HSB motor oil is made of desirable mineral base oil and suitable additives which is recommended for gasoline cars.",
        7,
      ),
    ],
  },
  {
    workbookRow: 84,
    page: 8,
    entryTitle: "6-HSB SF Grade",
    columns: ENGINE_SIX,
    rows: [
      ["SF/CC 20W50", "19", "125", "225", "-24", "890", "8.5"],
      ["SF/CC 40", "15", "95", "225", "-15", "890", "7"],
      ["SF/CC 50", "19.5", "95", "225", "-12", "890", "7"],
    ],
    claims: [
      recommended(
        "Multi and Mono Grades HSB motor oils are made of desirable mineral base oil and suitable additives which are recommended for gasoline cars and any type of light and non-super charged diesel vehicles in usual working conditions.",
        8,
      ),
    ],
  },
  {
    workbookRow: 87,
    page: 9,
    entryTitle: "7-HSB SC Grade",
    columns: ENGINE_SIX,
    rows: [
      ["SC/CC 40", "15", "95", "225", "-15", "884", "5.2"],
      ["SC/CC 50", "19.5", "95", "225", "-12", "885", "5.2"],
    ],
    claims: [
      recommended(
        "Mono Grade HSB motor oil is made of desirable mineral base oil and suitable additives which is recommended for gasoline cars and any type of light and non-super charged diesel cars in usual working conditions.",
        9,
      ),
    ],
  },

  // ── Diesel Engine (pages 11–14) ───────────────────────────────────────────
  {
    workbookRow: 30,
    page: 11,
    entryTitle: "1-HSB CJ4 Grade",
    columns: ENGINE_SIX,
    rows: [
      ["CJ4 10W40", "15", "155", "215", "-36", "855", "11"],
      ["CJ4 15W40", "15.5", "140", "215", "-27", "860", "11"],
    ],
    claims: [
      recommended(
        "Multi grade HSB motor oil is designed for heavy duty diesel engines, based on a blend of high quality, high viscosity index, full Synthetic base oil and an advanced additive package.",
        11,
      ),
    ],
  },
  {
    workbookRow: 33,
    page: 12,
    entryTitle: "2-HSB CI4 Grade",
    columns: ENGINE_SIX,
    rows: [
      ["CI4 10W40", "14.9", "155", "215", "-36", "865", "11"],
      ["CI4 15W40", "15.5", "140", "215", "-27", "873", "11"],
    ],
    claims: [
      recommended(
        "Multi Grade HSB motor mil is made of desirable mineral base oil and suitable additives, with high TBN/Anti-corrosion high alkalinity property which is recommended for modern diesel vehicles and road construction machineries.",
        12,
      ),
    ],
  },
  {
    workbookRow: 36,
    page: 13,
    entryTitle: "3-HSB CH-4 Grade",
    columns: ENGINE_SIX,
    rows: [
      ["CH4 15W40", "15.5", "140", "215", "-27", "875", "11"],
      ["CH4 20W50", "19", "125", "215", "-27", "885", "11"],
    ],
    claims: [
      {
        sourceText:
          "It is formulated for all automotive high-speed four-stroke, supercharged and turbocharged diesel engines when below performance levels are recommended.",
        pageNumber: 13,
      },
      {
        sourceText:
          "It is also Suitable for civil and road operation, mining and agriculture uses.",
        pageNumber: 13,
      },
    ],
  },
  {
    workbookRow: 39,
    page: 14,
    entryTitle: "4-HSB CD Grade",
    columns: ENGINE_SIX,
    rows: [
      ["CD 40", "15.5", "100", "225", "-15", "885", "10"],
      ["CD 50", "19", "100", "225", "-12", "889", "10"],
    ],
    claims: [
      recommended(
        "Mono Grade HSB motor oil is made of desirable mineral base oil and suitable additives, with high TBN/Anti-corrosion high alkalinity property which is recommended for road construction machineries and any type of non-super changed diesel vehicles in usual working conditions.",
        14,
      ),
    ],
  },

  // ── Motorcycle (pages 18–20) ──────────────────────────────────────────────
  {
    workbookRow: 93,
    page: 18,
    entryTitle: "1-HSB Racing Grade",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [
      ["10W60", "23/6", "185", "230", "-42", "855", "10.5"],
      ["5W60", "23/2", "183", "245", "-45", "860", "10.5"],
    ],
    claims: [
      recommended(
        "HSB racing oil is made of synthetic base oil and with special formulation that provides the required viscosity which is recommended for racecar or sever driving",
        18,
      ),
    ],
  },
  {
    workbookRow: 96,
    page: 19,
    entryTitle: "2-HSB SN Grade",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [["10W40", "13.5", "160", "210", "-36", "855", "10"]],
    claims: [
      recommended(
        "HSB motorcycle racing oil is made of fully synthetic base oil which is recommended 4-stroke motorcycle on the race track.",
        19,
      ),
    ],
  },
  {
    workbookRow: 99,
    page: 20,
    entryTitle: "3-HSB SG Grade",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [["SG 20W50", "20.5", "125", "220", "-24", "855", "9"]],
    claims: [
      recommended(
        "Multi Grade HSB motor oil is made of desirable mineral base oil and suitable additives which is recommended for motorcycle.",
        20,
      ),
    ],
  },

  // ── Locomotive (page 22) ──────────────────────────────────────────────────
  {
    workbookRow: 90,
    page: 22,
    entryTitle: "HSB locomotive oil",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [
      ["SAE 40", "15", "95", "230", "-18", "902", "16"],
      ["SAE 15w-40", "15.5", "125", "215", "-30", "893", "16"],
    ],
    claims: [
      recommended(
        "HSB locomotive oil is made of high quality base oils and suitable additives that be zinc-free which is recommended for use in locomotive diesel engines.",
        22,
      ),
    ],
  },

  // ── Marine (pages 26–29) ──────────────────────────────────────────────────
  {
    workbookRow: 219,
    page: 26,
    entryTitle: "1-TWO-Stroke Engine Oil",
    columns: [KV100_NO_UNIT, VI, FLASH, POUR, DENSITY_KGM3],
    rows: [["TC", "9.5", "95", "210", "-21", "885"]],
    claims: [
      {
        sourceText: "Tc Motor Oil is Recommended For Two-stroke Gasoline Engines",
        pageNumber: 26,
      },
      {
        sourceText: "TC",
        standardBody: "API",
        standardCode: "TC",
        pageNumber: 26,
        kindOverride: ProductClaimKind.CLASSIFICATION_STATED,
        note:
          "The specification row of this table is labelled `TC`, which is a two-stroke " +
          "performance classification, not a viscosity grade. Recorded as a claim, not a Grade.",
      },
    ],
  },
  {
    workbookRow: 222,
    page: 27,
    entryTitle: "2-HSB LENJ oil",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [
      ["SAE 30", "12", "95", "210", "-18", "897", "9"],
      ["SAE 40", "15.5", "95", "220", "-12", "900", "9"],
    ],
    claims: [{ sourceText: "For use in medium speed 4 storke diesel engines.", pageNumber: 27 }],
  },
  {
    workbookRow: 225,
    page: 28,
    entryTitle: "3-HSB super trunk oil",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [["5W50", "15.5", "95", "220", "-12", "912", "40"]],
    claims: [
      recommended(
        "HSB super trunk oil is recommended for use in four-stroke 'trunk piston' engines, middle speed and high sulfur fuel.",
        28,
      ),
    ],
  },
  {
    workbookRow: 228,
    page: 28,
    entryTitle: "4-HSB trunk oil",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [
      ["30", "12", "95", "210", "-18", "900", "30"],
      ["40", "15.5", "95", "220", "-12", "905", "30"],
    ],
    claims: [
      recommended(
        "HSB trunk oil is recommended for use in four-stroke 'trunk piston' engines, middle-four speed and high sulfur fuel (more than 3%).",
        28,
      ),
    ],
  },
  {
    workbookRow: 231,
    page: 29,
    entryTitle: "5-HSB special trunk oil",
    columns: ENGINE_SIX_NO_DENSITY_UNIT,
    rows: [
      ["30", "12", "95", "210", "-18", "897", "12"],
      ["40", "15.5", "95", "220", "-18", "900", "12"],
    ],
    claims: [
      recommended(
        "HSB trunk oil is recommended for use in four-stroke 'trunk piston' engines, medium speed and distillate fuels with a sulphur content up to 1%.",
        29,
      ),
    ],
  },

  // ── Gear (pages 30–34) ────────────────────────────────────────────────────
  {
    workbookRow: 234,
    page: 30,
    entryTitle: "1-HSB ATF Grade",
    columns: FIVE_NO_TBN,
    rows: [
      ["ATF-3", "7.5", "180", "190", "-39", "857"],
      ["ATF-2", "7", "170", "190", "-39", "860"],
      ["ATF-CVT", "7.3", "180", "190", "-42", "847"],
    ],
    claims: [
      {
        sourceText:
          "HSB ATF gear oil manufactured from excellent synthetic oil and fully hydro finished paraffinic base oil with high viscosity index, specially formulated to meet the lubrication requirements of specific automatic transmission units.",
        pageNumber: 30,
      },
    ],
  },
  {
    workbookRow: 237,
    page: 31,
    entryTitle: "2-HSB GL-5 Grade",
    columns: [KV100_CST, VI, FLASH, POUR, DENSITY_KGM3],
    rows: [
      ["GL5 85W90", "17", "90", "215", "-18", "905"],
      ["GL5 75W80", "9", "155", "190", "-36", "875"],
      ["GL5 85W140", "25", "95", "215", "-15", "900"],
      ["GL5 140", "25", "95", "210", "-9", "900"],
      ["GL5 90", "17", "90", "210", "-18", "900"],
    ],
    claims: [
      {
        sourceText:
          "HSB GL-5 gear oil is high performance synthetic transmission oil that suitable for certain manual gearboxes and axle and moderate to heavily loaded on and off-road driveline applications.",
        pageNumber: 31,
      },
    ],
  },
  {
    workbookRow: 240,
    page: 32,
    entryTitle: "3-HSB GL-4 Grade",
    columns: [KV100_CST, VI, FLASH, POUR, DENSITY_KGM3],
    rows: [
      ["GL4 85W90", "17", "90", "210", "-18", "900"],
      ["GL4 75W80", "8.6", "150", "180", "-36", "875"],
      ["GL4 85W140", "25", "95", "215", "-12", "900"],
    ],
    claims: [],
  },
  {
    workbookRow: 243,
    page: 33,
    entryTitle: "4-HSB GL-3 Grade",
    columns: FIVE_NO_TBN,
    rows: [
      ["GL3 68", "9", "95", "210", "-27", "878"],
      ["GL3 100", "11", "95", "218", "-27", "887"],
      ["GL3 220", "18", "95", "230", "-21", "890"],
      ["GL3 320", "25", "95", "230", "-15", "900"],
      ["GL3 680", "41", "95", "240", "-9", "905"],
    ],
    claims: [
      { sourceText: "Suitable for manual gear box", pageNumber: 33 },
      { sourceText: "Suitable for helical and spiral gear box", pageNumber: 33 },
    ],
  },
  {
    workbookRow: 246,
    page: 34,
    entryTitle: "5-HSB GL-1 Grade",
    columns: FIVE_NO_TBN,
    rows: [
      ["GL1 90", "17", "95", "220", "-18", "895"],
      ["GL1 140", "24", "100", "230", "-12", "905"],
    ],
    claims: [
      recommended(
        "HSB gear oil is made of high quality mineral base oils and suitable additives which is recommended for using in vehicles gearboxes under usual operating conditions.",
        34,
      ),
      { sourceText: "Suitable for manual gear box", pageNumber: 34 },
      { sourceText: "Suitable for helical and spiral gear box", pageNumber: 34 },
    ],
    entryNote:
      "The catalogue heading is `5-HSB GL-1 Grade` (numeral one) and the grade labels read " +
      "`GL1`; the authoritative workbook writes `GL-I` (letter I). The workbook name governs " +
      "and is unchanged. Reported for owner decision, not corrected.",
  },

  // ── Industrial Oil (pages 36–42) ──────────────────────────────────────────
  {
    workbookRow: 141,
    page: 36,
    entryTitle: "1-HSB hydraulic oil- HL Grade",
    columns: SPLIT_VISCOSITY,
    rows: [
      ["HL 22", "22", "4", "100", "200", "-30", "865"],
      ["HL 32", "32", "5.5", "100", "210", "-30", "865"],
      ["HL 46", "46", "6.8", "100", "220", "-27", "880"],
      ["HL 68", "68", "9", "106", "220", "-24", "884"],
      ["HL 150", "150", "16", "110", "225", "-18", "884"],
    ],
    claims: [
      recommended(
        "HSB hydraulic oil is made of high quality mineral base oil and additives which is recommended for controlling hydraulic systems and power transmission.",
        36,
      ),
      {
        sourceText:
          "HSB hydraulic oil is a rotatory oil that has excellent properties and is suitable for circulation system.",
        pageNumber: 36,
      },
    ],
  },
  {
    workbookRow: 144,
    page: 37,
    entryTitle: "2-HSB hydraulic oil- HH Grade",
    columns: SPLIT_VISCOSITY,
    rows: [
      ["HH 22", "22", "4", "100", "200", "-30", "868"],
      ["HH 32", "32", "5.5", "100", "210", "-30", "868"],
      ["HH 46", "46", "6.5", "95", "220", "-27", "880"],
      ["HH 68", "68", "8.5", "95", "220", "-24", "884"],
      ["HH 150", "150", "14.5", "95", "225", "-18", "884"],
    ],
    claims: [
      recommended(
        "HSB hydraulic oil is made of high quality mineral base oil and additives is recommended for hydraulic systems and power transmission system according to relevant standards.",
        37,
      ),
    ],
  },
  {
    workbookRow: 147,
    page: 38,
    entryTitle: "3-HSB Circulating oil",
    columns: SPLIT_VISCOSITY,
    rows: [
      ["Iso-68", "68", "8.5", "95", "220", "-18", "885"],
      ["Iso-100", "100", "11.1", "95", "220", "-12", "885"],
      ["Iso-150", "150", "14.5", "95", "220", "-12", "890"],
      ["Iso-220", "220", "18.8", "95", "220", "-12", "890"],
      ["Iso-320", "320", "24", "95", "220", "-12", "895"],
    ],
    claims: [],
  },
  {
    workbookRow: 150,
    page: 39,
    entryTitle: "4-HSB Heat Transfer oil",
    columns: SPLIT_VISCOSITY,
    rows: [["HT 32", "32", "5.5", "100", "210", "-18", "868"]],
    claims: [
      recommended(
        "HSB Heat transfer oil is made of desirable paraffinic base oil and suitable additives which is recommended for closed systems up to a temperature of 300 °C-at atmospheric pressure and for open system up to a temperature of 180 °C.",
        39,
      ),
    ],
  },
  {
    workbookRow: 153,
    page: 39,
    entryTitle: "5-HSB quenching oil",
    columns: SPLIT_VISCOSITY,
    rows: [["Quenching", "26", "5", "105", "190", "-6", "870"]],
    claims: [
      recommended(
        "HSB quenching oil is made of desirable paraffinic base oil and suitable additives which recommended for closed systems up to a temperature of 300 °C - at atmospheric pressure and for open system up to a temperature of 180 °C.",
        39,
      ),
    ],
  },
  {
    workbookRow: 156,
    page: 40,
    entryTitle: "6-HSB Turbine oil",
    columns: FIVE_NO_TBN,
    rows: [
      ["HSB-T-32", "5.3", "100", "210", "-18", "879"],
      ["HSB-T-46", "6.8", "100", "215", "-15", "879"],
      ["HSB-T-68", "8.7", "100", "220", "-12", "881"],
      ["HSB-T-100", "11.4", "100", "230", "-12", "881"],
      ["HSB-T-32 Plus", "5.8", "128", "210", "-24", "845"],
      ["HSB-T-46 Plus", "7.3", "130", "210", "-24", "847"],
      ["HSB-T-68 plus", "9.9", "130", "210", "-24", "855"],
    ],
    claims: [
      recommended(
        "HSB Turbine oil is made of high quality base oils and special additives which is recommended in water, steam and gas turbines.",
        40,
      ),
    ],
    entryNote:
      "The three `Plus` grades differ materially from their non-Plus counterparts in " +
      "viscosity index (128–130 against 100) and pour point (-24 against -12/-18). Whether " +
      "`Plus` is a grade of this product or a second product is a business question.",
  },
  {
    workbookRow: 159,
    page: 41,
    entryTitle: "7-HSB Compressor oil -VB",
    columns: [KV40_CST, VI, FLASH, POUR, DENSITY_NO_UNIT],
    rows: [
      ["VB- 22", "22", "100", "180", "-24", "865"],
      ["VB- 32", "32", "100", "195", "-24", "870"],
      ["VB- 46", "46", "95", "210", "-24", "875"],
      ["VB- 68", "68", "95", "210", "-18", "882"],
      ["VB- 100", "100", "95", "220", "-15", "886"],
      ["VB- 150", "150", "95", "220", "-12", "890"],
    ],
    claims: [
      recommended(
        "HSB Compressor oil is made of high quality synthetic base oil with high stability and durability which is recommended for screw air reciprocating compressors and etc.",
        41,
      ),
    ],
  },
  {
    workbookRow: 162,
    page: 42,
    entryTitle: "8-HSB Refrigerator compressor oil-KD",
    columns: [KV_40_OR_100_AMBIGUOUS, VI, FLASH, POUR, DENSITY_NO_UNIT],
    rows: [
      ["KD-32", "6", "140", "210", "-45", "980"],
      ["KD-68", "10.4", "140", "220", "-42", "990"],
      ["KD-100", "13.9", "140", "220", "-42", "990"],
    ],
    claims: [
      recommended(
        "HSB refrigerator oil is recommended for use in open, semiopen and hermetic compressors in domestic, commercial and industrial refrigeration systems and use with R134a and other types of HFC refrigerant.",
        42,
      ),
    ],
    entryNote:
      "The viscosity column is headed `Viscosity 40 100 °C (Cst)` — two temperatures above a " +
      "SINGLE value column. Which temperature the values belong to cannot be determined from " +
      "the page. Recorded verbatim; not resolved.",
  },

  // ── Grease (page 44) ──────────────────────────────────────────────────────
  {
    workbookRow: 300,
    page: 44,
    entryTitle: "1-Grease Based on Calcium",
    columns: [GREASE_PENETRATION, GREASE_DROP_POINT, GREASE_FREE_ALKALI, GREASE_COPPER],
    rows: [
      ["NLGI 2", "265-295", "98", "0.15", "1a"],
      ["NLGI 3", "220-250", "98", "0.15", "1a"],
      ["NLGI 4", "175-205", "98", "0.15", "1a"],
    ],
    claims: [
      {
        sourceText:
          "HSB Grease Based on calcium is suitable for general lubrication for metallic surface, frames and car bodies.",
        pageNumber: 44,
      },
      {
        sourceText: "This grease is suitable for applications on machineries contact with water.",
        pageNumber: 44,
      },
    ],
    entryNote:
      "None of the four columns prints a unit. The methods imply 0.1 mm, °C and % " +
      "respectively; those are NOT filled in, because the source did not state them.",
  },
];

/**
 * Transposes the printed tables into the flat (property, grade, value) form the rest of the
 * importer works in. Every entry cites the one catalogue document and its own page.
 */
export function expandHsbEntries(): ReviewedSourceEntry[] {
  return HSB_PRODUCTS.map((product) => {
    const facts = [];
    for (const row of product.rows) {
      const gradeLabel = row[0] ?? "";
      for (let index = 0; index < product.columns.length; index++) {
        const column = product.columns[index];
        const value = row[index + 1];
        if (!column || value === undefined || value === "") continue;
        facts.push({
          rawProperty: column[0],
          rawUnit: column[1],
          rawValue: value,
          rawMethod: column[2],
          rawGrade: gradeLabel,
          pageNumber: product.page,
          columnLabel: column[0],
        });
      }
    }
    return {
      workbookRow: product.workbookRow,
      family: "hsb" as const,
      documentKey: HSB_DOCUMENT_KEY,
      extractionMethod: ExtractionMethod.MANUAL_TRANSCRIPTION,
      defaultResultBasis: ResultBasis.UNSPECIFIED,
      grades: product.rows.map((row, index) => ({ label: row[0] ?? "", sortOrder: index })),
      facts,
      claims: product.claims,
      ...(product.entryNote ? { entryNote: product.entryNote } : {}),
    };
  });
}

export const HSB_ENTRIES: readonly ReviewedSourceEntry[] = expandHsbEntries();
