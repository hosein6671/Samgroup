import { createHash } from "node:crypto";

import {
  ResultBasis,
  SourceLocatorType,
  SourceUnitClassification,
  SpecValueType,
  TechnicalReviewStatus,
} from "../../../../prisma/generated/enums";

import * as ids from "../apply/identities";

import { canonicalJson } from "../manifest";

/**
 * The second registered ADR-018 incremental patch, and the first to onboard entirely new
 * catalog identity rather than normalize existing evidence.
 *
 * ── Why this needs its own patch rather than reusing `coolant-source-layout-v1`'s shape ──────
 *
 * `patch.ts`'s coolant patch cites four SourceFacts that ALREADY existed from the ratified
 * workbook import — it creates no Product, no SourceDocument and no SourceFact of its own.
 * `base-oils` holds zero Product rows in `sam_platform` today (verified directly against the
 * database; the ratified workbook itself carried no Base Oil rows to import), so there is no
 * existing evidence this patch could cite. This patch instead creates its own immutable
 * SourceDocuments and SourceFacts from freshly-verified, primary-source evidence recorded in
 * `docs/content/PRODUCT_TECHNICAL_BASELINE_V2_SOURCES.md` §9 ("Base Oils, Group I — ORLEN" and
 * "Bright Stock BS 150 — Golden Eagle Chemical"), and the two Products and five ProductGrades
 * those SourceFacts describe.
 *
 * This is a genuine extension of ADR-018's stated scope (§6 describes patch #1's specific
 * boundary, not a ceiling on every patch — its own Consequences section anticipates "another
 * named patch" for later incremental changes). It keeps every one of ADR-018's SAFETY
 * properties: an exact, named, SHA-256'd manifest; an APPLICABLE / ALREADY_APPLIED / CONFLICT
 * state machine with no partial-repair path; every new Specification born `NEEDS_REVIEW`; zero
 * `TechnicalReview` rows written; zero public exposure (verified post-write, exactly as the
 * coolant patch verifies); full rollback on any failure; and a bounded, reviewable write list.
 *
 * ── Hierarchy decision (stated once, here, not re-derived at apply time) ──────────────────────
 *
 * Two new catalog product records, matching the existing multi-grade convention this catalog
 * already uses everywhere else (e.g. "hydraulic Oil- HH Grade" / "hydraulic oil- HL Grade" as
 * separate Products, each fanning into its own ProductGrade viscosities) and matching the
 * ALREADY-APPROVED Base Oils family taxonomy (`apps/web/.../category/data/base-oils.ts`'s
 * `range.subRanges`, itself transcribed from `docs/SITE_STRUCTURE.md` §4): "Group I", "Group
 * II", "Group III", "Bright Stock" are four of that taxonomy's seven sub-ranges, each its own
 * distinct thing — not grades of one "Base Oil" product, and not synonyms of each other.
 *
 * - **"Base Oil Group I"** (Product) — grades SN 150 / SN 350 / SN 500 / SN 650 (`ProductGrade`,
 *   `gradeSystem: null` — Solvent Neutral is a real, generic API base-stock designation, not one
 *   of `SAE`/`ISO_VG`/`NLGI`, so `null` is the correct value, not a gap).
 * - **"Bright Stock"** (Product) — grade BS 150.
 *
 * Group II and Group III are NOT onboarded by this patch — reported as a deliberate scope
 * decision, not a silent omission. The only exact, approved external evidence for them (§9's
 * ADNOC `ADbase` datasheets) uses properties this catalog's `SpecProperty` dictionary does not
 * yet define (sulfur content, saturates/aromatics) and the source's own product name is exactly
 * the string this document's own public/internal boundary forbids from ever reaching this
 * catalog ("ADNOC/ADbase") — onboarding them correctly needs new dictionary rows and a naming
 * decision that is its own piece of work, not one folded into this pass under time pressure.
 *
 * SN 350 has no ORLEN document naming it ("SN 350 is not an ORLEN grade" — the register's own
 * words). Its identity is created here, per explicit owner instruction, with zero Specifications
 * attached. It therefore reads as "Technical data is under review." on the public Product Detail
 * page, which is the true and complete state of its evidence today.
 */
export const BASE_OIL_ONBOARDING_PATCH_ID = "base-oil-onboarding-v1";
export const INCREMENTAL_IMPORTER_VERSION = "catalog-incremental/1.0.0";

export interface BaseOilProductDef {
  readonly key: string;
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
}

export interface BaseOilGradeDef {
  readonly key: string;
  readonly id: string;
  readonly productKey: string;
  readonly label: string;
  readonly sortOrder: number;
}

export interface BaseOilDocumentDef {
  readonly key: string;
  readonly id: string;
  readonly locatorType: SourceLocatorType;
  readonly locatorValue: string;
  readonly title: string;
  readonly publisher: string;
  readonly documentDate: string | null;
  readonly retrievedAt: string;
  readonly defaultResultBasis: ResultBasis;
}

/** One (document, grade, property) reading. Fact and Specification are 1:1 in this patch — no
 * fact here is withheld — so a single entry carries both the verbatim evidence and its already
 * normalized shape. */
export interface BaseOilReadingDef {
  readonly key: string;
  readonly factId: string;
  readonly specificationId: string;
  readonly documentKey: string;
  readonly gradeKey: string;
  readonly propertyKey: string;
  readonly rawProperty: string;
  readonly rawUnit: string | null;
  readonly rawValue: string;
  readonly rawMethod: string | null;
  readonly unitClassification: SourceUnitClassification;
  readonly unit: string | null;
  readonly displayValue: string;
  readonly valueType: SpecValueType;
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly sortOrder: number;
}

const productKey = (label: string): string => ids.identityKey("base-oil-onboarding-product", label);
const gradeKey = (productLabel: string, gradeLabel: string): string =>
  ids.identityKey("base-oil-onboarding-grade", productLabel, gradeLabel);
const documentKey = (label: string): string =>
  ids.identityKey("base-oil-onboarding-document", label);
const readingKey = (documentLabel: string, gradeLabel: string, propertyKey: string): string =>
  ids.identityKey("base-oil-onboarding-reading", documentLabel, gradeLabel, propertyKey);

/** Every id in this patch is derived from a stable, human-readable key in the SAME uuid
 * namespace `identities.ts` already uses — reproducible across a dry-run, a disposable-clone
 * test and the real apply, without a second id scheme. `Product.sourceRef` stays null for both
 * rows: they are created outside the ratified workbook import and legitimately have none. */
const uuidFrom = (key: string): string => ids.productId(key);

export const PRODUCTS: readonly BaseOilProductDef[] = [
  {
    key: productKey("Base Oil Group I"),
    id: uuidFrom(productKey("Base Oil Group I")),
    slug: "base-oil-group-i",
    name: "Base Oil Group I",
    description:
      "Group I paraffinic solvent-neutral base oil, published by Solvent Neutral (SN) viscosity designation.",
  },
  {
    key: productKey("Bright Stock"),
    id: uuidFrom(productKey("Bright Stock")),
    slug: "bright-stock",
    name: "Bright Stock",
    description: "High-viscosity base-stock family, published as BS 150.",
  },
];

const PRODUCT_GROUP_I = productKey("Base Oil Group I");
const PRODUCT_BRIGHT_STOCK = productKey("Bright Stock");

export const GRADES: readonly BaseOilGradeDef[] = [
  {
    key: gradeKey("Base Oil Group I", "SN 150"),
    id: uuidFrom(gradeKey("Base Oil Group I", "SN 150")),
    productKey: PRODUCT_GROUP_I,
    label: "SN 150",
    sortOrder: 0,
  },
  {
    key: gradeKey("Base Oil Group I", "SN 350"),
    id: uuidFrom(gradeKey("Base Oil Group I", "SN 350")),
    productKey: PRODUCT_GROUP_I,
    label: "SN 350",
    sortOrder: 1,
  },
  {
    key: gradeKey("Base Oil Group I", "SN 500"),
    id: uuidFrom(gradeKey("Base Oil Group I", "SN 500")),
    productKey: PRODUCT_GROUP_I,
    label: "SN 500",
    sortOrder: 2,
  },
  {
    key: gradeKey("Base Oil Group I", "SN 650"),
    id: uuidFrom(gradeKey("Base Oil Group I", "SN 650")),
    productKey: PRODUCT_GROUP_I,
    label: "SN 650",
    sortOrder: 3,
  },
  {
    key: gradeKey("Bright Stock", "BS 150"),
    id: uuidFrom(gradeKey("Bright Stock", "BS 150")),
    productKey: PRODUCT_BRIGHT_STOCK,
    label: "BS 150",
    sortOrder: 0,
  },
];

const SN150 = gradeKey("Base Oil Group I", "SN 150");
const SN500 = gradeKey("Base Oil Group I", "SN 500");
const SN650 = gradeKey("Base Oil Group I", "SN 650");
const BS150 = gradeKey("Bright Stock", "BS 150");

/**
 * Internal provenance only (ADR-014 §6) — never reaches a public response. `locatorValue` for
 * the SDS is a descriptive citation rather than a clean URL because the research register itself
 * captured no direct link for it, only the document's own name and date; recording exactly what
 * was captured is more honest than inventing a URL shape.
 */
export const DOCUMENTS: readonly BaseOilDocumentDef[] = [
  {
    key: documentKey("ORLEN SN 150 PDS"),
    id: uuidFrom(documentKey("ORLEN SN 150 PDS")),
    locatorType: SourceLocatorType.URL,
    locatorValue: "https://www.orlen.pl/en/for-business/products/oils/base-oils/base-oil-sn-150",
    title: "ORLEN — Base Oil SN 150 (Product Data Sheet)",
    publisher: "Polski Koncern Naftowy ORLEN S.A.",
    documentDate: null,
    retrievedAt: "2026-09-05T00:00:00.000Z",
    defaultResultBasis: ResultBasis.SPECIFICATION_LIMIT,
  },
  {
    key: documentKey("ORLEN SN 500 PDS"),
    id: uuidFrom(documentKey("ORLEN SN 500 PDS")),
    locatorType: SourceLocatorType.URL,
    locatorValue: "https://www.orlen.pl/en/for-business/products/oils/base-oils/base-oil-sn-500",
    title: "ORLEN — Base Oil SN 500 (Product Data Sheet)",
    publisher: "Polski Koncern Naftowy ORLEN S.A.",
    documentDate: null,
    retrievedAt: "2026-09-05T00:00:00.000Z",
    defaultResultBasis: ResultBasis.SPECIFICATION_LIMIT,
  },
  {
    key: documentKey("ORLEN SN SDS"),
    id: uuidFrom(documentKey("ORLEN SN SDS")),
    locatorType: SourceLocatorType.URL,
    locatorValue: "orlen.pl — Safety Data Sheet: BASE OILS SN-100, SN-150, SN-500, SN-650",
    title: "ORLEN — Base Oils SN-100/150/500/650 (Safety Data Sheet, Section 9)",
    publisher: "Polski Koncern Naftowy ORLEN S.A.",
    documentDate: "2019-01-14",
    retrievedAt: "2026-09-05T00:00:00.000Z",
    defaultResultBasis: ResultBasis.TYPICAL,
  },
  {
    key: documentKey("Golden Eagle BS150 PDS"),
    id: uuidFrom(documentKey("Golden Eagle BS150 PDS")),
    locatorType: SourceLocatorType.URL,
    locatorValue: "https://gechem.us/pdfs/PDS%20BS150%20Golden.pdf",
    title: "Golden Eagle Chemical, Inc. — Bright Stock 150 (Product Data Sheet)",
    publisher: "Golden Eagle Chemical, Inc.",
    documentDate: null,
    retrievedAt: "2026-09-05T00:00:00.000Z",
    defaultResultBasis: ResultBasis.TYPICAL,
  },
];

const D_SN150 = documentKey("ORLEN SN 150 PDS");
const D_SN500 = documentKey("ORLEN SN 500 PDS");
const D_SDS = documentKey("ORLEN SN SDS");
const D_BS150 = documentKey("Golden Eagle BS150 PDS");

type Shape =
  | { readonly type: "POINT"; readonly value: string; readonly unit: string | null }
  | { readonly type: "MINIMUM"; readonly min: string; readonly unit: string }
  | { readonly type: "MAXIMUM"; readonly max: string; readonly unit: string }
  | { readonly type: "RANGE"; readonly min: string; readonly max: string; readonly unit: string };

/**
 * `unit` is set only for a POINT reading; a RANGE/MINIMUM/MAXIMUM reading embeds its unit into
 * `displayValue` instead and leaves the raw `unit` column null — the exact convention already
 * established by every other RANGE/MINIMUM/MAXIMUM row in this catalog (`ProductSpecifications`
 * prints a separate unit badge only when `unit` is non-null, so a populated `unit` beside an
 * already-unit-bearing `displayValue` would print the unit twice).
 */
function reading(
  documentKeyValue: string,
  gradeKeyValue: string,
  propertyKey: string,
  rawProperty: string,
  rawUnit: string | null,
  rawValue: string,
  rawMethod: string | null,
  unitClassification: SourceUnitClassification,
  shape: Shape,
  sortOrder: number,
): BaseOilReadingDef {
  const key = readingKey(documentKeyValue, gradeKeyValue, propertyKey);
  const base = {
    key,
    factId: uuidFrom(`${key}|fact`),
    specificationId: uuidFrom(`${key}|specification`),
    documentKey: documentKeyValue,
    gradeKey: gradeKeyValue,
    propertyKey,
    rawProperty,
    rawUnit,
    rawValue,
    rawMethod,
    unitClassification,
    sortOrder,
  };

  if (shape.type === "POINT") {
    return {
      ...base,
      unit: shape.unit,
      displayValue: shape.value,
      valueType: SpecValueType.POINT,
      numericMin: shape.value,
      numericMax: null,
    };
  }
  if (shape.type === "MINIMUM") {
    return {
      ...base,
      unit: null,
      displayValue: `≥ ${shape.min} ${shape.unit}`.trim(),
      valueType: SpecValueType.MINIMUM,
      numericMin: shape.min,
      numericMax: null,
    };
  }
  if (shape.type === "MAXIMUM") {
    return {
      ...base,
      unit: null,
      displayValue: `≤ ${shape.max} ${shape.unit}`.trim(),
      valueType: SpecValueType.MAXIMUM,
      numericMin: null,
      numericMax: shape.max,
    };
  }
  return {
    ...base,
    unit: null,
    displayValue: `${shape.min} – ${shape.max} ${shape.unit}`.trim(),
    valueType: SpecValueType.RANGE,
    numericMin: shape.min,
    numericMax: shape.max,
  };
}

const STATED = SourceUnitClassification.STATED;
const DIMENSIONLESS = SourceUnitClassification.DIMENSIONLESS;

/** Every reading this patch may write. No per-value ASTM method was captured in the research
 * register for the three ORLEN documents, so `rawMethod` is null there — an honest reflection
 * of what the evidence states, not a gap this patch fills in. Golden Eagle's PDS names a method
 * per value, so every Bright Stock reading carries one. */
export const READINGS: readonly BaseOilReadingDef[] = [
  // SN 150 — ORLEN PDS.
  reading(
    D_SN150,
    SN150,
    "kv_40c",
    "Kinematic viscosity @40°C",
    "mm²/s",
    "28.8-33.5",
    null,
    STATED,
    {
      type: "RANGE",
      min: "28.8",
      max: "33.5",
      unit: "mm²/s",
    },
    0,
  ),
  reading(
    D_SN150,
    SN150,
    "kv_100c",
    "Kinematic viscosity @100°C",
    "mm²/s",
    "5.0-5.5",
    null,
    STATED,
    {
      type: "RANGE",
      min: "5.0",
      max: "5.5",
      unit: "mm²/s",
    },
    1,
  ),
  reading(
    D_SN150,
    SN150,
    "viscosity_index",
    "Viscosity index",
    null,
    "min. 95",
    null,
    DIMENSIONLESS,
    { type: "MINIMUM", min: "95", unit: "" },
    2,
  ),
  reading(
    D_SN150,
    SN150,
    "pour_point",
    "Pour point",
    "°C",
    "max. -12",
    null,
    STATED,
    {
      type: "MAXIMUM",
      max: "-12",
      unit: "°C",
    },
    3,
  ),
  reading(
    D_SN150,
    SN150,
    "flash_point_oc",
    "Flash point (open)",
    "°C",
    "min. 210",
    null,
    STATED,
    {
      type: "MINIMUM",
      min: "210",
      unit: "°C",
    },
    4,
  ),

  // SN 500 — ORLEN PDS.
  reading(
    D_SN500,
    SN500,
    "kv_40c",
    "Kinematic viscosity @40°C",
    "mm²/s",
    "min. 95",
    null,
    STATED,
    {
      type: "MINIMUM",
      min: "95",
      unit: "mm²/s",
    },
    0,
  ),
  reading(
    D_SN500,
    SN500,
    "kv_100c",
    "Kinematic viscosity @100°C",
    "mm²/s",
    "10.5-12",
    null,
    STATED,
    {
      type: "RANGE",
      min: "10.5",
      max: "12",
      unit: "mm²/s",
    },
    1,
  ),
  reading(
    D_SN500,
    SN500,
    "viscosity_index",
    "Viscosity index",
    null,
    "min. 90",
    null,
    DIMENSIONLESS,
    { type: "MINIMUM", min: "90", unit: "" },
    2,
  ),
  reading(
    D_SN500,
    SN500,
    "pour_point",
    "Pour point",
    "°C",
    "max. -9",
    null,
    STATED,
    {
      type: "MAXIMUM",
      max: "-9",
      unit: "°C",
    },
    3,
  ),
  reading(
    D_SN500,
    SN500,
    "flash_point_oc",
    "Flash point",
    "°C",
    "min. 220",
    null,
    STATED,
    {
      type: "MINIMUM",
      min: "220",
      unit: "°C",
    },
    4,
  ),

  // SN 650 — ORLEN SDS §9 only (no dedicated PDS retrieved). Narrower property set.
  reading(
    D_SDS,
    SN650,
    "kv_40c",
    "Kinematic viscosity @40°C",
    "mm²/s",
    "min. 135",
    null,
    STATED,
    {
      type: "MINIMUM",
      min: "135",
      unit: "mm²/s",
    },
    0,
  ),
  reading(
    D_SDS,
    SN650,
    "kv_100c",
    "Kinematic viscosity @100°C",
    "mm²/s",
    "13-16.2",
    null,
    STATED,
    {
      type: "RANGE",
      min: "13",
      max: "16.2",
      unit: "mm²/s",
    },
    1,
  ),
  reading(
    D_SDS,
    SN650,
    "flash_point_oc",
    "Flash point",
    "°C",
    "min. 240",
    null,
    STATED,
    {
      type: "MINIMUM",
      min: "240",
      unit: "°C",
    },
    2,
  ),
  reading(
    D_SDS,
    SN650,
    "pour_point",
    "Melting point/range (pour)",
    "°C",
    "max. -9",
    null,
    STATED,
    { type: "MAXIMUM", max: "-9", unit: "°C" },
    3,
  ),
  reading(
    D_SDS,
    SN650,
    "density_15c",
    "Density @15°C",
    "g/cm³",
    "0.894",
    null,
    STATED,
    {
      type: "POINT",
      value: "0.894",
      unit: "g/cm³",
    },
    4,
  ),

  // Bright Stock BS 150 — Golden Eagle Chemical PDS, every value carries its own ASTM method.
  reading(
    D_BS150,
    BS150,
    "kv_40c",
    "Kinematic viscosity @40°C",
    "cSt",
    "510",
    "ASTM D445",
    STATED,
    { type: "POINT", value: "510", unit: "cSt" },
    0,
  ),
  reading(
    D_BS150,
    BS150,
    "kv_100c",
    "Kinematic viscosity @100°C",
    "cSt",
    "32.5",
    "ASTM D445",
    STATED,
    { type: "POINT", value: "32.5", unit: "cSt" },
    1,
  ),
  reading(
    D_BS150,
    BS150,
    "viscosity_index",
    "Viscosity index",
    null,
    "95",
    "ASTM D2270",
    DIMENSIONLESS,
    { type: "POINT", value: "95", unit: null },
    2,
  ),
  reading(
    D_BS150,
    BS150,
    "flash_point_coc",
    "Flash point COC",
    "°C",
    "296",
    "ASTM D92",
    STATED,
    { type: "POINT", value: "296", unit: "°C" },
    3,
  ),
  reading(
    D_BS150,
    BS150,
    "pour_point",
    "Pour point",
    "°C",
    "-6",
    "ASTM D5949",
    STATED,
    { type: "POINT", value: "-6", unit: "°C" },
    4,
  ),
  reading(
    D_BS150,
    BS150,
    "specific_gravity",
    "Specific gravity",
    null,
    "0.8895",
    "ASTM D4052",
    DIMENSIONLESS,
    { type: "POINT", value: "0.8895", unit: null },
    5,
  ),
];

export const BASE_OIL_ONBOARDING_PATCH = {
  schemaVersion: 1 as const,
  patchId: BASE_OIL_ONBOARDING_PATCH_ID,
  importerVersion: INCREMENTAL_IMPORTER_VERSION,
  products: PRODUCTS,
  grades: GRADES,
  documents: DOCUMENTS,
  readings: READINGS,
};

export type BaseOilOnboardingPatch = typeof BASE_OIL_ONBOARDING_PATCH;

export function baseOilOnboardingPatchHash(): string {
  return createHash("sha256")
    .update(canonicalJson(BASE_OIL_ONBOARDING_PATCH), "utf8")
    .digest("hex");
}

/** Every Specification is born NEEDS_REVIEW — ADR-018 §4. No code path here writes APPROVED. */
export const PATCH_REVIEW_STATUS = TechnicalReviewStatus.NEEDS_REVIEW;

/** SN 350 gets identity only — see the doc comment above. Exported so the executor and its
 * tests can assert zero readings exist for it without re-deriving the key. */
export const IDENTITY_ONLY_GRADE_KEY = gradeKey("Base Oil Group I", "SN 350");
