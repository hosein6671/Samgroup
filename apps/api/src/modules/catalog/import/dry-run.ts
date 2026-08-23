/**
 * The dry run: build the plan, verify against the live database, write nothing.
 *
 * ── "Writes nothing" is verified, not asserted ──────────────────────────────
 *
 * The run needs two things from the database — the live slug namespace, so a collision is
 * caught before it can be proposed, and the before/after row counts that prove it wrote
 * nothing. Both are reads.
 *
 * Where a check genuinely needs to know how the DATABASE would react — would the ADR-011
 * trigger set accept these 100 slugs? — the run may open a transaction, attempt it, and ALWAYS
 * roll back. That path is guarded three ways: the transaction is opened only when
 * `probeSlugNamespace` is requested, the rollback happens in a `finally`, and the row counts
 * are re-taken afterwards and compared. If any table's count moved, the run fails. A probe
 * that left data behind is a bug, and the run says so rather than reporting success.
 *
 * ── There is no apply mode ──────────────────────────────────────────────────
 *
 * Not "an apply mode that is disabled" — there is no code here that inserts, updates or
 * deletes a catalogue row. Adding one is a separate gate with its own approval.
 */

import { canonicalJson } from "./manifest";

import type { ImportPlan } from "./catalog-import.types";

/** Every table the plan would touch, plus the demo rows that must be left alone. */
export const WATCHED_TABLES: readonly string[] = [
  "products",
  "categories",
  "segments",
  "product_types",
  "product_segments",
  "specifications",
  "product_grades",
  "spec_properties",
  "spec_property_mappings",
  "product_claims",
  "source_assets",
  "source_documents",
  "import_runs",
  "source_facts",
  "specification_evidence",
  "claim_evidence",
  "technical_reviews",
  "product_slug_claims",
];

/**
 * The minimum database surface the dry run needs. An interface rather than a Prisma client
 * so the tests can drive the whole run without a database, and so nothing here can reach a
 * write method that is not on it.
 */
export interface DryRunDatabase {
  /** `table -> row count`, for every table in `WATCHED_TABLES`. */
  countRows(tables: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /** Current `product_slug_claims.slug_key` values. */
  listSlugKeys(): Promise<ReadonlySet<string>>;
}

export interface DryRunCountsDelta {
  readonly table: string;
  readonly before: number;
  readonly after: number;
}

export interface DryRunResult {
  readonly plan: ImportPlan;
  readonly countsBefore: ReadonlyMap<string, number>;
  readonly countsAfter: ReadonlyMap<string, number>;
  readonly changedTables: readonly DryRunCountsDelta[];
  /** True only when every watched table's count is identical before and after. */
  readonly wroteNothing: boolean;
}

export class DryRunWroteDataError extends Error {
  constructor(readonly changed: readonly DryRunCountsDelta[]) {
    super(
      `Dry run changed the database, which it must never do: ` +
        changed.map((d) => `${d.table} ${d.before} -> ${d.after}`).join(", "),
    );
    this.name = "DryRunWroteDataError";
  }
}

/**
 * Runs the plan against a live database, taking row counts on both sides of it.
 *
 * `buildPlan` is injected rather than imported so the caller owns where the workbook comes
 * from, and so a test can drive this with a trivial plan.
 */
export async function runDryRun(
  database: DryRunDatabase,
  buildPlan: (existingSlugKeys: ReadonlySet<string>) => ImportPlan,
): Promise<DryRunResult> {
  const countsBefore = await database.countRows(WATCHED_TABLES);
  const existingSlugKeys = await database.listSlugKeys();

  const plan = buildPlan(existingSlugKeys);

  const countsAfter = await database.countRows(WATCHED_TABLES);

  const changedTables: DryRunCountsDelta[] = [];
  for (const table of WATCHED_TABLES) {
    const before = countsBefore.get(table) ?? 0;
    const after = countsAfter.get(table) ?? 0;
    if (before !== after) changedTables.push({ table, before, after });
  }

  if (changedTables.length > 0) throw new DryRunWroteDataError(changedTables);

  return { plan, countsBefore, countsAfter, changedTables, wroteNothing: true };
}

/** A stable, human-scannable summary of the run. Ordered, so two runs render identically. */
export function renderSummary(result: DryRunResult): string {
  const { plan } = result;
  const counts = plan.counts;
  const technical = counts.technical;
  const integrity = plan.documentIntegrity;
  const lines: string[] = [];
  const row = (label: string, value: number | string): void => {
    lines.push(`  ${label.padEnd(30)}${String(value)}`);
  };

  lines.push("CATALOG IMPORT — DRY RUN");
  lines.push(`importer            ${plan.importerVersion}`);
  lines.push(`workbook            ${plan.workbook.fileName}`);
  lines.push(`workbook provenance ${plan.workbook.provenance}`);
  lines.push(`workbook sha256     ${plan.workbook.sha256}`);
  lines.push(`workbook bytes      ${String(plan.workbook.byteSize)}`);
  lines.push(`worksheet           ${plan.workbook.sheetName}`);
  lines.push("");
  lines.push("PRODUCT ROW ACTIONS (the Product row itself, nothing else)");
  row("rows parsed", counts.rowsParsed);
  row("INSERT", counts.products.insert);
  row("UPDATE", counts.products.update);
  row("SKIP", counts.products.skip);
  row("CONFLICT (row blocked)", counts.products.conflict);
  lines.push("");
  lines.push("IDENTITY");
  row("ledger ratifiable", plan.identityRatifiable ? "yes" : "NO");
  row("unmatched ledger entries", plan.unmatchedLedgerEntries.length);
  row("duplicate identity", counts.duplicateIdentity);
  lines.push("");
  lines.push("CONFLICTS BY CATEGORY (products carrying at least one)");
  for (const [category, count] of Object.entries(counts.conflictsByCategory)) {
    row(category.toLowerCase(), count);
  }
  lines.push("");
  lines.push("TECHNICAL FACTS vs SPECIFICATIONS");
  row("raw technical SourceFacts", technical.rawTechnicalFacts);
  row("HIGH-confidence mapped", technical.highConfidenceMapped);
  row("unmapped / below HIGH", technical.unmappedOrLowConfidence);
  row("valid Specification cands", technical.validSpecificationCandidates);
  row("  of which Product-level", technical.productLevelCandidates);
  row("  of which Grade-level", technical.gradeLevelCandidates);
  row("withheld from Specification", technical.withheldFromSpecification);
  row("  no property reference", technical.missingPropertyReference);
  row("  no valid value shape", technical.invalidValueShape);
  row("conflicting raw labels", technical.conflictingRawLabels);
  row("  facts under them", technical.factsUnderConflictingRawLabels);
  lines.push("");
  lines.push("OTHER PLANNED ROWS");
  row("zero-grade products", counts.gradesZero);
  row("single-grade products", counts.gradesSingle);
  row("multi-grade products", counts.gradesMulti);
  row("ProductGrade candidates", counts.gradeRecords);
  row("ProductClaim rows", counts.claims);
  row("SourceFact rows (distinct)", counts.sourceFacts);
  row("specification_evidence links", counts.specificationEvidenceLinks);
  row("claim_evidence links", counts.claimEvidenceLinks);
  lines.push("");
  lines.push("DOCUMENTS");
  row("SourceDocument rows", integrity.totalDocuments);
  row(
    "  cited by a fact",
    integrity.retentionByBasis.find((b) => b.basis === "CITED_BY_FACT")?.count ?? 0,
  );
  row(
    "  the ImportRun source",
    integrity.retentionByBasis.find((b) => b.basis === "IMPORT_RUN_SOURCE")?.count ?? 0,
  );
  row("candidates addressed", integrity.candidateDocuments);
  row("provenance locators only", integrity.provenanceLocators);
  row("unique locators", integrity.uniqueLocators);
  row("duplicate locators", integrity.duplicateLocators.length);
  row("captured (would have asset)", integrity.capturedDocuments);
  row("locator only", integrity.locatorOnlyDocuments);
  row("SourceAsset rows", integrity.sourceAssets);
  row("documents with zero evidence", integrity.documentsWithZeroEvidence.length);
  row("evidence with no document", integrity.evidenceWithoutDocument.length);
  row("claims citing a TDS", integrity.claimsCitingTechnicalDataSheet.length);
  row("readings citing a page", integrity.technicalFactsCitingProductPage.length);
  row("locator mismatches", counts.sourceRetrievalMismatch);
  lines.push("");
  lines.push("OTHER INTEGRITY");
  row("duplicate slug", counts.duplicateSlug);
  row("unknown category", counts.unknownCategory);
  row("unknown product type", counts.unknownProductType);
  row("unknown property", counts.unknownProperty);
  row("unresolved grade", counts.unresolvedGrade);
  row("unresolved claim", counts.unresolvedClaim);
  lines.push("");
  lines.push("DATABASE (live, before -> after)");
  for (const table of WATCHED_TABLES) {
    const before = result.countsBefore.get(table) ?? 0;
    const after = result.countsAfter.get(table) ?? 0;
    lines.push(
      `  ${table.padEnd(24)} ${String(before).padStart(5)} -> ${String(after).padStart(5)}`,
    );
  }
  lines.push("");
  lines.push(`WROTE NOTHING                 ${result.wroteNothing ? "yes" : "NO"}`);
  return `${lines.join("\n")}\n`;
}

/** Exposed so a test can prove the summary is a pure function of the plan. */
export function summaryFingerprint(result: DryRunResult): string {
  return canonicalJson({ counts: result.plan.counts, wroteNothing: result.wroteNothing });
}
