/**
 * Shared types for the catalog importer.
 *
 * ── What this importer is, and what it is deliberately not ──────────────────
 *
 * It plans an import of the 100 authoritative Excel Products and writes NOTHING.
 * `--dry-run` is the only mode; there is no apply path, hidden or otherwise, and
 * `assertDryRunOnly` in `cli.ts` is what makes that true rather than a promise.
 *
 * ── Two classes of input, and why they are not the same thing ───────────────
 *
 * 1. The AUTHORITATIVE WORKBOOK is machine-parsed on every run (`xlsx-reader`,
 *    `workbook-parser`). It alone decides inclusion, the exact public name, the
 *    original category membership and the source row provenance.
 *
 * 2. The REVIEWED SOURCE DATASETS in `./data` are transcriptions of external
 *    documents — a supplier TDS, a printed catalogue page, a published
 *    specification image. They carry no source bytes, no images and no TDS
 *    files, only what those documents state, verbatim, with the locator needed
 *    to find the statement again. They are enrichment: a dataset entry for a
 *    row the workbook does not contain is ignored, never imported.
 *
 * The split matters because the two have different reproducibility. The
 * workbook re-parses byte-identically every run; a page read by eye does not,
 * which is exactly why the reading is frozen into a reviewable file rather than
 * repeated per run, and why every fact derived from one carries its
 * `extractionMethod`.
 *
 * ── Three ladders that must not be conflated ────────────────────────────────
 *
 *   IDENTITY      proposed -> ratified. `identity-ledger.ts` owns it.
 *   EVIDENCE      every extracted reading is a SourceFact, unconditionally.
 *   INTERPRETATION only a resolved property with a database-valid value shape
 *                  becomes a Specification. `specification-candidates.ts` owns it.
 *
 * A row can have a settled identity and withheld facts; it can have conflicting
 * taxonomy and perfectly valid specifications. Collapsing the three into one
 * per-product verdict is what made "CONFLICT 39" unreadable, and the counts
 * below are separated for that reason.
 */

import type {
  ExtractionMethod,
  GradeSystem,
  ProductClaimKind,
  ResultBasis,
  SourceUnitClassification,
  SpecValueType,
} from "../../../prisma/generated/enums";
import type { IdentityEvidence, IdentityState, LedgerEntry } from "./identity-ledger";
import type {
  DocumentIntegrityReport,
  ProvenanceLocator,
  RetentionBasis,
} from "./source-documents";
import type { WithholdReason } from "./specification-candidates";

// ── Workbook ────────────────────────────────────────────────────────────────

/** One product row of the authoritative workbook, exactly as the sheet states it. */
export interface WorkbookProductRow {
  /** The worksheet this row came from. Part of the row's provenance, never inferred. */
  readonly sheetName: string;
  /** 1-based worksheet row number. Provenance and MATCHING EVIDENCE — never identity. */
  readonly rowNumber: number;
  /** The product name with interior whitespace collapsed. This is the PUBLIC name. */
  readonly name: string;
  /** The product name exactly as the cell holds it, including irregular spacing. */
  readonly rawName: string;
  /** `نوع محصول` — the workbook's own product-type wording, verbatim. */
  readonly productTypeLabel: string;
  /** `دسته بندی محصولات` — the category block this row belongs to, verbatim. */
  readonly categoryLabel: string;
  /** True when this row's own cell carried the category rather than inheriting the block's. */
  readonly categoryIsOwnCell: boolean;
  /** `comments`, verbatim. Editorial instructions to the compiler, not product data. */
  readonly comment: string;
  /** `مشخصات فنی-En` — a URL, or the literal text the cell holds when it is not one. */
  readonly technicalReferenceEn: string;
  /** `مشخصات فنی-Fa`, same treatment. */
  readonly technicalReferenceFa: string;
}

// ── Reviewed source datasets ────────────────────────────────────────────────

/** Which external publisher a reviewed dataset transcribes. Internal provenance only. */
export type SourceFamily = "king-power" | "hsb" | "addilex";

/** One raw property reading, verbatim, before any interpretation. */
export interface RawFact {
  /** The property label exactly as the source prints it. */
  readonly rawProperty: string;
  /** The unit exactly as printed. Empty string means the source printed none. */
  readonly rawUnit: string;
  /** The value exactly as printed, including `23/6`, `Pass`, `1a`, `≥ 170`, `Report`. */
  readonly rawValue: string;
  /** The method exactly as printed. Empty string means the source printed none. */
  readonly rawMethod: string;
  /** The grade column/row label this reading belongs to, or "" for a product-level fact. */
  readonly rawGrade: string;
  /** Where in the document. Whichever locator the medium has. */
  readonly pageNumber: number | null;
  readonly columnLabel: string | null;
  /** Reviewer-facing note about a defect or oddity in the source. */
  readonly note?: string;
}

/** A grade the source explicitly evidences. Never synthesised — see `grade-classification.ts`. */
export interface RawGrade {
  /** Verbatim source label. Not parsed, not normalized, not reformatted. */
  readonly label: string;
  /** Ordinal within the source's own presentation order. */
  readonly sortOrder: number;
}

/** A statement the source makes about the product, with the wording that makes it that kind. */
export interface RawClaim {
  /** The exact sentence or designation the source prints. */
  readonly sourceText: string;
  /** The body named, if any — `API`, `ACEA`, `Denison`. Absent when the source names none. */
  readonly standardBody?: string;
  /** The class or specification code, verbatim. */
  readonly standardCode?: string;
  /** Source-stated context that changes what the claim means (e.g. a treat rate). */
  readonly contextNote?: string;
  readonly pageNumber: number | null;
  /** Forced classification, where the wording alone would misclassify. Evidence-backed only. */
  readonly kindOverride?: ProductClaimKind;
  /**
   * The document this CLAIM is stated in, when it is not the entry's own. A King Power TDS
   * table carries no claim text at all; a claim attributed to King Power comes from the
   * product PAGE, which is a different document and must be cited as one.
   */
  readonly documentKey?: string;
  readonly note?: string;
}

/** A reading this project corrected because its own extractor, not the source, was wrong. */
export interface SourceCorrection {
  readonly what: string;
  readonly extracted: string;
  readonly corrected: string;
  readonly reason: string;
}

/** One external document's transcription for one workbook row. */
export interface ReviewedSourceEntry {
  /** The workbook row this transcription enriches. The workbook still decides inclusion. */
  readonly workbookRow: number;
  readonly family: SourceFamily;
  /** Stable id of the source document within its family (`PD1-001`, `HSB-CAT`, `ADX-C-339`). */
  readonly documentKey: string;
  readonly extractionMethod: ExtractionMethod;
  /** What numbers in this document are, absent a per-fact override. */
  readonly defaultResultBasis: ResultBasis;
  readonly grades: readonly RawGrade[];
  readonly facts: readonly RawFact[];
  readonly claims: readonly RawClaim[];
  /** Extraction artefacts corrected back to what the document prints. Always reported. */
  readonly corrections?: readonly SourceCorrection[];
  /**
   * A reviewer-facing note about the ENTRY as a whole — an ambiguous column header, a
   * name that differs from the workbook. Reported once per product, not once per fact:
   * the same sentence repeated across fifteen facts is noise, not fifteen findings.
   */
  readonly entryNote?: string;
}

// ── Source documents ────────────────────────────────────────────────────────

/** A cited document, with the locator and hash needed to find and identify it again. */
export interface SourceDocumentDescriptor {
  readonly documentKey: string;
  readonly locatorType: "URL" | "UPLOADED_FILE";
  readonly locatorValue: string;
  readonly publisher: string;
  readonly title: string;
  /** Lowercase hex SHA-256 of the file, where the file was captured and hashed. */
  readonly sha256: string | null;
  readonly byteSize: number | null;
  readonly mediaType: string | null;
  readonly pageCount: number | null;
  readonly revisionLabel: string | null;
  readonly retrievedAt: string;
  readonly defaultResultBasis: ResultBasis;
}

// ── Planned rows ────────────────────────────────────────────────────────────

/**
 * What an apply gate WOULD do with the Product ROW itself. Deliberately about the Product and
 * nothing else: a withheld specification or an unmapped property does not erase a product
 * from the plan, and the per-entity counters below are what report those.
 */
export type ImportAction = "INSERT" | "UPDATE" | "SKIP" | "CONFLICT";

/** Which part of a row a conflict is about. One row can carry several, independently. */
export type ConflictCategory =
  "IDENTITY" | "SLUG" | "TAXONOMY" | "GRADE" | "SPECIFICATION" | "CLAIM" | "PROVENANCE";

/** A machine-readable reason a row needs a human before it can be applied. */
export interface PlanFlag {
  readonly code: string;
  readonly severity: "conflict" | "review" | "info";
  readonly detail: string;
  /** Which part of the row this is about. Absent on purely informational flags. */
  readonly category?: ConflictCategory;
}

export interface PlannedGrade {
  readonly label: string;
  readonly gradeSystem: GradeSystem | null;
  readonly sortOrder: number;
}

/** One `source_facts` row the apply gate would insert. Verbatim, immutable, evidence. */
export interface PlannedSourceFact {
  readonly documentKey: string;
  readonly sheetName: string | null;
  readonly pageNumber: number | null;
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

/**
 * A `specifications` row the apply gate would insert. Emitted ONLY when the property resolved
 * to an approved dictionary key AND the value satisfies the database's own CHECK constraints,
 * which is why `propertyKey` and `valueType` are non-null here and nullable in the table.
 */
export interface PlannedSpecification {
  /** The grade label this fact belongs to, or null for a Product-level fact. */
  readonly gradeLabel: string | null;
  readonly propertyKey: string;
  readonly displayValue: string;
  readonly valueType: SpecValueType;
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly pairFirst: string | null;
  readonly pairSecond: string | null;
  readonly unit: string | null;
  readonly method: string | null;
  readonly qualifier: string | null;
  readonly resultBasis: ResultBasis;
  readonly sortOrder: number;
}

/**
 * One extracted technical observation. ALWAYS a SourceFact; a Specification only sometimes.
 *
 * `specification === null` means the reading was withheld from interpretation, not lost:
 * `sourceFact` still carries the raw property, value, unit, method and grade label exactly as
 * printed, and `withheldReason` says why no `specifications` row follows from it.
 */
export interface PlannedTechnicalFact {
  readonly sourceFact: PlannedSourceFact;
  /** The grade label this reading belongs to, or null for a Product-level reading. */
  readonly gradeLabel: string | null;
  /** What the dictionary resolved the raw label to, whether or not a Specification followed. */
  readonly resolvedPropertyKey: string | null;
  readonly specification: PlannedSpecification | null;
  readonly withheldReason: WithholdReason | null;
  readonly withheldDetail: string | null;
  /** The CHECK constraints a rejected candidate would have violated, named. */
  readonly shapeViolations: readonly string[];
  readonly flags: readonly PlanFlag[];
}

export interface PlannedClaim {
  readonly gradeLabel: string | null;
  readonly kind: ProductClaimKind;
  readonly standardBody: string | null;
  readonly standardCode: string | null;
  readonly contextNote: string | null;
  readonly sortOrder: number;
  readonly sourceFact: PlannedSourceFact;
  readonly flags: readonly PlanFlag[];
}

/** The complete plan for one workbook row — one manifest entry's worth. */
export interface PlannedProduct {
  readonly sourceRef: string;
  /** Whether that reference is an identity yet, and on what basis. Never inferred silently. */
  readonly identityState: IdentityState;
  /** For an ambiguous row: the references it could have been, listed rather than chosen. */
  readonly identityCandidateSourceRefs: readonly string[];
  readonly identityEvidence: readonly IdentityEvidence[];
  /** The action for the PRODUCT ROW. Child facts have their own counters. */
  readonly action: ImportAction;
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly sourceName: string;
  readonly publicProductName: string;
  readonly normalizedName: string;
  readonly proposedSlug: string;
  readonly slugIsRatified: boolean;
  readonly excelCategory: string;
  readonly excelProductTypeLabel: string;
  readonly sourceFamily: SourceFamily | null;
  readonly sourceLocator: string;
  readonly proposedProductFamilyKey: string | null;
  readonly proposedProductTypeKey: string | null;
  readonly proposedSegmentKeys: readonly string[];
  readonly grades: readonly PlannedGrade[];
  readonly technicalFacts: readonly PlannedTechnicalFact[];
  readonly claims: readonly PlannedClaim[];
  /** Distinct resolved dictionary keys on this product. */
  readonly technicalPropertyCount: number;
  readonly reviewStatus: "SOURCE_RECORDED" | "NEEDS_REVIEW";
  readonly flags: readonly PlanFlag[];
}

/** Per-entity action counts. Nothing here is overloaded onto the product-level action. */
export interface EntityActionCounts {
  readonly insert: number;
  readonly update: number;
  readonly skip: number;
  readonly conflict: number;
}

/** The ten technical numbers the gate requires, reported separately rather than as one. */
export interface TechnicalFactCounts {
  /** 1. Every extracted technical observation. Each one becomes a SourceFact. */
  readonly rawTechnicalFacts: number;
  /** 2. Facts whose raw label resolved to an approved HIGH-confidence dictionary key. */
  readonly highConfidenceMapped: number;
  /** 3. Facts whose label is unknown, element-content, or mapped below HIGH confidence. */
  readonly unmappedOrLowConfidence: number;
  /** 4. Facts that would produce a `specifications` row the database accepts. */
  readonly validSpecificationCandidates: number;
  /** 5. Facts kept as evidence and withheld from interpretation. */
  readonly withheldFromSpecification: number;
  /** 6. Valid candidates that hang off the Product. */
  readonly productLevelCandidates: number;
  /** 7. Valid candidates that hang off a Grade. */
  readonly gradeLevelCandidates: number;
  /** 8. Facts withheld because no approved property reference exists. */
  readonly missingPropertyReference: number;
  /** 9. Facts withheld because the printed value has no database-valid shape. */
  readonly invalidValueShape: number;
  /** 10. Distinct raw labels in conflict, and how many facts they account for. */
  readonly conflictingRawLabels: number;
  readonly factsUnderConflictingRawLabels: number;
}

/** Aggregate counters the gate requires the dry run to report. */
export interface PlanCounts {
  readonly rowsParsed: number;
  readonly products: EntityActionCounts;
  readonly technical: TechnicalFactCounts;
  readonly duplicateIdentity: number;
  readonly duplicateSlug: number;
  readonly unknownCategory: number;
  readonly unknownProductType: number;
  readonly unknownProperty: number;
  readonly unresolvedGrade: number;
  readonly unresolvedClaim: number;
  readonly sourceRetrievalMismatch: number;
  readonly gradesZero: number;
  readonly gradesSingle: number;
  readonly gradesMulti: number;
  readonly gradeRecords: number;
  readonly claims: number;
  /**
   * DISTINCT planned `source_facts` rows. A product name that states six designations is one
   * spreadsheet cell and therefore ONE SourceFact, linked to six claims — counting it six
   * times would over-report the evidence table and under-report the sharing.
   */
  readonly sourceFacts: number;
  /** `specification_evidence` rows: one per valid Specification candidate. */
  readonly specificationEvidenceLinks: number;
  /** `claim_evidence` rows: one per planned ProductClaim. */
  readonly claimEvidenceLinks: number;
  /** Product rows carrying at least one conflict of each category. */
  readonly conflictsByCategory: Readonly<Record<ConflictCategory, number>>;
}

export interface UnmappedProperty {
  readonly rawProperty: string;
  readonly rawUnit: string | null;
  readonly occurrences: number;
  readonly reason: string;
}

export interface ImportPlan {
  readonly importerVersion: string;
  readonly workbook: {
    readonly fileName: string;
    readonly sha256: string;
    readonly byteSize: number;
    readonly sheetName: string;
    /** Whether the plan was built from the owner's workbook or from the frozen CI fixture. */
    readonly provenance: "AUTHORITATIVE_WORKBOOK" | "FROZEN_FIXTURE";
  };
  readonly products: readonly PlannedProduct[];
  readonly counts: PlanCounts;
  /**
   * The `source_documents` rows an apply gate would insert. EVIDENCE-BEARING ONLY: a locator
   * nothing cites is not a document, and is carried in `provenanceLocators` instead.
   */
  readonly documents: readonly SourceDocumentDescriptor[];
  /** Why each planned document earned its row. */
  readonly documentRetention: readonly {
    readonly documentKey: string;
    readonly retentionBasis: RetentionBasis;
    readonly technicalFacts: number;
    readonly claims: number;
  }[];
  /**
   * Addresses the sources state and no evidence cites — the 50 King Power product pages
   * nothing was transcribed from. Kept visible for review, never written.
   */
  readonly provenanceLocators: readonly ProvenanceLocator[];
  readonly documentIntegrity: DocumentIntegrityReport;
  /** Ledger entries no workbook row matched. Reported as SKIP; never a deletion. */
  readonly unmatchedLedgerEntries: readonly LedgerEntry[];
  /** True only when every row's identity is settled, so the ledger could be ratified. */
  readonly identityRatifiable: boolean;
  /** Every raw source label the run saw that the dictionary has no approved mapping for. */
  readonly unmappedProperties: readonly UnmappedProperty[];
  readonly corrections: readonly (SourceCorrection & { readonly documentKey: string })[];
}
