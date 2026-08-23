/**
 * Renders an `ImportPlan` as the reviewable import manifest, fingerprints it, and derives the
 * identity ledger from it.
 *
 * ── Two artefacts, two jobs ─────────────────────────────────────────────────
 *
 * The MANIFEST is what the owner reads: every product, what would happen to it, what was
 * withheld and why. It is generated in full on every run and is never hand-edited.
 *
 * The LEDGER is what the importer reads back: `sourceRef`, its state, the matching evidence
 * captured beside it, and the evidence hash. It is the identity authority once the owner
 * freezes it, and it is deliberately a separate, much smaller file — a reviewer must be able
 * to see the entire identity surface without reading 1,500 facts, and the importer must not
 * be able to read anything else back as if it were identity.
 *
 * ── Generated versus approved ───────────────────────────────────────────────
 *
 * Every field below is GENERATED. Exactly three things require a human decision, and none of
 * them is produced here:
 *
 *   1. RATIFICATION of a `sourceRef`. The importer emits `state: "PROPOSED"` and nothing
 *      else; a ledger entry only becomes `RATIFIED` when a person makes it so.
 *   2. every CONFLICT — the importer states the conflict and never resolves one.
 *   3. approval of any technical fact — the importer cannot express it. `reviewStatus` here
 *      is only ever `SOURCE_RECORDED` or `NEEDS_REVIEW`, and `assertNoApproval` fails the
 *      run if that is ever untrue.
 *
 * ── The hash ────────────────────────────────────────────────────────────────
 *
 * `manifestHash` is the SHA-256 of the canonical JSON of everything except the hash itself.
 * Canonical means object keys sorted, so a change in property emission order cannot change
 * it. Two runs over identical inputs must produce the same hash; a differing hash means
 * either the inputs or the importer changed, and the importer's version is inside the hash
 * so the two are distinguishable. Nothing environment-specific is in it: no absolute path,
 * no per-run timestamp, no connection string.
 */

import { createHash } from "node:crypto";

import { TechnicalReviewStatus } from "../../../prisma/generated/enums";

import { evidenceHashOf, sourceFactKey } from "./import-planner";

import type {
  ConflictCategory,
  ImportPlan,
  PlannedProduct,
  PlanFlag,
} from "./catalog-import.types";
import type { IdentityLedger, LedgerEntry } from "./identity-ledger";

/** One reviewable row of the manifest — the shape the gate enumerates, in that order. */
export interface ManifestRow {
  readonly sourceRef: string;
  /** Whether that reference is an identity yet. `PROPOSED` is not `RATIFIED`. */
  readonly identityState: string;
  readonly identityCandidateSourceRefs: readonly string[];
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly sourceName: string;
  readonly publicProductName: string;
  readonly normalizedName: string;
  readonly proposedSlug: string;
  readonly slugIsRatified: boolean;
  readonly excelCategory: string;
  readonly excelProductTypeLabel: string;
  readonly sourceType: string;
  readonly sourceLocator: string;
  readonly proposedProductFamilyKey: string | null;
  readonly proposedProductTypeKey: string | null;
  readonly proposedSegmentKeys: readonly string[];
  readonly gradeCandidates: readonly {
    readonly label: string;
    readonly gradeSystem: string | null;
  }[];
  readonly specificationCandidates: readonly {
    readonly propertyKey: string;
    readonly gradeLabel: string | null;
    readonly displayValue: string;
    readonly valueType: string;
    readonly unit: string | null;
    readonly method: string | null;
    readonly qualifier: string | null;
    readonly resultBasis: string;
  }[];
  readonly withheldSourceFacts: readonly {
    readonly rawProperty: string | null;
    readonly rawUnit: string | null;
    readonly rawValue: string;
    readonly rawMethod: string | null;
    readonly rawGrade: string | null;
    readonly documentKey: string;
    readonly reason: string;
    readonly violations: readonly string[];
  }[];
  readonly claimCandidates: readonly {
    readonly kind: string;
    readonly standardBody: string | null;
    readonly standardCode: string | null;
    readonly contextNote: string | null;
    readonly documentKey: string;
  }[];
  /** Every document this row's facts and claims cite, sorted. */
  readonly provenanceDocumentKeys: readonly string[];
  readonly technicalPropertyCount: number;
  readonly rawTechnicalFactCount: number;
  readonly specificationCandidateCount: number;
  readonly withheldFactCount: number;
  /** DISTINCT `source_facts` rows this product would insert. */
  readonly sourceFactCount: number;
  /** Conflicts separated by what they are about, so one does not hide the others. */
  readonly conflictsByCategory: Readonly<Record<ConflictCategory, number>>;
  readonly flags: readonly {
    readonly code: string;
    readonly severity: string;
    readonly category: string | null;
    readonly detail: string;
  }[];
  readonly reviewStatus: string;
  readonly action: string;
  /** Fingerprint of this row's raw evidence. Replayed to detect a changed source. */
  readonly evidenceHash: string;
}

export interface Manifest {
  readonly importerVersion: string;
  readonly workbook: ImportPlan["workbook"];
  readonly counts: ImportPlan["counts"];
  readonly identityRatifiable: boolean;
  readonly unmatchedLedgerEntries: ImportPlan["unmatchedLedgerEntries"];
  readonly rows: readonly ManifestRow[];
  readonly documents: ImportPlan["documents"];
  readonly documentRetention: ImportPlan["documentRetention"];
  readonly provenanceLocators: ImportPlan["provenanceLocators"];
  readonly documentIntegrity: ImportPlan["documentIntegrity"];
  readonly unmappedProperties: ImportPlan["unmappedProperties"];
  readonly corrections: ImportPlan["corrections"];
  /** Set on the emitted object; excluded from its own input. */
  readonly manifestHash: string;
}

function sourceTypeOf(product: PlannedProduct): string {
  switch (product.sourceFamily) {
    case "king-power":
      return "King Power product page + TDS (PDF)";
    case "hsb":
      return "HSB printed catalogue (PDF page)";
    case "addilex":
      return "Addilex product page carrying the specification sheet (image)";
    default:
      return "none";
  }
}

function countCategories(flags: readonly PlanFlag[]): Record<ConflictCategory, number> {
  const counts: Record<ConflictCategory, number> = {
    IDENTITY: 0,
    SLUG: 0,
    TAXONOMY: 0,
    GRADE: 0,
    SPECIFICATION: 0,
    CLAIM: 0,
    PROVENANCE: 0,
  };
  for (const flag of flags) {
    if (flag.severity !== "conflict" || flag.category === undefined) continue;
    counts[flag.category]++;
  }
  return counts;
}

function toManifestRow(product: PlannedProduct): ManifestRow {
  const allFlags: PlanFlag[] = [
    ...product.flags,
    ...product.technicalFacts.flatMap((fact) => fact.flags),
    ...product.claims.flatMap((claim) => claim.flags),
  ];
  const documentKeys = new Set<string>([
    ...product.technicalFacts.map((fact) => fact.sourceFact.documentKey),
    ...product.claims.map((claim) => claim.sourceFact.documentKey),
  ]);

  return {
    sourceRef: product.sourceRef,
    identityState: product.identityState,
    identityCandidateSourceRefs: product.identityCandidateSourceRefs,
    sheetName: product.sheetName,
    rowNumber: product.rowNumber,
    sourceName: product.sourceName,
    publicProductName: product.publicProductName,
    normalizedName: product.normalizedName,
    proposedSlug: product.proposedSlug,
    slugIsRatified: product.slugIsRatified,
    excelCategory: product.excelCategory,
    excelProductTypeLabel: product.excelProductTypeLabel,
    sourceType: sourceTypeOf(product),
    sourceLocator: product.sourceLocator,
    proposedProductFamilyKey: product.proposedProductFamilyKey,
    proposedProductTypeKey: product.proposedProductTypeKey,
    proposedSegmentKeys: product.proposedSegmentKeys,
    gradeCandidates: product.grades.map((grade) => ({
      label: grade.label,
      gradeSystem: grade.gradeSystem,
    })),
    specificationCandidates: product.technicalFacts.flatMap((fact) =>
      fact.specification === null
        ? []
        : [
            {
              propertyKey: fact.specification.propertyKey,
              gradeLabel: fact.specification.gradeLabel,
              displayValue: fact.specification.displayValue,
              valueType: fact.specification.valueType,
              unit: fact.specification.unit,
              method: fact.specification.method,
              qualifier: fact.specification.qualifier,
              resultBasis: fact.specification.resultBasis,
            },
          ],
    ),
    withheldSourceFacts: product.technicalFacts.flatMap((fact) =>
      fact.specification !== null
        ? []
        : [
            {
              rawProperty: fact.sourceFact.rawProperty,
              rawUnit: fact.sourceFact.rawUnit,
              rawValue: fact.sourceFact.rawValue,
              rawMethod: fact.sourceFact.rawMethod,
              rawGrade: fact.sourceFact.rawGrade,
              documentKey: fact.sourceFact.documentKey,
              reason: fact.withheldReason ?? "UNKNOWN",
              violations: fact.shapeViolations,
            },
          ],
    ),
    claimCandidates: product.claims.map((claim) => ({
      kind: claim.kind,
      standardBody: claim.standardBody,
      standardCode: claim.standardCode,
      contextNote: claim.contextNote,
      documentKey: claim.sourceFact.documentKey,
    })),
    provenanceDocumentKeys: [...documentKeys].sort(),
    technicalPropertyCount: product.technicalPropertyCount,
    rawTechnicalFactCount: product.technicalFacts.length,
    specificationCandidateCount: product.technicalFacts.filter(
      (fact) => fact.specification !== null,
    ).length,
    withheldFactCount: product.technicalFacts.filter((fact) => fact.specification === null).length,
    sourceFactCount: new Set([
      ...product.technicalFacts.map((fact) => sourceFactKey(fact.sourceFact)),
      ...product.claims.map((claim) => sourceFactKey(claim.sourceFact)),
    ]).size,
    conflictsByCategory: countCategories(allFlags),
    flags: allFlags.map((flag) => ({
      code: flag.code,
      severity: flag.severity,
      category: flag.category ?? null,
      detail: flag.detail,
    })),
    reviewStatus: product.reviewStatus,
    action: product.action,
    evidenceHash: evidenceHashOf(product),
  };
}

/**
 * Canonical JSON: object keys sorted at every depth, arrays kept in order. Array order is
 * meaningful here (workbook order, source order) and is never sorted.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

/**
 * Fails the run if any planned row carries an APPROVED status. The importer has no code path
 * that produces one; this asserts it rather than trusting it, because "the importer never
 * approves" is a safety property and not a comment.
 */
export function assertNoApproval(plan: ImportPlan): void {
  for (const product of plan.products) {
    if (
      product.reviewStatus !== TechnicalReviewStatus.SOURCE_RECORDED &&
      product.reviewStatus !== TechnicalReviewStatus.NEEDS_REVIEW
    ) {
      throw new Error(
        `Importer produced reviewStatus "${product.reviewStatus}" for ${product.sourceRef}. ` +
          `The importer may only ever emit SOURCE_RECORDED or NEEDS_REVIEW.`,
      );
    }
  }
}

export function buildManifest(plan: ImportPlan): Manifest {
  assertNoApproval(plan);
  const body = {
    importerVersion: plan.importerVersion,
    workbook: plan.workbook,
    counts: plan.counts,
    identityRatifiable: plan.identityRatifiable,
    unmatchedLedgerEntries: plan.unmatchedLedgerEntries,
    rows: plan.products.map(toManifestRow),
    documents: plan.documents,
    documentRetention: plan.documentRetention,
    provenanceLocators: plan.provenanceLocators,
    documentIntegrity: plan.documentIntegrity,
    unmappedProperties: plan.unmappedProperties,
    corrections: plan.corrections,
  };
  const manifestHash = createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
  return { ...body, manifestHash };
}

/**
 * Derives the identity ledger from a plan.
 *
 * Every entry comes out `PROPOSED`. The importer cannot ratify an identity: ratification is a
 * human act, recorded by the owner freezing this file and marking its entries `RATIFIED`.
 * A ledger entry a previous run already carried keeps whatever state it had — that is the
 * caller's merge to make, not this function's, and it is why nothing here reads a prior file.
 */
export function buildLedger(plan: ImportPlan, lineage = "W1"): IdentityLedger {
  const entries: LedgerEntry[] = plan.products.map((product) => ({
    sourceRef: product.sourceRef,
    state: "PROPOSED",
    sheetName: product.sheetName,
    rowNumber: product.rowNumber,
    exactName: product.publicProductName,
    normalizedName: product.normalizedName,
    categoryLabel: product.excelCategory,
    evidenceHash: evidenceHashOf(product),
  }));
  return { lineage, entries };
}

export function renderManifestJson(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function renderLedgerJson(ledger: IdentityLedger): string {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}
