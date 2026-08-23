/**
 * The transactional catalog writer.
 *
 * ── One transaction, and everything inside it ───────────────────────────────
 *
 * SERIALIZABLE. A fixed transaction-scoped advisory lock so two imports cannot interleave.
 * A lock timeout and a statement timeout so a stuck import cannot hold the catalogue hostage.
 * Every guard, every hash and every count re-checked HERE rather than remembered from the
 * preflight, because a check that passed in another transaction was true once and the rows
 * can change in between.
 *
 * A half-imported catalogue is worse than no catalogue: it looks complete. So the demo
 * deletion, all thirteen inserting tables, the ImportRun and the post-write verification are
 * one unit. Any failure rolls back all of it — the ten demo Products and their 18 segment
 * memberships come back, and the ADR-011 triggers re-claim their ten slugs, because the
 * triggers are subject to the same transaction as everything else.
 *
 * ── Refuse, never repair ────────────────────────────────────────────────────
 *
 * Every table reconciles the same way: read what is there, compare it to what was planned,
 * INSERT only what is missing, and ABORT if a row exists under the planned identity carrying
 * different immutable data. There is no `ON CONFLICT DO NOTHING` standing in for that
 * comparison — a blanket DO NOTHING makes "already correct" and "already WRONG" produce the
 * same silent success, which is the exact failure this engine exists to prevent.
 *
 * `source_facts` is the one table that reaches its unique index through `ON CONFLICT DO
 * NOTHING`, and only AFTER the comparison has already passed: ADR-015 §10 requires it,
 * because `DO UPDATE` would fire `source_facts_immutable_guard` and abort, correctly.
 *
 * ── What this engine may never do ───────────────────────────────────────────
 *
 * Write `product_slug_claims` (ADR-011 maintains it by trigger; a writer that touched it
 * would be asserting the invariant instead of being subject to it), set any review status to
 * APPROVED, turn a withheld fact into a Specification, create a Category or a Segment, or
 * store one byte of a TDS, image or workbook.
 */

import { buildManifest } from "../manifest";

import {
  assertPlanApplicable,
  assertWritePlanIdentitiesDistinct,
  beginGuardedTransaction,
  buildWritePlan,
  deleteAuditedDemoProducts,
  ApplyPreflightError,
  type ApplyTransaction,
} from "./apply-engine";
import { assertReferenceDataSafe } from "./reference-data";
import { assertRowsNeverApproved, buildApplyRows, type ApplyRows, type ReferenceIds } from "./rows";
import { runPostWriteVerification, type VerificationReport } from "./verification";

import type { ImportPlan } from "../catalog-import.types";

/* -------------------------------------------------------------------------- */
/* Result shapes                                                               */
/* -------------------------------------------------------------------------- */

export interface TableOutcome {
  readonly inserted: number;
  readonly skipped: number;
}

export type ApplyMode = "FIRST_APPLY" | "IDENTICAL_REPLAY";

export interface ApplyResult {
  readonly mode: ApplyMode;
  readonly databaseName: string;
  readonly manifestHash: string;
  readonly demoProductsDeleted: number;
  readonly importRunCreated: boolean;
  readonly importRunId: string | null;
  readonly tables: Readonly<Record<string, TableOutcome>>;
  readonly verification: VerificationReport;
  readonly stepsCompleted: readonly string[];
}

export interface ExecuteApplyOptions {
  readonly plan: ImportPlan;
  /** The hash the operator reviewed. Recomputed from the plan inside the transaction. */
  readonly manifestHash: string;
  readonly workbookSha256: string;
  readonly ledgerSha256: string;
  /** The database the operator named. Compared to `current_database()` in-transaction. */
  readonly expectedDatabaseName: string;
  readonly demoReplacementAuthorized: boolean;
  readonly acceptInquirySetNull?: boolean;
  /**
   * Test-only. Called after each completed step; throwing aborts the transaction there.
   * It can only make a run FAIL — there is no injector that can make one succeed, skip a
   * guard, or write anything, which is why it is safe for it to live in the engine.
   */
  readonly faultInjector?: (step: string) => void | Promise<void>;
}

export class ApplyExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyExecutionError";
  }
}

export class ImmutableConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImmutableConflictError";
  }
}

/* -------------------------------------------------------------------------- */
/* Value marshalling                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Prisma's TypeScript enums are UPPER_SNAKE and every corresponding Postgres enum label is
 * the same identifier lowercased (`@map` in `schema.prisma`, verified label by label against
 * `pg_enum`). Asserted rather than assumed: an enum whose mapping ever stops being that would
 * otherwise be written as an invalid label and caught only by the database.
 */
export function dbEnum(value: string): string {
  const lowered = value.toLowerCase();
  if (!/^[a-z][a-z0-9_]*$/.test(lowered)) {
    throw new ApplyExecutionError(`"${value}" is not a mappable enum label.`);
  }
  return lowered;
}

function enumOrNull(value: string | null): string | null {
  return value === null ? null : dbEnum(value);
}

/** Rows go to Postgres as one jsonb parameter, so no statement approaches the 65535 bound. */
const CHUNK = 500;

function chunked<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += CHUNK) {
    out.push(rows.slice(index, index + CHUNK));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One table's reconciliation. `read` returns what the database already holds keyed by the
 * row's IDENTITY; `compare` returns the names of any immutable columns whose persisted value
 * disagrees with the planned one. A disagreement is a conflict and stops the import — it is
 * never an update, because every column this importer writes is either identity or evidence.
 */
interface Reconcilable<T> {
  readonly table: string;
  readonly rows: readonly T[];
  readonly identityOf: (row: T) => string;
  readonly read: () => Promise<ReadonlyMap<string, Record<string, unknown>>>;
  readonly compare: (planned: T, existing: Record<string, unknown>) => readonly string[];
  readonly insert: (missing: readonly T[]) => Promise<void>;
}

/**
 * `mode` is a parameter and not part of the descriptor: a REPLAY inserts nothing, in any
 * table. Every ratified identity is already persisted, so a row still missing means the
 * catalogue is incomplete — and a replay that quietly filled the gap would be repairing a
 * state nobody reviewed, which is the one thing this engine must never do.
 */
async function reconcile<T>(spec: Reconcilable<T>, mode: ApplyMode): Promise<TableOutcome> {
  const existing = await spec.read();
  const missing: T[] = [];
  let skipped = 0;

  for (const row of spec.rows) {
    const identity = spec.identityOf(row);
    const found = existing.get(identity);
    if (found === undefined) {
      missing.push(row);
      continue;
    }
    const differing = spec.compare(row, found);
    if (differing.length > 0) {
      throw new ImmutableConflictError(
        `${spec.table}: a row already exists under identity "${identity}" carrying different ` +
          `data (${differing.join(", ")}). The import refuses rather than overwriting it: ` +
          `every column this importer writes is identity or evidence, and neither is edited ` +
          `by a rerun.`,
      );
    }
    skipped++;
  }

  if (missing.length > 0) {
    if (mode !== "FIRST_APPLY") {
      throw new ApplyPreflightError(
        `A replay would insert ${String(missing.length)} ${spec.table} rows. Every ratified ` +
          `identity is persisted but this table is not complete, which is a partial catalogue ` +
          `and is never completed automatically.`,
      );
    }
    await spec.insert(missing);
  }
  return { inserted: missing.length, skipped };
}

/** Compares planned values to persisted ones, normalising the shapes Postgres returns. */
function differences(
  planned: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): readonly string[] {
  const out: string[] = [];
  for (const [column, want] of Object.entries(planned)) {
    const got = existing[column];
    if (!sameValue(want, got)) out.push(column);
  }
  return out;
}

function sameValue(want: unknown, got: unknown): boolean {
  if (want === null || want === undefined) return got === null || got === undefined;
  if (got === null || got === undefined) return false;
  if (Array.isArray(want)) {
    const other = Array.isArray(got) ? got : [];
    return (
      want.length === other.length && want.every((item, index) => sameValue(item, other[index]))
    );
  }
  if (typeof want === "number" || typeof got === "number" || typeof got === "bigint") {
    return Number(want) === Number(got);
  }
  return String(want) === String(got);
}

/* -------------------------------------------------------------------------- */
/* The apply                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Runs the complete apply inside an already-open transaction.
 *
 * The caller owns the transaction and therefore owns the COMMIT: this function returns only
 * when every assertion has passed, and throws otherwise, so "commit if it returned" is the
 * whole contract and there is no path that commits a partially verified catalogue.
 */
export async function executeCatalogApply(
  tx: ApplyTransaction,
  options: ExecuteApplyOptions,
): Promise<ApplyResult> {
  const steps: string[] = [];
  const tables: Record<string, TableOutcome> = {};
  const fault = options.faultInjector;
  const done = async (step: string): Promise<void> => {
    steps.push(step);
    if (fault) await fault(step);
  };

  // ── advisory-lock, timeouts ─────────────────────────────────────────────
  await beginGuardedTransaction(tx);
  await done("advisory-lock");
  await done("timeouts");

  // ── preflight-recheck ───────────────────────────────────────────────────
  const databaseName = await currentDatabase(tx);
  if (databaseName !== options.expectedDatabaseName) {
    throw new ApplyExecutionError(
      `Connected to "${databaseName}", authorized for "${options.expectedDatabaseName}". ` +
        `Refusing to write to a database the operator did not name.`,
    );
  }
  await assertSerializable(tx);

  const plan = options.plan;
  if (plan.workbook.sha256 !== options.workbookSha256) {
    throw new ApplyExecutionError(
      `Workbook hash changed between the preflight and the transaction: plan carries ` +
        `${plan.workbook.sha256}, operator confirmed ${options.workbookSha256}.`,
    );
  }
  const recomputed = buildManifest(plan).manifestHash;
  if (recomputed !== options.manifestHash) {
    throw new ApplyExecutionError(
      `Manifest hash changed between the preflight and the transaction: recomputed ` +
        `${recomputed}, operator confirmed ${options.manifestHash}.`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(options.ledgerSha256)) {
    throw new ApplyExecutionError("The ratified ledger hash is not a SHA-256.");
  }
  assertReferenceDataSafe();

  const persistedRefs = await readPersistedSourceRefs(tx);
  const mode = assertPlanApplicable(plan, persistedRefs);
  if (mode === "FIRST_APPLY") await assertManifestNotAlreadyApplied(tx, options.manifestHash);
  assertWritePlanIdentitiesDistinct(buildWritePlan(plan));

  const reference = await readReferenceIds(tx);
  const rows = buildApplyRows(plan, options.manifestHash, reference);
  assertRowsNeverApproved(rows);
  await done("preflight-recheck");

  // ── reference vocabulary ────────────────────────────────────────────────
  tables["spec_properties"] = await reconcileSpecProperties(tx, rows, mode);
  await done("spec_properties");
  tables["spec_property_mappings"] = await reconcileSpecPropertyMappings(tx, rows, mode);
  await done("spec_property_mappings");
  tables["product_types"] = await reconcileProductTypes(tx, rows, mode);
  await done("product_types");

  // ── the ten audited demos ───────────────────────────────────────────────
  // Only on a first apply: a replay has no demos left to delete and must not look for any.
  let demoProductsDeleted = 0;
  if (mode === "FIRST_APPLY") {
    await done("demo-guard");
    demoProductsDeleted = (
      await deleteAuditedDemoProducts(tx, {
        authorized: options.demoReplacementAuthorized,
        ...(options.acceptInquirySetNull === undefined
          ? {}
          : { acceptInquirySetNull: options.acceptInquirySetNull }),
      })
    ).length;
    await done("demo-delete");
  } else {
    await assertNoDemoProducts(tx);
    await done("demo-guard");
    await done("demo-delete");
  }

  // ── the run ─────────────────────────────────────────────────────────────
  // A replay inserts nothing, so it needs no run: `source_facts.import_run_id` is only
  // written by an INSERT, and recording a second successful application of one manifest is
  // exactly what `import_runs_applied_manifest_key` exists to forbid.
  const importRunCreated = mode === "FIRST_APPLY";
  if (importRunCreated) {
    await insertImportRun(tx, rows);
  } else {
    await assertCatalogueWasApplied(tx, options.manifestHash);
  }
  await done("import_runs");

  // ── provenance ──────────────────────────────────────────────────────────
  tables["source_assets"] = await reconcileSourceAssets(tx, rows, mode);
  await done("source_assets");
  tables["source_documents"] = await reconcileSourceDocuments(tx, rows, mode);
  await done("source_documents");

  // ── the catalogue ───────────────────────────────────────────────────────
  tables["products"] = await reconcileProducts(tx, rows, mode);
  await done("products");
  tables["product_segments"] = await reconcileProductSegments(tx, rows, mode);
  await done("product_segments");
  tables["product_grades"] = await reconcileProductGrades(tx, rows, mode);
  await done("product_grades");

  // ── evidence ────────────────────────────────────────────────────────────
  tables["source_facts"] = await reconcileSourceFacts(tx, rows, rows.importRun.id, mode);
  await done("source_facts");
  tables["specifications"] = await reconcileSpecifications(tx, rows, mode);
  await done("specifications");
  tables["product_claims"] = await reconcileProductClaims(tx, rows, mode);
  await done("product_claims");

  const factIdByIdentity = await readSourceFactIds(tx, rows);
  tables["specification_evidence"] = await reconcileSpecificationEvidence(
    tx,
    rows,
    factIdByIdentity,
    mode,
  );
  await done("specification_evidence");
  tables["claim_evidence"] = await reconcileClaimEvidence(tx, rows, factIdByIdentity, mode);
  await done("claim_evidence");

  // ── post-write verification ─────────────────────────────────────────────
  const verification = await runPostWriteVerification(tx, {
    rows,
    plan,
    manifestHash: options.manifestHash,
    workbookSha256: options.workbookSha256,
    ledgerSha256: options.ledgerSha256,
    mode,
  });
  await done("post-write-verification");

  // Only now. A run marked successful before its verification is a run that lies.
  if (importRunCreated) await finishImportRun(tx, rows.importRun.id);

  return {
    mode,
    databaseName,
    manifestHash: options.manifestHash,
    demoProductsDeleted,
    importRunCreated,
    importRunId: importRunCreated ? rows.importRun.id : null,
    tables,
    verification,
    stepsCompleted: steps,
  };
}

/* -------------------------------------------------------------------------- */
/* In-transaction reads                                                        */
/* -------------------------------------------------------------------------- */

async function currentDatabase(tx: ApplyTransaction): Promise<string> {
  const rows = await tx.query<{ name: string }>(`SELECT current_database() AS name`);
  return rows[0]?.name ?? "";
}

async function assertSerializable(tx: ApplyTransaction): Promise<void> {
  // `SHOW` names its column after the setting; `current_setting` lets the column be named.
  const rows = await tx.query<{ level: string }>(
    `SELECT current_setting('transaction_isolation') AS level`,
  );
  const level = rows[0]?.level ?? "";
  if (level !== "serializable") {
    throw new ApplyExecutionError(
      `The transaction is running at "${level}", not serializable. The apply's guards assume ` +
        `no concurrent writer can change what they just read.`,
    );
  }
}

async function readPersistedSourceRefs(tx: ApplyTransaction): Promise<ReadonlySet<string>> {
  const rows = await tx.query<{ source_ref: string }>(
    `SELECT source_ref FROM products WHERE source_ref IS NOT NULL`,
  );
  return new Set(rows.map((row) => row.source_ref));
}

/**
 * The six Categories and eight Segments, read by their frozen slugs. Reconciled and never
 * created: an import that finds one missing has been pointed at a database that was never
 * seeded, and inventing the row would invent a public Product Family.
 */
async function readReferenceIds(tx: ApplyTransaction): Promise<ReferenceIds> {
  const categories = await tx.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM categories`,
  );
  const segments = await tx.query<{ id: string; slug: string }>(`SELECT id, slug FROM segments`);
  return {
    categoryIdBySlug: new Map(categories.map((row) => [row.slug, row.id])),
    segmentIdBySlug: new Map(segments.map((row) => [row.slug, row.id])),
  };
}

async function assertNoDemoProducts(tx: ApplyTransaction): Promise<void> {
  const rows = await tx.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM products WHERE slug LIKE 'sam-demo-%'`,
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count !== 0) {
    throw new ApplyPreflightError(
      `A replay found ${String(count)} demo Products still present. Every ratified identity ` +
        `is persisted, so the demos were replaced already; finding them back is a state ` +
        `nobody reviewed.`,
    );
  }
}

/**
 * Refuses a first apply of a manifest some run already recorded as applied.
 *
 * Checked in the PREFLIGHT rather than at the `import_runs` step, because the demo deletion
 * happens in between: a plan that can never be committed must be refused before it deletes
 * anything, even though the transaction would have rolled the deletion back anyway. The
 * database enforces the rule regardless — `import_runs_applied_manifest_key` is unique among
 * finished runs — and this is what makes the refusal say WHY.
 *
 * Reaching this means the catalogue holds no Product under any ratified reference while a run
 * claims to have written all 100. That is not a replay; it is a state nobody reviewed.
 */
async function assertManifestNotAlreadyApplied(
  tx: ApplyTransaction,
  manifestHash: string,
): Promise<void> {
  const found = await tx.query<{ id: string }>(
    `SELECT id FROM import_runs WHERE manifest_hash = $1 AND finished_at IS NOT NULL`,
    manifestHash,
  );
  if (found.length > 0) {
    throw new ApplyPreflightError(
      `Manifest ${manifestHash} was already applied successfully by ImportRun ` +
        `${String(found[0]?.id)}, yet no Product is persisted under any of its ratified ` +
        `identities. One plan is never recorded as two successes, and this is not a replay — ` +
        `it is a state nobody reviewed.`,
    );
  }
}

/**
 * The two facts a replay must find true about `import_runs`.
 *
 * ── Why the replay does not look for its OWN hash ───────────────────────────
 *
 * The manifest records what the plan WOULD DO, and `action` is part of what it hashes. A
 * first apply plans 100 INSERT; a replay of the same workbook against the resulting database
 * plans 100 SKIP. Those are different plans and they hash differently — correctly, because a
 * reviewer reading the second one is reading a different document.
 *
 * So a replay must NOT demand a successful run under its own hash: there never was one and
 * there must never be one, since a plan that writes nothing is not an application of the
 * catalogue. What it checks instead is the pair of facts that actually matter — some run did
 * apply this catalogue, and nothing has recorded THIS plan as having applied it.
 */
async function assertCatalogueWasApplied(
  tx: ApplyTransaction,
  manifestHash: string,
): Promise<void> {
  const applied = await tx.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM import_runs WHERE finished_at IS NOT NULL`,
  );
  if (Number(applied[0]?.count ?? 0) < 1) {
    throw new ApplyPreflightError(
      `Every ratified identity is persisted, but no ImportRun has ever finished. The ` +
        `catalogue is there and nothing claims to have written it, which is a state nobody ` +
        `reviewed and is never completed automatically.`,
    );
  }
  const forThisPlan = await tx.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM import_runs
      WHERE manifest_hash = $1 AND finished_at IS NOT NULL`,
    manifestHash,
  );
  if (Number(forThisPlan[0]?.count ?? 0) !== 0) {
    throw new ApplyPreflightError(
      `Manifest ${manifestHash} plans no writes at all, yet an ImportRun records it as a ` +
        `successful application. A replay is not an import and is never recorded as one.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Per-table reconciliation                                                    */
/* -------------------------------------------------------------------------- */

async function reconcileSpecProperties(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "spec_properties",
      rows: rows.specProperties,
      identityOf: (row) => row.key,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT key, canonical_meaning, quantity, value_kind, allowed_units, method_requirement
           FROM spec_properties`,
        );
        return new Map(found.map((row) => [String(row["key"]), row]));
      },
      compare: (planned, existing) =>
        differences(
          {
            canonical_meaning: planned.canonicalMeaning,
            quantity: planned.quantity,
            value_kind: dbEnum(planned.valueKind),
            allowed_units: planned.allowedUnits,
            method_requirement: dbEnum(planned.methodRequirement),
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO spec_properties
             (key, canonical_meaning, quantity, value_kind, allowed_units, method_requirement)
           SELECT x.key, x.canonical_meaning, x.quantity, x.value_kind::spec_value_kind,
                  ARRAY(SELECT jsonb_array_elements_text(x.allowed_units)),
                  x.method_requirement::method_requirement
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    key text, canonical_meaning text, quantity text, value_kind text,
                    allowed_units jsonb, method_requirement text)`,
            JSON.stringify(
              chunk.map((row) => ({
                key: row.key,
                canonical_meaning: row.canonicalMeaning,
                quantity: row.quantity,
                value_kind: dbEnum(row.valueKind),
                allowed_units: row.allowedUnits,
                method_requirement: dbEnum(row.methodRequirement),
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileSpecPropertyMappings(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "spec_property_mappings",
      rows: rows.specPropertyMappings,
      identityOf: (row) => `${row.rawProperty}\u0000${row.rawUnit ?? ""}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, raw_property, raw_unit, spec_property_key, confidence, review_status, note
           FROM spec_property_mappings`,
        );
        return new Map(
          found.map((row) => [
            `${String(row["raw_property"])}\u0000${row["raw_unit"] === null ? "" : String(row["raw_unit"])}`,
            row,
          ]),
        );
      },
      // `confidence` is compared, not overwritten: an approved MEDIUM that came back HIGH would
      // silently promote an uncertain reading into something that can normalize.
      compare: (planned, existing) =>
        differences(
          {
            spec_property_key: planned.specPropertyKey,
            confidence: dbEnum(planned.confidence),
            review_status: dbEnum(planned.reviewStatus),
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO spec_property_mappings
             (id, raw_property, raw_unit, spec_property_key, confidence, review_status, note)
           SELECT x.id::uuid, x.raw_property, x.raw_unit, x.spec_property_key,
                  x.confidence::mapping_confidence, x.review_status::technical_review_status,
                  x.note
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, raw_property text, raw_unit text, spec_property_key text,
                    confidence text, review_status text, note text)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                raw_property: row.rawProperty,
                raw_unit: row.rawUnit,
                spec_property_key: row.specPropertyKey,
                confidence: dbEnum(row.confidence),
                review_status: dbEnum(row.reviewStatus),
                note: row.note,
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileProductTypes(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "product_types",
      rows: rows.productTypes,
      identityOf: (row) => row.slug,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, slug, name FROM product_types`,
        );
        return new Map(found.map((row) => [String(row["slug"]), row]));
      },
      compare: (planned, existing) => differences({ id: planned.id, name: planned.name }, existing),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO product_types (id, slug, name)
           SELECT x.id::uuid, x.slug, x.name
             FROM jsonb_to_recordset($1::jsonb) AS x(id text, slug text, name text)`,
            JSON.stringify(chunk.map((row) => ({ id: row.id, slug: row.slug, name: row.name }))),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileSourceAssets(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "source_assets",
      rows: rows.sourceAssets,
      identityOf: (row) => row.sha256,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, sha256, byte_size, media_type, page_count FROM source_assets`,
        );
        return new Map(found.map((row) => [String(row["sha256"]), row]));
      },
      compare: (planned, existing) =>
        differences(
          {
            id: planned.id,
            byte_size: planned.byteSize,
            media_type: planned.mediaType,
            page_count: planned.pageCount,
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO source_assets (id, sha256, byte_size, media_type, page_count)
           SELECT x.id::uuid, x.sha256, x.byte_size, x.media_type, x.page_count
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, sha256 text, byte_size int, media_type text, page_count int)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                sha256: row.sha256,
                byte_size: row.byteSize,
                media_type: row.mediaType,
                page_count: row.pageCount,
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileSourceDocuments(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "source_documents",
      rows: rows.sourceDocuments,
      identityOf: (row) =>
        `${row.locatorType}\u0000${row.locatorValue}\u0000${row.sourceAssetId ?? ""}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, source_asset_id, locator_type, locator_value, publisher, title,
                revision_label, retrieved_at, default_result_basis
           FROM source_documents`,
        );
        return new Map(
          found.map((row) => [
            `${String(row["locator_type"]).toUpperCase()}\u0000${String(row["locator_value"])}\u0000${
              row["source_asset_id"] === null ? "" : String(row["source_asset_id"])
            }`,
            row,
          ]),
        );
      },
      compare: (planned, existing) =>
        differences(
          {
            id: planned.id,
            publisher: planned.publisher,
            title: planned.title,
            revision_label: planned.revisionLabel,
            default_result_basis: dbEnum(planned.defaultResultBasis),
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO source_documents
             (id, source_asset_id, locator_type, locator_value, publisher, title,
              revision_label, retrieved_at, default_result_basis)
           SELECT x.id::uuid, x.source_asset_id::uuid, x.locator_type::source_locator_type,
                  x.locator_value, x.publisher, x.title, x.revision_label,
                  x.retrieved_at::timestamptz, x.default_result_basis::result_basis
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, source_asset_id text, locator_type text, locator_value text,
                    publisher text, title text, revision_label text, retrieved_at text,
                    default_result_basis text)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                source_asset_id: row.sourceAssetId,
                locator_type: dbEnum(row.locatorType),
                locator_value: row.locatorValue,
                publisher: row.publisher,
                title: row.title,
                revision_label: row.revisionLabel,
                retrieved_at: row.retrievedAt,
                default_result_basis: dbEnum(row.defaultResultBasis),
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

/**
 * Products, keyed by the ratified `sourceRef`.
 *
 * `products_source_ref_key` and `products_slug_key` are the real authority, and
 * `products_source_ref_immutable_guard` refuses to let an existing reference be replaced —
 * so a reference that came back different is a conflict here and an aborted statement there.
 * The ADR-011 insert trigger claims all 100 slugs as a side effect of this one statement.
 */
async function reconcileProducts(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "products",
      rows: rows.products,
      identityOf: (row) => row.sourceRef,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, name, slug, category_id, product_type_id, source_ref
           FROM products WHERE source_ref IS NOT NULL`,
        );
        return new Map(found.map((row) => [String(row["source_ref"]), row]));
      },
      compare: (planned, existing) =>
        differences(
          {
            id: planned.id,
            name: planned.name,
            slug: planned.slug,
            category_id: planned.categoryId,
            product_type_id: planned.productTypeId,
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO products (id, name, slug, category_id, product_type_id, source_ref)
           SELECT x.id::uuid, x.name, x.slug, x.category_id::uuid, x.product_type_id::uuid,
                  x.source_ref
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, name text, slug text, category_id text, product_type_id text,
                    source_ref text)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                name: row.name,
                slug: row.slug,
                category_id: row.categoryId,
                product_type_id: row.productTypeId,
                source_ref: row.sourceRef,
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileProductSegments(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "product_segments",
      rows: rows.productSegments,
      identityOf: (row) => `${row.productId}\u0000${row.segmentId}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT product_id, segment_id FROM product_segments`,
        );
        return new Map(
          found.map((row) => [
            `${String(row["product_id"])}\u0000${String(row["segment_id"])}`,
            row,
          ]),
        );
      },
      // The pair IS the row. There is nothing else to disagree about.
      compare: () => [],
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO product_segments (product_id, segment_id)
           SELECT x.product_id::uuid, x.segment_id::uuid
             FROM jsonb_to_recordset($1::jsonb) AS x(product_id text, segment_id text)`,
            JSON.stringify(
              chunk.map((row) => ({ product_id: row.productId, segment_id: row.segmentId })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileProductGrades(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "product_grades",
      rows: rows.productGrades,
      identityOf: (row) => `${row.productId}\u0000${row.label}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, product_id, label, grade_system, sort_order FROM product_grades`,
        );
        return new Map(
          found.map((row) => [`${String(row["product_id"])}\u0000${String(row["label"])}`, row]),
        );
      },
      compare: (planned, existing) =>
        differences(
          {
            id: planned.id,
            grade_system: enumOrNull(planned.gradeSystem),
            sort_order: planned.sortOrder,
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO product_grades (id, product_id, label, grade_system, sort_order)
           SELECT x.id::uuid, x.product_id::uuid, x.label, x.grade_system::grade_system,
                  x.sort_order
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, product_id text, label text, grade_system text, sort_order int)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                product_id: row.productId,
                label: row.label,
                grade_system: enumOrNull(row.gradeSystem),
                sort_order: row.sortOrder,
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

/**
 * SourceFacts, keyed by the evidence identity `source_facts_evidence_identity_key` indexes.
 *
 * `import_run_id` is deliberately NOT compared. It records which run first read the fact, and
 * a later run re-reading an unchanged fact must not make that a conflict — the reading did
 * not change, so the fact did not change.
 *
 * `ON CONFLICT DO NOTHING` is on the insert, after the comparison has already passed, because
 * ADR-015 §10 requires it: `DO UPDATE` would fire `source_facts_immutable_guard` and abort.
 */
async function reconcileSourceFacts(
  tx: ApplyTransaction,
  rows: ApplyRows,
  importRunId: string,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "source_facts",
      rows: rows.sourceFacts,
      // The DATABASE form of the identity, not the planner's. `sourceFactKey` names the
      // document by its plan-side key and joins on NUL; the persisted row names it by
      // `source_document_id`. Both sides of this comparison must speak the same one.
      identityOf: plannedEvidenceIdentity,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, source_document_id, page_number, sheet_name, row_number, column_label,
                raw_property, raw_unit, raw_value, raw_method, raw_grade,
                extraction_method, unit_classification, result_basis_override
           FROM source_facts`,
        );
        return new Map(found.map((row) => [evidenceIdentityOf(row), row]));
      },
      compare: (planned, existing) =>
        differences(
          {
            extraction_method: dbEnum(planned.extractionMethod),
            unit_classification: dbEnum(planned.unitClassification),
            result_basis_override: enumOrNull(planned.resultBasisOverride),
          },
          existing,
        ),
      insert: async (missing) => {
        if (mode !== "FIRST_APPLY") {
          throw new ApplyPreflightError(
            `A replay would insert ${String(missing.length)} SourceFacts. Every ratified ` +
              `identity is persisted but its evidence is not, which is a partial catalogue.`,
          );
        }
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO source_facts
             (id, source_document_id, import_run_id, page_number, sheet_name, row_number,
              column_label, raw_property, raw_unit, raw_value, raw_method, raw_grade,
              extraction_method, unit_classification, result_basis_override)
           SELECT x.id::uuid, x.source_document_id::uuid, $2::uuid, x.page_number, x.sheet_name,
                  x.row_number, x.column_label, x.raw_property, x.raw_unit, x.raw_value,
                  x.raw_method, x.raw_grade, x.extraction_method::extraction_method,
                  x.unit_classification::source_unit_classification,
                  x.result_basis_override::result_basis
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, source_document_id text, page_number int, sheet_name text,
                    row_number int, column_label text, raw_property text, raw_unit text,
                    raw_value text, raw_method text, raw_grade text, extraction_method text,
                    unit_classification text, result_basis_override text)
           ON CONFLICT DO NOTHING`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                source_document_id: row.sourceDocumentId,
                page_number: row.pageNumber,
                sheet_name: row.sheetName,
                row_number: row.rowNumber,
                column_label: row.columnLabel,
                raw_property: row.rawProperty,
                raw_unit: row.rawUnit,
                raw_value: row.rawValue,
                raw_method: row.rawMethod,
                raw_grade: row.rawGrade,
                extraction_method: dbEnum(row.extractionMethod),
                unit_classification: dbEnum(row.unitClassification),
                result_basis_override: enumOrNull(row.resultBasisOverride),
              })),
            ),
            importRunId,
          );
        }
      },
    },
    mode,
  );
}

/**
 * The evidence identity as the DATABASE holds it. Must agree column for column with the
 * planner's `sourceFactKey`, minus the document key, which is a plan-side label for the row
 * that `source_document_id` is on the database side.
 */
function evidenceIdentityOf(row: Record<string, unknown>): string {
  const text = (column: string): string => {
    const value = row[column];
    return value === null || value === undefined ? "" : String(value);
  };
  return [
    text("source_document_id"),
    text("sheet_name"),
    text("page_number"),
    text("row_number"),
    text("column_label"),
    text("raw_property"),
    text("raw_unit"),
    text("raw_value"),
    text("raw_method"),
    text("raw_grade"),
  ].join("\u0000");
}

/** The same identity, computed from the planned row, so the two are compared like for like. */
function plannedEvidenceIdentity(row: ApplyRows["sourceFacts"][number]): string {
  return [
    row.sourceDocumentId,
    row.sheetName ?? "",
    row.pageNumber === null ? "" : String(row.pageNumber),
    row.rowNumber === null ? "" : String(row.rowNumber),
    row.columnLabel ?? "",
    row.rawProperty ?? "",
    row.rawUnit ?? "",
    row.rawValue,
    row.rawMethod ?? "",
    row.rawGrade ?? "",
  ].join("\u0000");
}

/**
 * Maps each planned evidence identity to the id the database ACTUALLY holds.
 *
 * Not the derived id: a fact inserted by an earlier run, or by a run whose namespace differed,
 * still carries the same natural key, and the evidence link has to point at the row that is
 * really there. A planned fact with no persisted row is a missing insert and stops the apply.
 */
async function readSourceFactIds(
  tx: ApplyTransaction,
  rows: ApplyRows,
): Promise<ReadonlyMap<string, string>> {
  const found = await tx.query<Record<string, unknown>>(
    `SELECT id, source_document_id, page_number, sheet_name, row_number, column_label,
            raw_property, raw_unit, raw_value, raw_method, raw_grade
       FROM source_facts`,
  );
  const byIdentity = new Map(found.map((row) => [evidenceIdentityOf(row), String(row["id"])]));
  const out = new Map<string, string>();
  for (const row of rows.sourceFacts) {
    const id = byIdentity.get(plannedEvidenceIdentity(row));
    if (id === undefined) {
      throw new ApplyExecutionError(
        `A planned SourceFact has no persisted row after the insert step. Evidence cannot be ` +
          `linked to a reading that is not there.`,
      );
    }
    out.set(row.evidenceIdentity, id);
  }
  return out;
}

async function reconcileSpecifications(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "specifications",
      rows: rows.specifications,
      identityOf: (row) =>
        `${row.productId}\u0000${row.productGradeId ?? ""}\u0000${row.propertyKey}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, product_id, product_grade_id, property_key, key, value, unit, display_value,
                method, qualifier, value_type, result_basis, review_status, sort_order,
                numeric_min, numeric_max, pair_first, pair_second
           FROM specifications WHERE deleted_at IS NULL`,
        );
        return new Map(
          found.map((row) => [
            `${String(row["product_id"])}\u0000${
              row["product_grade_id"] === null ? "" : String(row["product_grade_id"])
            }\u0000${row["property_key"] === null ? "" : String(row["property_key"])}`,
            row,
          ]),
        );
      },
      compare: (planned, existing) =>
        differences(
          {
            id: planned.id,
            key: planned.key,
            value: planned.value,
            unit: planned.unit,
            display_value: planned.displayValue,
            method: planned.method,
            qualifier: planned.qualifier,
            value_type: dbEnum(planned.valueType),
            result_basis: dbEnum(planned.resultBasis),
            review_status: dbEnum(planned.reviewStatus),
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO specifications
             (id, product_id, product_grade_id, property_key, key, value, unit, display_value,
              method, qualifier, value_type, result_basis, review_status, sort_order,
              numeric_min, numeric_max, pair_first, pair_second)
           SELECT x.id::uuid, x.product_id::uuid, x.product_grade_id::uuid, x.property_key,
                  x.key, x.value, x.unit, x.display_value, x.method, x.qualifier,
                  x.value_type::spec_value_type, x.result_basis::result_basis,
                  x.review_status::technical_review_status, x.sort_order,
                  x.numeric_min::numeric, x.numeric_max::numeric,
                  x.pair_first::numeric, x.pair_second::numeric
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, product_id text, product_grade_id text, property_key text,
                    key text, value text, unit text, display_value text, method text,
                    qualifier text, value_type text, result_basis text, review_status text,
                    sort_order int, numeric_min text, numeric_max text, pair_first text,
                    pair_second text)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                product_id: row.productId,
                product_grade_id: row.productGradeId,
                property_key: row.propertyKey,
                key: row.key,
                value: row.value,
                unit: row.unit,
                display_value: row.displayValue,
                method: row.method,
                qualifier: row.qualifier,
                value_type: dbEnum(row.valueType),
                result_basis: dbEnum(row.resultBasis),
                review_status: dbEnum(row.reviewStatus),
                sort_order: row.sortOrder,
                numeric_min: row.numericMin,
                numeric_max: row.numericMax,
                pair_first: row.pairFirst,
                pair_second: row.pairSecond,
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileProductClaims(
  tx: ApplyTransaction,
  rows: ApplyRows,
  mode: ApplyMode,
): Promise<TableOutcome> {
  const identity = (
    productId: string,
    gradeId: string | null,
    kind: string,
    body: string | null,
    code: string | null,
    hash: string,
  ): string => [productId, gradeId ?? "", kind, body ?? "", code ?? "", hash].join("\u0000");

  return reconcile(
    {
      table: "product_claims",
      rows: rows.productClaims,
      identityOf: (row) =>
        identity(
          row.productId,
          row.productGradeId,
          dbEnum(row.kind),
          row.standardBody,
          row.standardCode,
          row.claimIdentityHash,
        ),
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT id, product_id, product_grade_id, kind, standard_body, standard_code,
                context_note, claim_identity_hash, review_status, sort_order
           FROM product_claims WHERE deleted_at IS NULL`,
        );
        return new Map(
          found.map((row) => [
            identity(
              String(row["product_id"]),
              row["product_grade_id"] === null ? null : String(row["product_grade_id"]),
              String(row["kind"]),
              row["standard_body"] === null ? null : String(row["standard_body"]),
              row["standard_code"] === null ? null : String(row["standard_code"]),
              row["claim_identity_hash"] === null ? "" : String(row["claim_identity_hash"]),
            ),
            row,
          ]),
        );
      },
      compare: (planned, existing) =>
        differences(
          {
            id: planned.id,
            context_note: planned.contextNote,
            review_status: dbEnum(planned.reviewStatus),
          },
          existing,
        ),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO product_claims
             (id, product_id, product_grade_id, kind, standard_body, standard_code,
              context_note, claim_identity_hash, review_status, sort_order)
           SELECT x.id::uuid, x.product_id::uuid, x.product_grade_id::uuid,
                  x.kind::product_claim_kind, x.standard_body, x.standard_code, x.context_note,
                  x.claim_identity_hash, x.review_status::technical_review_status, x.sort_order
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    id text, product_id text, product_grade_id text, kind text,
                    standard_body text, standard_code text, context_note text,
                    claim_identity_hash text, review_status text, sort_order int)`,
            JSON.stringify(
              chunk.map((row) => ({
                id: row.id,
                product_id: row.productId,
                product_grade_id: row.productGradeId,
                kind: dbEnum(row.kind),
                standard_body: row.standardBody,
                standard_code: row.standardCode,
                context_note: row.contextNote,
                claim_identity_hash: row.claimIdentityHash,
                review_status: dbEnum(row.reviewStatus),
                sort_order: row.sortOrder,
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileSpecificationEvidence(
  tx: ApplyTransaction,
  rows: ApplyRows,
  factIds: ReadonlyMap<string, string>,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "specification_evidence",
      rows: rows.specificationEvidence,
      identityOf: (row) => `${row.subjectId}\u0000${factIds.get(row.evidenceIdentity) ?? ""}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT specification_id, source_fact_id, role FROM specification_evidence`,
        );
        return new Map(
          found.map((row) => [
            `${String(row["specification_id"])}\u0000${String(row["source_fact_id"])}`,
            row,
          ]),
        );
      },
      compare: (planned, existing) => differences({ role: dbEnum(planned.role) }, existing),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO specification_evidence (specification_id, source_fact_id, role)
           SELECT x.specification_id::uuid, x.source_fact_id::uuid, x.role::evidence_role
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    specification_id text, source_fact_id text, role text)`,
            JSON.stringify(
              chunk.map((row) => ({
                specification_id: row.subjectId,
                source_fact_id: factIds.get(row.evidenceIdentity),
                role: dbEnum(row.role),
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

async function reconcileClaimEvidence(
  tx: ApplyTransaction,
  rows: ApplyRows,
  factIds: ReadonlyMap<string, string>,
  mode: ApplyMode,
): Promise<TableOutcome> {
  return reconcile(
    {
      table: "claim_evidence",
      rows: rows.claimEvidence,
      identityOf: (row) => `${row.subjectId}\u0000${factIds.get(row.evidenceIdentity) ?? ""}`,
      read: async () => {
        const found = await tx.query<Record<string, unknown>>(
          `SELECT product_claim_id, source_fact_id, role FROM claim_evidence`,
        );
        return new Map(
          found.map((row) => [
            `${String(row["product_claim_id"])}\u0000${String(row["source_fact_id"])}`,
            row,
          ]),
        );
      },
      compare: (planned, existing) => differences({ role: dbEnum(planned.role) }, existing),
      insert: async (missing) => {
        for (const chunk of chunked(missing)) {
          await tx.execute(
            `INSERT INTO claim_evidence (product_claim_id, source_fact_id, role)
           SELECT x.product_claim_id::uuid, x.source_fact_id::uuid, x.role::evidence_role
             FROM jsonb_to_recordset($1::jsonb) AS x(
                    product_claim_id text, source_fact_id text, role text)`,
            JSON.stringify(
              chunk.map((row) => ({
                product_claim_id: row.subjectId,
                source_fact_id: factIds.get(row.evidenceIdentity),
                role: dbEnum(row.role),
              })),
            ),
          );
        }
      },
    },
    mode,
  );
}

/* -------------------------------------------------------------------------- */
/* The run                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Opens the run. `finished_at` stays NULL until the post-write verification has passed, which
 * is what makes an abandoned attempt leave the manifest hash unconsumed and a retry possible
 * (ADR-015 §4).
 */
async function insertImportRun(tx: ApplyTransaction, rows: ApplyRows): Promise<void> {
  const existing = await tx.query<{ id: string; finished_at: string | null }>(
    `SELECT id, finished_at FROM import_runs WHERE manifest_hash = $1`,
    rows.importRun.manifestHash,
  );
  if (existing.some((row) => row.finished_at !== null)) {
    throw new ApplyPreflightError(
      `Manifest ${rows.importRun.manifestHash} was already applied successfully.`,
    );
  }
  if (existing.length > 0) {
    // An abandoned attempt left its row behind. Nothing cites it (its facts rolled back with
    // it), so the run converges on the same id rather than accumulating orphans.
    await tx.execute(
      `DELETE FROM import_runs WHERE manifest_hash = $1 AND finished_at IS NULL`,
      rows.importRun.manifestHash,
    );
  }
  await tx.execute(
    `INSERT INTO import_runs (id, importer_version, manifest_hash, started_at, note)
     VALUES ($1::uuid, $2, $3, now(), $4)`,
    rows.importRun.id,
    rows.importRun.importerVersion,
    rows.importRun.manifestHash,
    rows.importRun.note,
  );
}

/** Marks the run successful. Called only after every post-write assertion has passed. */
async function finishImportRun(tx: ApplyTransaction, id: string): Promise<void> {
  const updated = await tx.execute(
    `UPDATE import_runs SET finished_at = now() WHERE id = $1::uuid AND finished_at IS NULL`,
    id,
  );
  if (updated !== 1) {
    throw new ApplyExecutionError(
      `Marking ImportRun ${id} successful updated ${String(updated)} rows, expected 1.`,
    );
  }
}
