/**
 * Every row the catalog apply would persist, as concrete column values.
 *
 * ── Why this is separate from `buildWritePlan` ──────────────────────────────
 *
 * `buildWritePlan` answers "which rows, under which identity" and is what the preflight
 * counts and the collision check run against. This file answers "with what in every column".
 * The two are kept apart because the first must stay cheap enough to run on every `--apply`
 * before anything is opened, and because a mistake in a column value must not be able to
 * change a count the operator has already confirmed.
 *
 * Both derive their identities from `identities.ts` and nothing else. There is one identity
 * implementation in this importer, and this file is a consumer of it.
 *
 * ── Pure, and deliberately so ───────────────────────────────────────────────
 *
 * Nothing here touches a database. The only external input is `ReferenceIds` — the ids of
 * rows that already exist and are never created by an import (the six Categories, the eight
 * Segments) — passed in, so the whole payload can be built, counted and asserted in a unit
 * test with no connection at all.
 *
 * ── Review status ───────────────────────────────────────────────────────────
 *
 * A Specification or a ProductClaim is written `NEEDS_REVIEW` when the planner attached a
 * conflict or review flag TO THAT ROW, and `SOURCE_RECORDED` otherwise. It is never
 * `APPROVED`: ADR-015 §10 keeps approval with a review service that does not exist yet, and
 * `assertRowsNeverApproved` fails the run rather than trusting that.
 *
 * The status is per row and not per product on purpose. A product with one entangled grade
 * label has one questionable reading, not fifteen, and marking all fifteen would bury the one
 * that needs a person.
 */

import {
  EvidenceRole,
  TechnicalReviewStatus,
  type ExtractionMethod,
  type GradeSystem,
  type ProductClaimKind,
  type ResultBasis,
  type SourceLocatorType,
  type SourceUnitClassification,
  type SpecValueType,
} from "../../../../prisma/generated/enums";

import { sourceFactKey } from "../import-planner";

import * as ids from "./identities";
import {
  productTypeRows,
  specPropertyMappingRows,
  specPropertyRows,
  type ProductTypeRow,
  type SpecPropertyMappingRow,
  type SpecPropertyRow,
} from "./reference-data";

import type {
  ImportPlan,
  PlanFlag,
  PlannedProduct,
  PlannedSourceFact,
} from "../catalog-import.types";

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly categoryId: string;
  readonly productTypeId: string | null;
  readonly sourceRef: string;
}

export interface ProductSegmentRow {
  readonly productId: string;
  readonly segmentId: string;
  /** Carried for messages only. The `(productId, segmentId)` pair is the identity. */
  readonly sourceRef: string;
  readonly segmentSlug: string;
}

export interface ProductGradeRow {
  readonly id: string;
  readonly productId: string;
  readonly label: string;
  readonly gradeSystem: GradeSystem | null;
  readonly sortOrder: number;
}

export interface SourceAssetRow {
  readonly id: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly mediaType: string;
  readonly pageCount: number | null;
}

export interface SourceDocumentRow {
  readonly id: string;
  readonly documentKey: string;
  readonly sourceAssetId: string | null;
  readonly locatorType: SourceLocatorType;
  readonly locatorValue: string;
  readonly publisher: string | null;
  readonly title: string;
  readonly revisionLabel: string | null;
  readonly retrievedAt: string;
  readonly defaultResultBasis: ResultBasis;
}

export interface SourceFactRow {
  readonly id: string;
  /** `sourceFactKey` of the planned reading — the natural key the database indexes. */
  readonly evidenceIdentity: string;
  readonly sourceDocumentId: string;
  readonly pageNumber: number | null;
  readonly sheetName: string | null;
  readonly rowNumber: number | null;
  readonly columnLabel: string | null;
  readonly rawProperty: string | null;
  readonly rawUnit: string | null;
  readonly rawValue: string;
  readonly rawMethod: string | null;
  readonly rawGrade: string | null;
  readonly extractionMethod: ExtractionMethod;
  readonly unitClassification: SourceUnitClassification;
  readonly resultBasisOverride: ResultBasis | null;
}

export interface SpecificationRow {
  readonly id: string;
  readonly productId: string;
  readonly productGradeId: string | null;
  readonly propertyKey: string;
  /** The legacy `key`/`value`/`unit` triple ADR-014 deliberately did not drop. */
  readonly key: string;
  readonly value: string;
  readonly unit: string | null;
  readonly displayValue: string;
  readonly valueType: SpecValueType;
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly pairFirst: string | null;
  readonly pairSecond: string | null;
  readonly method: string | null;
  readonly qualifier: string | null;
  readonly resultBasis: ResultBasis;
  readonly reviewStatus: TechnicalReviewStatus;
  readonly sortOrder: number | null;
}

export interface ProductClaimRow {
  readonly id: string;
  readonly productId: string;
  readonly productGradeId: string | null;
  readonly kind: ProductClaimKind;
  readonly standardBody: string | null;
  readonly standardCode: string | null;
  readonly contextNote: string | null;
  readonly claimIdentityHash: string;
  readonly reviewStatus: TechnicalReviewStatus;
  readonly sortOrder: number | null;
}

export interface EvidenceLinkRow {
  /** The Specification or ProductClaim this evidence supports. */
  readonly subjectId: string;
  /**
   * The evidence identity, NOT a fact id. The executor resolves it to whatever id the
   * database actually holds, so a fact inserted by an earlier run under a different id still
   * links correctly.
   */
  readonly evidenceIdentity: string;
  readonly role: EvidenceRole;
}

export interface ImportRunRow {
  readonly id: string;
  readonly importerVersion: string;
  readonly manifestHash: string;
  readonly note: string;
}

/** The ids of rows an import reconciles against and never creates. */
export interface ReferenceIds {
  readonly categoryIdBySlug: ReadonlyMap<string, string>;
  readonly segmentIdBySlug: ReadonlyMap<string, string>;
}

export interface ApplyRows {
  readonly specProperties: readonly SpecPropertyRow[];
  readonly specPropertyMappings: readonly SpecPropertyMappingRow[];
  readonly productTypes: readonly ProductTypeRow[];
  readonly importRun: ImportRunRow;
  readonly sourceAssets: readonly SourceAssetRow[];
  readonly sourceDocuments: readonly SourceDocumentRow[];
  readonly products: readonly ProductRow[];
  readonly productSegments: readonly ProductSegmentRow[];
  readonly productGrades: readonly ProductGradeRow[];
  readonly sourceFacts: readonly SourceFactRow[];
  readonly specifications: readonly SpecificationRow[];
  readonly productClaims: readonly ProductClaimRow[];
  readonly specificationEvidence: readonly EvidenceLinkRow[];
  readonly claimEvidence: readonly EvidenceLinkRow[];
}

export class ApplyRowsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyRowsError";
  }
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

/** A row the planner questioned is a row a person still has to look at. */
function statusFor(flags: readonly PlanFlag[]): TechnicalReviewStatus {
  return flags.some((flag) => flag.severity === "conflict" || flag.severity === "review")
    ? TechnicalReviewStatus.NEEDS_REVIEW
    : TechnicalReviewStatus.SOURCE_RECORDED;
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new ApplyRowsError(what);
  return value;
}

export function buildApplyRows(
  plan: ImportPlan,
  manifestHash: string,
  reference: ReferenceIds,
): ApplyRows {
  const productTypes = productTypeRows();
  const productTypeIdBySlug = new Map(productTypes.map((row) => [row.slug, row.id]));

  const sourceAssets = new Map<string, SourceAssetRow>();
  const sourceDocuments = new Map<string, SourceDocumentRow>();
  for (const document of plan.documents) {
    let assetId: string | null = null;
    if (document.sha256 !== null) {
      assetId = ids.sourceAssetId(document.sha256);
      sourceAssets.set(document.sha256, {
        id: assetId,
        sha256: document.sha256,
        byteSize: required(
          document.byteSize,
          `${document.documentKey}: a captured document carries no byte size.`,
        ),
        mediaType: required(
          document.mediaType,
          `${document.documentKey}: a captured document carries no media type.`,
        ),
        pageCount: document.pageCount,
      });
    }

    if (sourceDocuments.has(document.documentKey)) {
      throw new ApplyRowsError(`Document key ${document.documentKey} appears twice in the plan.`);
    }
    sourceDocuments.set(document.documentKey, {
      id: ids.sourceDocumentId(document.locatorType, document.locatorValue, document.sha256),
      documentKey: document.documentKey,
      sourceAssetId: assetId,
      locatorType: document.locatorType,
      locatorValue: document.locatorValue,
      publisher: document.publisher === "" ? null : document.publisher,
      title: document.title,
      revisionLabel: document.revisionLabel,
      retrievedAt: document.retrievedAt,
      defaultResultBasis: document.defaultResultBasis,
    });
  }

  const documentIdOf = (documentKey: string): string =>
    required(
      sourceDocuments.get(documentKey)?.id,
      `A reading cites document ${documentKey}, which the plan does not carry.`,
    );

  const products: ProductRow[] = [];
  const productSegments: ProductSegmentRow[] = [];
  const productGrades: ProductGradeRow[] = [];
  const sourceFacts = new Map<string, SourceFactRow>();
  const specifications: SpecificationRow[] = [];
  const productClaims: ProductClaimRow[] = [];
  const specificationEvidence: EvidenceLinkRow[] = [];
  const claimEvidence: EvidenceLinkRow[] = [];

  const rememberFact = (fact: PlannedSourceFact): string => {
    const identity = sourceFactKey(fact);
    sourceFacts.set(identity, {
      id: ids.sourceFactId(identity),
      evidenceIdentity: identity,
      sourceDocumentId: documentIdOf(fact.documentKey),
      pageNumber: fact.pageNumber,
      sheetName: fact.sheetName,
      rowNumber: fact.rowNumber,
      columnLabel: fact.columnLabel,
      rawProperty: fact.rawProperty,
      rawUnit: fact.rawUnit,
      rawValue: fact.rawValue,
      rawMethod: fact.rawMethod,
      rawGrade: fact.rawGrade,
      extractionMethod: fact.extractionMethod,
      unitClassification: fact.unitClassification,
      resultBasisOverride: fact.resultBasisOverride,
    });
    return identity;
  };

  for (const product of plan.products as readonly PlannedProduct[]) {
    const ref = product.sourceRef;
    const productId = ids.productId(ref);
    const familyKey = required(
      product.proposedProductFamilyKey,
      `${ref} has no Product Family. A Product is never written without its Category.`,
    );
    const categoryId = required(
      reference.categoryIdBySlug.get(familyKey),
      `${ref}: no Category exists with slug "${familyKey}". Categories are reconciled, ` +
        `never created by an import.`,
    );
    const productTypeId =
      product.proposedProductTypeKey === null
        ? null
        : required(
            productTypeIdBySlug.get(product.proposedProductTypeKey),
            `${ref}: "${product.proposedProductTypeKey}" is not an approved ProductType key.`,
          );

    products.push({
      id: productId,
      name: product.publicProductName,
      slug: product.proposedSlug,
      categoryId,
      productTypeId,
      sourceRef: ref,
    });

    for (const segmentSlug of product.proposedSegmentKeys) {
      productSegments.push({
        productId,
        segmentId: required(
          reference.segmentIdBySlug.get(segmentSlug),
          `${ref}: no Segment exists with slug "${segmentSlug}".`,
        ),
        sourceRef: ref,
        segmentSlug,
      });
    }

    const gradeIdByLabel = new Map<string, string>();
    for (const grade of product.grades) {
      const gradeId = ids.productGradeId(ref, grade.label);
      gradeIdByLabel.set(grade.label, gradeId);
      productGrades.push({
        id: gradeId,
        productId,
        label: grade.label,
        gradeSystem: grade.gradeSystem,
        sortOrder: grade.sortOrder,
      });
    }
    const gradeIdOf = (label: string | null): string | null =>
      label === null
        ? null
        : required(
            gradeIdByLabel.get(label),
            `${ref}: a row cites grade "${label}", which the plan does not carry.`,
          );

    for (const item of product.technicalFacts) {
      const identity = rememberFact(item.sourceFact);
      // Withheld: evidence, never a Specification. The reading above is recorded regardless.
      if (item.specification === null) continue;
      const spec = item.specification;
      const specId = ids.specificationId(ref, item.gradeLabel, spec.propertyKey);
      specifications.push({
        id: specId,
        productId,
        productGradeId: gradeIdOf(item.gradeLabel),
        propertyKey: spec.propertyKey,
        key: spec.propertyKey,
        value: spec.displayValue,
        unit: spec.unit,
        displayValue: spec.displayValue,
        valueType: spec.valueType,
        numericMin: spec.numericMin,
        numericMax: spec.numericMax,
        pairFirst: spec.pairFirst,
        pairSecond: spec.pairSecond,
        method: spec.method,
        qualifier: spec.qualifier,
        resultBasis: spec.resultBasis,
        reviewStatus: statusFor(item.flags),
        sortOrder: spec.sortOrder,
      });
      specificationEvidence.push({
        subjectId: specId,
        evidenceIdentity: identity,
        role: EvidenceRole.PRIMARY,
      });
    }

    for (const claim of product.claims) {
      const identity = rememberFact(claim.sourceFact);
      const hash = ids.claimIdentityHash(claim.sourceFact.rawValue);
      const claimId = ids.productClaimId(
        ref,
        claim.gradeLabel,
        claim.kind,
        claim.standardBody,
        claim.standardCode,
        hash,
      );
      productClaims.push({
        id: claimId,
        productId,
        productGradeId: gradeIdOf(claim.gradeLabel),
        kind: claim.kind,
        standardBody: claim.standardBody,
        standardCode: claim.standardCode,
        contextNote: claim.contextNote,
        claimIdentityHash: hash,
        reviewStatus: statusFor(claim.flags),
        sortOrder: claim.sortOrder,
      });
      claimEvidence.push({
        subjectId: claimId,
        evidenceIdentity: identity,
        role: EvidenceRole.PRIMARY,
      });
    }
  }

  return {
    specProperties: specPropertyRows(),
    specPropertyMappings: specPropertyMappingRows(),
    productTypes,
    importRun: {
      id: ids.importRunId(manifestHash),
      importerVersion: plan.importerVersion,
      manifestHash,
      note: `Catalog import of ${plan.workbook.fileName} (${plan.workbook.provenance}).`,
    },
    sourceAssets: [...sourceAssets.values()],
    sourceDocuments: [...sourceDocuments.values()],
    products,
    productSegments,
    productGrades,
    sourceFacts: [...sourceFacts.values()],
    specifications,
    productClaims,
    specificationEvidence,
    claimEvidence,
  };
}

/**
 * Refuses a payload that would publish something. Separate from `assertNothingApproved`,
 * which checks the PLAN: this checks the values that would actually reach a column.
 */
export function assertRowsNeverApproved(rows: ApplyRows): void {
  const permitted: readonly TechnicalReviewStatus[] = [
    TechnicalReviewStatus.SOURCE_RECORDED,
    TechnicalReviewStatus.NEEDS_REVIEW,
  ];
  const offenders = [
    ...rows.specifications.map((row) => [row.id, row.reviewStatus] as const),
    ...rows.productClaims.map((row) => [row.id, row.reviewStatus] as const),
    ...rows.specPropertyMappings.map((row) => [row.id, row.reviewStatus] as const),
  ].filter(([, status]) => !permitted.includes(status));

  if (offenders.length > 0) {
    const [id, status] = offenders[0] ?? ["", ""];
    throw new ApplyRowsError(
      `${String(offenders.length)} rows carry a review status the importer may never write ` +
        `(first: ${id} = ${status}). Only SOURCE_RECORDED and NEEDS_REVIEW are permitted; ` +
        `approval is a recorded human decision (ADR-015 §10).`,
    );
  }
}
