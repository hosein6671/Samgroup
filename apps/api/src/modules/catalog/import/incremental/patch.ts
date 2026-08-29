import {
  EvidenceRole,
  MappingConfidence,
  ResultBasis,
  SpecValueType,
  TechnicalReviewStatus,
} from "../../../../prisma/generated/enums";

import * as ids from "../apply/identities";
import { specPropertyMappingRows, specPropertyRows } from "../apply/reference-data";

export const COOLANT_NORMALIZATION_PATCH_ID = "coolant-source-layout-v1";
export const INCREMENTAL_IMPORTER_VERSION = "catalog-incremental/1.0.0";

export interface PatchFact {
  readonly sourceFactId: string;
  readonly productSourceRef: string;
  readonly documentTitle: string;
  readonly rawProperty: string;
  readonly rawUnit: string;
  readonly rawValue: string;
  readonly rawMethod: string;
  readonly propertyKey: string;
  readonly unit: string | null;
  readonly valueType: SpecValueType;
  readonly numericMin: string;
  readonly numericMax: string | null;
  readonly sortOrder: number;
}

export interface CoolantNormalizationPatch {
  readonly schemaVersion: 1;
  readonly patchId: typeof COOLANT_NORMALIZATION_PATCH_ID;
  readonly importerVersion: typeof INCREMENTAL_IMPORTER_VERSION;
  readonly facts: readonly PatchFact[];
}

export interface PatchSpecification {
  readonly id: string;
  readonly productId: string;
  readonly productGradeId: null;
  readonly propertyKey: string;
  readonly key: string;
  readonly value: string;
  readonly unit: string | null;
  readonly displayValue: string;
  readonly valueType: SpecValueType;
  readonly numericMin: string;
  readonly numericMax: string | null;
  readonly pairFirst: null;
  readonly pairSecond: null;
  readonly method: string;
  readonly qualifier: null;
  readonly resultBasis: ResultBasis;
  readonly reviewStatus: TechnicalReviewStatus;
  readonly sortOrder: number;
}

export interface PatchEvidence {
  readonly specificationId: string;
  readonly sourceFactId: string;
  readonly role: EvidenceRole;
}

export const COOLANT_NORMALIZATION_PATCH: CoolantNormalizationPatch = {
  schemaVersion: 1,
  patchId: COOLANT_NORMALIZATION_PATCH_ID,
  importerVersion: INCREMENTAL_IMPORTER_VERSION,
  facts: [
    {
      sourceFactId: "303708ae-c50c-5d3d-b6ee-03bd70133f65",
      productSourceRef: "SAMCAT-W1-R294",
      documentTitle: "KP-COOL TECH",
      rawProperty: "Reserve alkalinity",
      rawUnit: "ml 0.1 N.",
      rawValue: "18",
      rawMethod: "ASTM D1121",
      propertyKey: "coolant_reserve_alkalinity",
      unit: "mL 0.100 N HCl",
      valueType: SpecValueType.POINT,
      numericMin: "18",
      numericMax: null,
      sortOrder: 1,
    },
    {
      sourceFactId: "573268d7-151c-5847-bf07-ccd3b3680a49",
      productSourceRef: "SAMCAT-W1-R294",
      documentTitle: "KP-COOL TECH",
      rawProperty: "PH 33% Vol in water",
      rawUnit: "HCL",
      rawValue: "7.5-7.8",
      rawMethod: "ASTM D1287",
      propertyKey: "coolant_ph_33pct_water",
      unit: null,
      valueType: SpecValueType.RANGE,
      numericMin: "7.5",
      numericMax: "7.8",
      sortOrder: 2,
    },
    {
      sourceFactId: "caa8e2e1-1ad8-57ef-a162-eff6ae5b3cf3",
      productSourceRef: "SAMCAT-W1-R297",
      documentTitle: "KP-LONG LIFE TECH",
      rawProperty: "Reserve alkalinity",
      rawUnit: "ml 0.1 N.",
      rawValue: "5.6",
      rawMethod: "ASTM D1121",
      propertyKey: "coolant_reserve_alkalinity",
      unit: "mL 0.100 N HCl",
      valueType: SpecValueType.POINT,
      numericMin: "5.6",
      numericMax: null,
      sortOrder: 1,
    },
    {
      sourceFactId: "8bc33191-9c9b-5911-9f49-002737730d54",
      productSourceRef: "SAMCAT-W1-R297",
      documentTitle: "KP-LONG LIFE TECH",
      rawProperty: "PH 33% Vol in water",
      rawUnit: "HCL",
      rawValue: "8.5",
      rawMethod: "ASTM D1287",
      propertyKey: "coolant_ph_33pct_water",
      unit: null,
      valueType: SpecValueType.POINT,
      numericMin: "8.5",
      numericMax: null,
      sortOrder: 2,
    },
  ],
};

export const PATCH_PROPERTY_KEYS = [
  "coolant_reserve_alkalinity",
  "coolant_ph_33pct_water",
] as const;

export function patchProperties(): ReturnType<typeof specPropertyRows> {
  const wanted = new Set<string>(PATCH_PROPERTY_KEYS);
  return specPropertyRows().filter((row) => wanted.has(row.key));
}

export function patchMappings(): ReturnType<typeof specPropertyMappingRows> {
  const wanted = new Set(COOLANT_NORMALIZATION_PATCH.facts.map((fact) => fact.rawProperty));
  return specPropertyMappingRows().filter(
    (row) => row.rawUnit === null && wanted.has(row.rawProperty),
  );
}

export function patchSpecifications(): PatchSpecification[] {
  return COOLANT_NORMALIZATION_PATCH.facts.map((fact) => ({
    id: ids.specificationId(fact.productSourceRef, null, fact.propertyKey),
    productId: ids.productId(fact.productSourceRef),
    productGradeId: null,
    propertyKey: fact.propertyKey,
    key: fact.propertyKey,
    value: fact.rawValue,
    unit: fact.unit,
    displayValue: fact.rawValue,
    valueType: fact.valueType,
    numericMin: fact.numericMin,
    numericMax: fact.numericMax,
    pairFirst: null,
    pairSecond: null,
    method: fact.rawMethod,
    qualifier: null,
    resultBasis: ResultBasis.AVERAGE,
    reviewStatus: TechnicalReviewStatus.NEEDS_REVIEW,
    sortOrder: fact.sortOrder,
  }));
}

export function patchEvidence(): PatchEvidence[] {
  return COOLANT_NORMALIZATION_PATCH.facts.map((fact) => ({
    specificationId: ids.specificationId(fact.productSourceRef, null, fact.propertyKey),
    sourceFactId: fact.sourceFactId,
    role: EvidenceRole.PRIMARY,
  }));
}

export const LEGACY_MAPPING_STATE = {
  "Reserve alkalinity": {
    confidence: MappingConfidence.MEDIUM,
    specPropertyKey: null,
    reviewStatus: TechnicalReviewStatus.SOURCE_RECORDED,
    note: "Source prints the unit split across two rows ('ml 0.1 N.'); the reagent name is missing.",
  },
  "PH 33% Vol in water": {
    confidence: MappingConfidence.MEDIUM,
    specPropertyKey: null,
    reviewStatus: TechnicalReviewStatus.SOURCE_RECORDED,
    note: "Source prints 'HCL' in the unit cell. pH is dimensionless; HCl is a reagent, not a unit.",
  },
} as const;
