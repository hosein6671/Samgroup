/**
 * Turns the authoritative workbook plus the reviewed source datasets into a complete,
 * deterministic plan — and writes nothing.
 *
 * ── Determinism ─────────────────────────────────────────────────────────────
 *
 * Nothing in here reads the clock, generates a uuid, iterates an unordered structure or
 * depends on locale. Rows come out in workbook order, facts in dataset order, flags in the
 * order the checks run. Two runs over the same inputs produce byte-identical output, which
 * is what makes the manifest hash meaningful.
 *
 * ── What an action means, and what it deliberately does not ─────────────────
 *
 * `action` is about the PRODUCT ROW and nothing else:
 *
 *   SKIP      the ledger already has this row, its identity is settled and its evidence is
 *             unchanged. There is nothing to write.
 *   UPDATE    the ledger has this row and something about it changed.
 *   INSERT    a row the ledger does not have.
 *   CONFLICT  something must be decided before the PRODUCT ROW ITSELF can be written — its
 *             identity is not settled, its slug collides, or it has no Product Family and
 *             `products.category_id` is NOT NULL.
 *
 * A withheld specification, an unmapped property, an unclassified grade or a claim that
 * cannot be attributed does NOT make the product a CONFLICT. Those are child-level findings
 * with their own counters, and folding them into one product-level verdict is what made the
 * previous report unreadable: "CONFLICT 39" said nothing about whether 39 products were
 * blocked or 39 products merely had a fact withheld.
 *
 * ── Nothing is ever approved ────────────────────────────────────────────────
 *
 * No code path here produces `APPROVED`, and no input could ask for one. Rows come out
 * `SOURCE_RECORDED`, or `NEEDS_REVIEW` when something was found. When a ledger is replayed
 * and the evidence behind a row has changed, the prior approval is reported as invalidated —
 * a fact whose evidence moved is not the fact that was approved.
 */

import { createHash } from "node:crypto";

import {
  ExtractionMethod,
  ResultBasis,
  SourceUnitClassification,
  TechnicalReviewStatus,
} from "../../../prisma/generated/enums";

import { classifyClaim } from "./claim-classification";
import { ENTRIES_BY_WORKBOOK_ROW, WORKBOOK_DOCUMENT_KEY } from "./data/source-catalog.data";
import { decideGrades } from "./grade-classification";
import { resolveIdentities } from "./identity-ledger";
import { checkSlugNamespace, proposeSlug } from "./slug-proposal";
import {
  buildDocumentInventory,
  checkDocumentIntegrity,
  partitionByEvidence,
} from "./source-documents";
import { normalizeNameForMatching } from "./source-ref";
import { SPEC_PROPERTY_SEED, resolveProperty } from "./spec-property-dictionary";
import { decideSpecificationCandidate } from "./specification-candidates";
import { mapTaxonomy } from "./taxonomy-mapping";
import { classifyUnit, normalizeValue } from "./value-normalization";
import { sourceFamilyOf } from "./workbook-parser";

import type {
  ConflictCategory,
  EntityActionCounts,
  ImportAction,
  ImportPlan,
  PlanCounts,
  PlanFlag,
  PlannedClaim,
  PlannedGrade,
  PlannedProduct,
  PlannedSourceFact,
  PlannedSpecification,
  PlannedTechnicalFact,
  RawClaim,
  SourceCorrection,
  TechnicalFactCounts,
  UnmappedProperty,
  WorkbookProductRow,
} from "./catalog-import.types";
import type { IdentityAssignment, LedgerEntry } from "./identity-ledger";
import type { DocumentCitation } from "./source-documents";
import type { ParsedWorkbook } from "./workbook-parser";

/**
 * Bumped whenever a change here would alter the plan for unchanged inputs. It is recorded on
 * every `ImportRun` and is part of the manifest hash, so a plan that changed because the
 * importer changed is distinguishable from one that changed because the sources did.
 */
export const IMPORTER_VERSION = "catalog-importer/2.0.0";

/** When the workbook was read. A constant, never `new Date()` — the plan is hashed. */
export const WORKBOOK_RETRIEVED_AT = "2026-08-22T00:00:00.000Z";

const ALLOWED_UNITS_BY_KEY = new Map(
  SPEC_PROPERTY_SEED.map((property) => [property.key, property.allowedUnits]),
);

/**
 * The properties whose METHOD reports a coupled pair — the three ASTM D892 foaming
 * sequences, and nothing else. `5/0` is a pair only because the property says so; the same
 * shape under a viscosity property is the Persian decimal-separator defect, and
 * `value-normalization` must not be allowed to confuse the two.
 */
const PAIR_VALUED_KEYS: ReadonlySet<string> = new Set(
  SPEC_PROPERTY_SEED.filter((property) => property.quantity === "volume_ratio").map(
    (property) => property.key,
  ),
);

/**
 * Conflict categories that stop the PRODUCT ROW itself from being written. Identity, because
 * an unsettled reference would attach facts to the wrong product; slug, because ADR-011
 * rejects the write; taxonomy, because `products.category_id` is NOT NULL and a product with
 * no Product Family has nothing to point it at.
 */
export const PRODUCT_BLOCKING_CATEGORIES: readonly ConflictCategory[] = [
  "IDENTITY",
  "SLUG",
  "TAXONOMY",
];

const ALL_CONFLICT_CATEGORIES: readonly ConflictCategory[] = [
  "IDENTITY",
  "SLUG",
  "TAXONOMY",
  "GRADE",
  "SPECIFICATION",
  "CLAIM",
  "PROVENANCE",
];

/**
 * Performance designations readable out of a product NAME, with the body that owns them.
 * Deliberately narrow: only designations whose standards body is unambiguous are read. An
 * OEM fluid designation such as `DEX III`, `SP-4` or `AL-4` names no body that can be
 * recorded, so it is reported rather than guessed at.
 *
 * `نوع محصول` yields NO claim. Its values — `بنزینی` (gasoline), `دیزلی` (diesel) — name a
 * FUEL, not a performance class, and reading a classification out of one would invent it.
 */
const NAME_DESIGNATION_PATTERNS: readonly { readonly body: string; readonly source: string }[] = [
  { body: "API", source: "\\bC[A-K]-?\\d?\\b" },
  { body: "API", source: "\\bS[A-N]\\b" },
  { body: "API", source: "\\bGL-?[1-5]\\b" },
  { body: "ISO", source: "\\bISO VG \\d{1,4}\\b" },
];

/** Names that ARE a designation but name no attributable standards body. */
const UNATTRIBUTABLE_NAME_DESIGNATIONS: readonly string[] = [
  "DCT",
  "DEX VI",
  "DEX III",
  "SP-4",
  "CVT",
  "MV",
  "AL-4",
  "ATF Grade",
  "GL-I Grade",
];

function readNameDesignations(name: string): { body: string; code: string }[] {
  const found: { body: string; code: string }[] = [];
  const seen = new Set<string>();
  for (const { body, source } of NAME_DESIGNATION_PATTERNS) {
    // A fresh RegExp per call: a shared /g regex carries lastIndex between calls and would
    // skip matches on every second row.
    for (const match of name.matchAll(new RegExp(source, "g"))) {
      const code = match[0];
      if (seen.has(code)) continue;
      seen.add(code);
      found.push({ body, code });
    }
  }
  return found;
}

function workbookSourceFact(
  row: WorkbookProductRow,
  columnLabel: string,
  rawValue: string,
): PlannedSourceFact {
  return {
    documentKey: WORKBOOK_DOCUMENT_KEY,
    sheetName: row.sheetName,
    pageNumber: null,
    rowNumber: row.rowNumber,
    columnLabel,
    rawProperty: columnLabel,
    rawUnit: null,
    rawValue,
    rawMethod: null,
    rawGrade: null,
    extractionMethod: ExtractionMethod.SPREADSHEET_CELL,
    unitClassification: SourceUnitClassification.DIMENSIONLESS,
    resultBasisOverride: null,
  };
}

export interface PlanInput {
  readonly workbook: ParsedWorkbook;
  readonly workbookFileName: string;
  readonly workbookSha256: string;
  readonly workbookByteSize: number;
  /** Whether this plan came from the owner's workbook or from the frozen CI fixture. */
  readonly workbookProvenance?: "AUTHORITATIVE_WORKBOOK" | "FROZEN_FIXTURE";
  /** Live `product_slug_claims.slug_key` values, so a namespace collision is seen up front. */
  readonly existingSlugKeys: ReadonlySet<string>;
  /** A frozen identity ledger, replayed for identity. Empty on a first generation. */
  readonly ledger?: readonly LedgerEntry[];
}

interface RowPlanResult {
  readonly product: PlannedProduct;
  readonly unmapped: readonly { rawProperty: string; rawUnit: string; reason: string }[];
}

function planRow(row: WorkbookProductRow, identity: IdentityAssignment): RowPlanResult {
  const flags: PlanFlag[] = identity.flags.map((flag) => ({ ...flag, category: "IDENTITY" }));
  const unmapped: { rawProperty: string; rawUnit: string; reason: string }[] = [];

  const slug = proposeSlug(row.rowNumber, row.name);
  const taxonomy = mapTaxonomy(row);
  const entry = ENTRIES_BY_WORKBOOK_ROW.get(row.rowNumber);
  const family = sourceFamilyOf(row);
  const isAdditive = taxonomy.productTypeKey === "lubricant-additives";

  if (taxonomy.conflict) {
    flags.push({
      code: taxonomy.categoryRecognised
        ? "TAXONOMY_FAMILY_UNRESOLVED"
        : "TAXONOMY_CATEGORY_UNKNOWN",
      severity: "conflict",
      category: "TAXONOMY",
      detail: taxonomy.conflict,
    });
  }

  if (!entry) {
    flags.push({
      code: "SOURCE_NOT_TRANSCRIBED",
      severity: "conflict",
      category: "PROVENANCE",
      detail:
        `No reviewed source dataset covers workbook row ${String(row.rowNumber)}. The product ` +
        `would be created with no technical data and no evidence.`,
    });
  }

  if (entry?.entryNote) {
    flags.push({
      code: "SOURCE_ENTRY_NOTE",
      severity: "review",
      category: "PROVENANCE",
      detail: entry.entryNote,
    });
  }

  // ── Grades ────────────────────────────────────────────────────────────────
  const decisions = decideGrades(row.rowNumber, entry?.grades ?? []);
  const grades: PlannedGrade[] = [];
  const acceptedLabels = new Set<string>();
  let gradeOrder = 0;
  for (const decision of decisions) {
    flags.push(...decision.flags.map((flag) => ({ ...flag, category: "GRADE" as const })));
    if (!decision.accepted) continue;
    acceptedLabels.add(decision.label);
    grades.push({
      label: decision.label,
      gradeSystem: decision.gradeSystem,
      sortOrder: gradeOrder++,
    });
  }

  // ── Technical facts, and the subset of them that may become Specifications ─
  const technicalFacts: PlannedTechnicalFact[] = [];
  const propertyKeysSeen = new Set<string>();
  let specOrder = 0;

  for (const fact of entry?.facts ?? []) {
    const factFlags: PlanFlag[] = [];
    const resolution = resolveProperty(fact.rawProperty, fact.rawUnit);

    if (resolution.outcome !== "resolved") {
      const reason =
        resolution.outcome === "unknown"
          ? "No mapping exists for this source label."
          : resolution.outcome === "element-content"
            ? (resolution.note ?? "Elemental content; modelled as element plus unit.")
            : `Mapping is ${String(resolution.confidence)} confidence and not approved.` +
              (resolution.note ? ` ${resolution.note}` : "");
      unmapped.push({ rawProperty: fact.rawProperty, rawUnit: fact.rawUnit, reason });
      factFlags.push({
        code:
          resolution.outcome === "unknown"
            ? "PROPERTY_UNKNOWN"
            : resolution.outcome === "element-content"
              ? "PROPERTY_ELEMENT_CONTENT"
              : "PROPERTY_MAPPING_NOT_APPROVED",
        severity: "conflict",
        category: "SPECIFICATION",
        detail: `"${fact.rawProperty}"${fact.rawUnit ? ` (${fact.rawUnit})` : ""}: ${reason}`,
      });
    } else if (resolution.propertyKey) {
      propertyKeysSeen.add(resolution.propertyKey);
    }

    const normalized = normalizeValue(fact.rawValue, {
      allowPair: resolution.propertyKey !== null && PAIR_VALUED_KEYS.has(resolution.propertyKey),
    });
    factFlags.push(
      ...normalized.flags.map((flag) => ({ ...flag, category: "SPECIFICATION" as const })),
    );
    const valueUnreadable = normalized.flags.some((flag) => flag.severity === "conflict");

    const allowedUnits = resolution.propertyKey
      ? (ALLOWED_UNITS_BY_KEY.get(resolution.propertyKey) ?? null)
      : null;
    const unitClassification = classifyUnit(fact.rawUnit, allowedUnits);
    if (unitClassification === "ABSENT" && allowedUnits && allowedUnits.length > 0) {
      factFlags.push({
        code: "UNIT_BLANK_IN_SOURCE",
        severity: "review",
        category: "SPECIFICATION",
        detail:
          `"${fact.rawProperty}" normally carries a unit and the source cell is empty. ` +
          `Imported blank; the unit is NOT filled in from the method.`,
      });
    }
    if (unitClassification === "UNRECOGNIZED") {
      factFlags.push({
        code: "UNIT_UNRECOGNIZED",
        severity: "conflict",
        category: "SPECIFICATION",
        detail:
          `"${fact.rawUnit}" is not an allowed unit for ` +
          `${resolution.propertyKey ?? fact.rawProperty}. Stored as printed; not converted.`,
      });
    }
    if (fact.note) {
      factFlags.push({
        code: "SOURCE_NOTE",
        severity: "review",
        category: "PROVENANCE",
        detail: fact.note,
      });
    }

    // A fact whose grade label was rejected is a PRODUCT-level fact, not an orphan.
    const gradeLabel = fact.rawGrade && acceptedLabels.has(fact.rawGrade) ? fact.rawGrade : null;

    const sourceFact: PlannedSourceFact = {
      documentKey: entry?.documentKey ?? WORKBOOK_DOCUMENT_KEY,
      sheetName: null,
      pageNumber: fact.pageNumber,
      rowNumber: null,
      columnLabel: fact.columnLabel,
      rawProperty: fact.rawProperty,
      rawUnit: fact.rawUnit === "" ? null : fact.rawUnit,
      rawValue: fact.rawValue,
      rawMethod: fact.rawMethod === "" ? null : fact.rawMethod,
      rawGrade: fact.rawGrade === "" ? null : fact.rawGrade,
      extractionMethod: entry?.extractionMethod ?? ExtractionMethod.MANUAL_TRANSCRIPTION,
      unitClassification,
      resultBasisOverride: null,
    };

    const decision = decideSpecificationCandidate({
      propertyOutcome: resolution.outcome,
      propertyKey: resolution.propertyKey,
      displayValue: fact.rawValue,
      valueType: normalized.valueType,
      numericMin: normalized.numericMin,
      numericMax: normalized.numericMax,
      pairFirst: normalized.pairFirst,
      pairSecond: normalized.pairSecond,
      valueUnreadable,
    });

    let specification: PlannedSpecification | null = null;
    if (decision.emit && resolution.propertyKey !== null) {
      specification = {
        gradeLabel,
        propertyKey: resolution.propertyKey,
        displayValue: fact.rawValue,
        valueType: normalized.valueType,
        numericMin: normalized.numericMin,
        numericMax: normalized.numericMax,
        pairFirst: normalized.pairFirst,
        pairSecond: normalized.pairSecond,
        unit: fact.rawUnit === "" ? null : fact.rawUnit,
        method: fact.rawMethod === "" ? null : fact.rawMethod,
        qualifier: resolution.qualifier,
        resultBasis: entry?.defaultResultBasis ?? ResultBasis.UNSPECIFIED,
        sortOrder: specOrder++,
      };
    } else if (decision.withholdReason === "VALUE_SHAPE_REJECTED_BY_DATABASE") {
      factFlags.push({
        code: "SPECIFICATION_WITHHELD_DATABASE_SHAPE",
        severity: "conflict",
        category: "SPECIFICATION",
        detail: `${decision.detail ?? ""} ${decision.violations.join(" ")}`.trim(),
      });
    }

    technicalFacts.push({
      sourceFact,
      gradeLabel,
      resolvedPropertyKey: resolution.propertyKey,
      specification,
      withheldReason: decision.withholdReason,
      withheldDetail: decision.detail,
      shapeViolations: decision.violations,
      flags: factFlags,
    });
  }

  // ── Claims ────────────────────────────────────────────────────────────────
  const claims: PlannedClaim[] = [];
  let claimOrder = 0;

  for (const designation of readNameDesignations(row.name)) {
    const raw: RawClaim = {
      sourceText: row.name,
      standardBody: designation.body,
      standardCode: designation.code,
      pageNumber: null,
    };
    const decision = classifyClaim(raw, isAdditive);
    claims.push({
      gradeLabel: null,
      kind: decision.kind,
      standardBody: decision.standardBody,
      standardCode: decision.standardCode,
      contextNote: decision.contextNote,
      sortOrder: claimOrder++,
      sourceFact: workbookSourceFact(row, "نام محصول", row.name),
      flags: decision.flags.map((flag) => ({ ...flag, category: "CLAIM" as const })),
    });
  }

  if (UNATTRIBUTABLE_NAME_DESIGNATIONS.includes(row.name)) {
    flags.push({
      code: "NAME_DESIGNATION_NO_BODY",
      severity: "review",
      category: "CLAIM",
      detail:
        `The product name "${row.name}" is itself a fluid designation, but it names no ` +
        `standards body that can be recorded. No classification claim is derived from it.`,
    });
  }

  for (const raw of entry?.claims ?? []) {
    const decision = classifyClaim(raw, isAdditive);
    const claimFlags: PlanFlag[] = decision.flags.map((flag) => ({
      ...flag,
      category: "CLAIM" as const,
    }));
    if (raw.note) {
      claimFlags.push({
        code: "SOURCE_NOTE",
        severity: "review",
        category: "PROVENANCE",
        detail: raw.note,
      });
    }
    claims.push({
      gradeLabel: null,
      kind: decision.kind,
      standardBody: decision.standardBody,
      standardCode: decision.standardCode,
      contextNote: decision.contextNote,
      sortOrder: claimOrder++,
      sourceFact: {
        documentKey: raw.documentKey ?? entry?.documentKey ?? WORKBOOK_DOCUMENT_KEY,
        sheetName: null,
        pageNumber: raw.pageNumber,
        rowNumber: null,
        columnLabel: null,
        rawProperty: null,
        rawUnit: null,
        rawValue: raw.sourceText,
        rawMethod: null,
        rawGrade: null,
        extractionMethod: entry?.extractionMethod ?? ExtractionMethod.MANUAL_TRANSCRIPTION,
        unitClassification: SourceUnitClassification.DIMENSIONLESS,
        resultBasisOverride: null,
      },
      flags: claimFlags,
    });
  }

  const allFlags: PlanFlag[] = [
    ...flags,
    ...technicalFacts.flatMap((fact) => fact.flags),
    ...claims.flatMap((claim) => claim.flags),
  ];
  const needsReview = allFlags.some(
    (flag) => flag.severity === "conflict" || flag.severity === "review",
  );

  return {
    product: {
      sourceRef: identity.sourceRef,
      identityState: identity.state,
      identityCandidateSourceRefs: identity.candidateSourceRefs,
      identityEvidence: identity.evidence,
      // Provisional; `buildImportPlan` decides the final action once the slug namespace and
      // the evidence state are known. Kept here so a row is never left without one.
      action: "INSERT",
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      sourceName: row.rawName,
      publicProductName: row.name,
      normalizedName: normalizeNameForMatching(row.name),
      proposedSlug: slug.slug,
      slugIsRatified: slug.isRatified,
      excelCategory: row.categoryLabel,
      excelProductTypeLabel: row.productTypeLabel,
      sourceFamily: family,
      sourceLocator: row.technicalReferenceEn,
      proposedProductFamilyKey: taxonomy.productFamilyKey,
      proposedProductTypeKey: taxonomy.productTypeKey,
      proposedSegmentKeys: taxonomy.segmentKeys,
      grades,
      technicalFacts,
      claims,
      technicalPropertyCount: propertyKeysSeen.size,
      reviewStatus: needsReview
        ? TechnicalReviewStatus.NEEDS_REVIEW
        : TechnicalReviewStatus.SOURCE_RECORDED,
      flags,
    },
    unmapped,
  };
}

/** Every flag on a row, its children included. */
export function collectFlags(product: PlannedProduct): PlanFlag[] {
  return [
    ...product.flags,
    ...product.technicalFacts.flatMap((fact) => fact.flags),
    ...product.claims.flatMap((claim) => claim.flags),
  ];
}

/** True when a conflict on this row would stop the PRODUCT ROW itself from being written. */
export function hasProductBlockingConflict(product: PlannedProduct): boolean {
  return collectFlags(product).some(
    (flag) =>
      flag.severity === "conflict" &&
      flag.category !== undefined &&
      PRODUCT_BLOCKING_CATEGORIES.includes(flag.category),
  );
}

/**
 * The fingerprint of exactly what a reviewer would look at for one row: every raw source
 * reading plus the document it came from, sorted so insertion order cannot change it.
 *
 * Deliberately covers the RAW readings and not the normalized ones — re-normalizing an
 * unchanged reading is not new evidence, but a changed reading is, and only the second
 * should expire an approval.
 */
export function evidenceHashOf(product: PlannedProduct): string {
  const lines: string[] = [];
  for (const item of product.technicalFacts) {
    const fact = item.sourceFact;
    lines.push(
      [
        fact.documentKey,
        fact.pageNumber ?? "",
        fact.columnLabel ?? "",
        fact.rawProperty ?? "",
        fact.rawUnit ?? "",
        fact.rawValue,
        fact.rawMethod ?? "",
        fact.rawGrade ?? "",
      ].join(" "),
    );
  }
  for (const claim of product.claims) {
    lines.push([claim.sourceFact.documentKey, claim.sourceFact.rawValue].join(" "));
  }
  lines.sort();
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

export function buildImportPlan(input: PlanInput): ImportPlan {
  const ledger = input.ledger ?? [];
  const previousHashes = new Map(ledger.map((entry) => [entry.sourceRef, entry.evidenceHash]));
  const approvedRefs = new Set(
    ledger.filter((entry) => entry.approved === true).map((entry) => entry.sourceRef),
  );

  const resolution = resolveIdentities(
    input.workbook.rows,
    input.workbook.declaredSourceRefs,
    ledger,
  );

  const planned: PlannedProduct[] = [];
  const unmappedTally = new Map<string, UnmappedProperty>();

  for (const row of input.workbook.rows) {
    const identity = resolution.assignments.get(row.rowNumber);
    if (!identity) continue;

    const result = planRow(row, identity);
    let product = result.product;

    const known = identity.matchedEntry !== null;
    const previous = previousHashes.get(product.sourceRef);
    const current = evidenceHashOf(product);

    if (known && previous !== undefined && previous !== current) {
      const extra: PlanFlag = {
        code: approvedRefs.has(product.sourceRef)
          ? "APPROVAL_INVALIDATED_BY_EVIDENCE_CHANGE"
          : "EVIDENCE_CHANGED_SINCE_REVIEW",
        severity: "review",
        category: "PROVENANCE",
        detail:
          `The evidence behind this row changed since it was reviewed ` +
          `(${previous.slice(0, 12)} -> ${current.slice(0, 12)}).` +
          (approvedRefs.has(product.sourceRef)
            ? " Any prior approval no longer describes these facts and does not carry forward."
            : ""),
      };
      product = {
        ...product,
        reviewStatus: TechnicalReviewStatus.NEEDS_REVIEW,
        flags: [...product.flags, extra],
      };
    }

    planned.push({ ...product, action: known && previous === current ? "SKIP" : "INSERT" });

    for (const item of result.unmapped) {
      const key = `${item.rawProperty} ${item.rawUnit}`;
      const existing = unmappedTally.get(key);
      unmappedTally.set(key, {
        rawProperty: item.rawProperty,
        rawUnit: item.rawUnit === "" ? null : item.rawUnit,
        occurrences: (existing?.occurrences ?? 0) + 1,
        reason: item.reason,
      });
    }
  }

  // ── Slug namespace ────────────────────────────────────────────────────────
  const slugIssues = checkSlugNamespace(
    planned.map((product) => ({ rowNumber: product.rowNumber, slug: product.proposedSlug })),
    input.existingSlugKeys,
  );
  const duplicateSlug = slugIssues.filter(
    (issue) =>
      issue.code === "SLUG_COLLISION_WITHIN_IMPORT" ||
      issue.code === "SLUG_COLLISION_WITH_EXISTING",
  ).length;
  const rowsWithSlugIssues = new Set(slugIssues.flatMap((issue) => issue.rows));

  const withSlugFlags = planned.map((product) => {
    if (!rowsWithSlugIssues.has(product.rowNumber)) return product;
    const issues = slugIssues.filter((issue) => issue.rows.includes(product.rowNumber));
    return {
      ...product,
      reviewStatus: TechnicalReviewStatus.NEEDS_REVIEW,
      flags: [
        ...product.flags,
        ...issues.map((issue) => ({
          code: issue.code,
          severity: "conflict" as const,
          category: "SLUG" as const,
          detail: issue.detail,
        })),
      ],
    };
  });

  // ── The product-level action, decided last ────────────────────────────────
  // SKIP outranks CONFLICT: an already-imported, unchanged row is not re-proposed. Otherwise
  // a BLOCKING conflict wins, and only then does insert-versus-update apply.
  const products: PlannedProduct[] = withSlugFlags.map((product) => {
    const known = resolution.assignments.get(product.rowNumber)?.matchedEntry !== null;
    if (product.action === "SKIP" && !hasProductBlockingConflict(product)) return product;
    const action: ImportAction = hasProductBlockingConflict(product)
      ? "CONFLICT"
      : known
        ? "UPDATE"
        : "INSERT";
    return { ...product, action };
  });

  // ── Documents ─────────────────────────────────────────────────────────────
  const inventory = buildDocumentInventory(input.workbook.rows, {
    fileName: input.workbookFileName,
    sha256: input.workbookSha256,
    byteSize: input.workbookByteSize,
    retrievedAt: WORKBOOK_RETRIEVED_AT,
  });

  const citations: DocumentCitation[] = [];
  for (const product of products) {
    for (const fact of product.technicalFacts) {
      citations.push({ documentKey: fact.sourceFact.documentKey, citationKind: "technical" });
    }
    for (const claim of product.claims) {
      citations.push({ documentKey: claim.sourceFact.documentKey, citationKind: "claim" });
    }
  }
  // A candidate becomes a row only when evidence cites it. The 50 King Power pages nothing was
  // read from stay in the manifest as provenance locators and are never written.
  const { planned: plannedDocuments, provenanceLocators } = partitionByEvidence(
    inventory,
    citations,
  );
  const documentIntegrity = checkDocumentIntegrity(
    plannedDocuments,
    citations,
    new Set(inventory.productPageKeyByRow.values()),
    provenanceLocators,
  );

  // ── Corrections ───────────────────────────────────────────────────────────
  const corrections: (SourceCorrection & { documentKey: string })[] = [];
  for (const product of products) {
    const entry = ENTRIES_BY_WORKBOOK_ROW.get(product.rowNumber);
    if (!entry) continue;
    for (const correction of entry.corrections ?? []) {
      corrections.push({ ...correction, documentKey: entry.documentKey });
    }
  }

  // ── Duplicate identity ────────────────────────────────────────────────────
  const refTally = new Map<string, number>();
  for (const product of products) {
    refTally.set(product.sourceRef, (refTally.get(product.sourceRef) ?? 0) + 1);
  }
  const duplicateIdentity = [...refTally.values()].filter((count) => count > 1).length;

  return {
    importerVersion: IMPORTER_VERSION,
    workbook: {
      fileName: input.workbookFileName,
      sha256: input.workbookSha256,
      byteSize: input.workbookByteSize,
      sheetName: input.workbook.sheetName,
      provenance: input.workbookProvenance ?? "AUTHORITATIVE_WORKBOOK",
    },
    products,
    counts: countPlan(
      products,
      duplicateIdentity,
      duplicateSlug,
      unmappedTally,
      inventory.locatorMismatches.length,
    ),
    documents: plannedDocuments.map((entry) => entry.document),
    documentRetention: plannedDocuments.map((entry) => ({
      documentKey: entry.document.documentKey,
      retentionBasis: entry.retentionBasis,
      technicalFacts: entry.technicalFacts,
      claims: entry.claims,
    })),
    provenanceLocators,
    documentIntegrity,
    unmatchedLedgerEntries: resolution.unmatchedEntries,
    identityRatifiable: resolution.ratifiable,
    unmappedProperties: [...unmappedTally.values()].sort(
      (a, b) =>
        a.rawProperty.localeCompare(b.rawProperty, "en") ||
        (a.rawUnit ?? "").localeCompare(b.rawUnit ?? "", "en"),
    ),
    corrections,
  };
}

/**
 * The identity of a `source_facts` row: its document, its locator within that document, and
 * the raw text it holds. Deliberately not the product — a SourceFact belongs to a DOCUMENT,
 * and one workbook cell stating six designations is one row linked six times.
 */
export function sourceFactKey(fact: PlannedSourceFact): string {
  return [
    fact.documentKey,
    fact.sheetName ?? "",
    fact.pageNumber ?? "",
    fact.rowNumber ?? "",
    fact.columnLabel ?? "",
    fact.rawProperty ?? "",
    fact.rawUnit ?? "",
    fact.rawValue,
    fact.rawMethod ?? "",
    fact.rawGrade ?? "",
  ].join("\u0000");
}

function distinctSourceFacts(products: readonly PlannedProduct[]): number {
  const keys = new Set<string>();
  for (const product of products) {
    for (const fact of product.technicalFacts) keys.add(sourceFactKey(fact.sourceFact));
    for (const claim of product.claims) keys.add(sourceFactKey(claim.sourceFact));
  }
  return keys.size;
}

function countActions(products: readonly PlannedProduct[]): EntityActionCounts {
  return {
    insert: products.filter((product) => product.action === "INSERT").length,
    update: products.filter((product) => product.action === "UPDATE").length,
    skip: products.filter((product) => product.action === "SKIP").length,
    conflict: products.filter((product) => product.action === "CONFLICT").length,
  };
}

function countTechnical(products: readonly PlannedProduct[]): TechnicalFactCounts {
  const facts = products.flatMap((product) => product.technicalFacts);
  const conflictingLabels = new Map<string, number>();
  for (const fact of facts) {
    if (fact.withheldReason === null) continue;
    const label = `${fact.sourceFact.rawProperty ?? ""}|${fact.sourceFact.rawUnit ?? ""}`;
    conflictingLabels.set(label, (conflictingLabels.get(label) ?? 0) + 1);
  }
  const candidates = facts.filter((fact) => fact.specification !== null);
  return {
    rawTechnicalFacts: facts.length,
    highConfidenceMapped: facts.filter((fact) => fact.resolvedPropertyKey !== null).length,
    unmappedOrLowConfidence: facts.filter(
      (fact) =>
        fact.withheldReason === "PROPERTY_UNKNOWN" ||
        fact.withheldReason === "PROPERTY_MAPPING_NOT_APPROVED" ||
        fact.withheldReason === "PROPERTY_ELEMENT_CONTENT",
    ).length,
    validSpecificationCandidates: candidates.length,
    withheldFromSpecification: facts.filter((fact) => fact.specification === null).length,
    productLevelCandidates: candidates.filter((fact) => fact.gradeLabel === null).length,
    gradeLevelCandidates: candidates.filter((fact) => fact.gradeLabel !== null).length,
    missingPropertyReference: facts.filter(
      (fact) =>
        fact.withheldReason === "PROPERTY_UNKNOWN" ||
        fact.withheldReason === "PROPERTY_MAPPING_NOT_APPROVED" ||
        fact.withheldReason === "PROPERTY_ELEMENT_CONTENT",
    ).length,
    invalidValueShape: facts.filter(
      (fact) =>
        fact.withheldReason === "VALUE_SHAPE_UNREADABLE" ||
        fact.withheldReason === "VALUE_SHAPE_REJECTED_BY_DATABASE" ||
        fact.withheldReason === "DISPLAY_VALUE_EMPTY",
    ).length,
    conflictingRawLabels: conflictingLabels.size,
    factsUnderConflictingRawLabels: [...conflictingLabels.values()].reduce(
      (total, count) => total + count,
      0,
    ),
  };
}

function countPlan(
  products: readonly PlannedProduct[],
  duplicateIdentity: number,
  duplicateSlug: number,
  unmapped: ReadonlyMap<string, UnmappedProperty>,
  sourceRetrievalMismatch: number,
): PlanCounts {
  let gradesZero = 0;
  let gradesSingle = 0;
  let gradesMulti = 0;
  let gradeRecords = 0;
  let claims = 0;
  let unresolvedGrade = 0;
  let unresolvedClaim = 0;
  let unknownCategory = 0;
  let unknownProductType = 0;

  for (const product of products) {
    if (product.grades.length === 0) gradesZero++;
    else if (product.grades.length === 1) gradesSingle++;
    else gradesMulti++;
    gradeRecords += product.grades.length;
    claims += product.claims.length;

    if (product.grades.some((grade) => grade.gradeSystem === null)) unresolvedGrade++;
    if (
      product.claims.some((claim) => claim.flags.some((flag) => flag.severity === "conflict")) ||
      product.flags.some((flag) => flag.code === "NAME_DESIGNATION_NO_BODY")
    ) {
      unresolvedClaim++;
    }
    if (product.flags.some((flag) => flag.code === "TAXONOMY_CATEGORY_UNKNOWN")) unknownCategory++;
    if (product.proposedProductTypeKey === null) unknownProductType++;
  }

  const conflictsByCategory = Object.fromEntries(
    ALL_CONFLICT_CATEGORIES.map((category) => [
      category,
      products.filter((product) =>
        collectFlags(product).some(
          (flag) => flag.severity === "conflict" && flag.category === category,
        ),
      ).length,
    ]),
  ) as Record<ConflictCategory, number>;

  return {
    rowsParsed: products.length,
    products: countActions(products),
    technical: countTechnical(products),
    duplicateIdentity,
    duplicateSlug,
    unknownCategory,
    unknownProductType,
    unknownProperty: unmapped.size,
    unresolvedGrade,
    unresolvedClaim,
    sourceRetrievalMismatch,
    gradesZero,
    gradesSingle,
    gradesMulti,
    gradeRecords,
    claims,
    sourceFacts: distinctSourceFacts(products),
    specificationEvidenceLinks: products.reduce(
      (total, product) =>
        total + product.technicalFacts.filter((fact) => fact.specification !== null).length,
      0,
    ),
    claimEvidenceLinks: products.reduce((total, product) => total + product.claims.length, 0),
    conflictsByCategory,
  };
}
