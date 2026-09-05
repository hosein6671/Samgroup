/**
 * The `base-oil-onboarding-v1` incremental patch's executor — the ADR-018 write path for the
 * Products workstream's Base Oil catalog onboarding.
 *
 * ── Read this beside `incremental-executor.ts` ──────────────────────────────
 *
 * That file's `coolant-source-layout-v1` cites four SourceFacts that already existed; this
 * patch creates its own two Products, five ProductGrades, four SourceDocuments and twenty
 * SourceFacts from freshly-verified primary-source evidence, because `base-oils` held zero
 * catalog rows to normalize. See `base-oil-patch.ts`'s own doc comment for why this is a
 * deliberate, reported extension of ADR-018's stated scope rather than a silent one — and for
 * the hierarchy decision (two Products, not one; SN 350 identity-only) this executor assumes
 * without re-deriving it.
 *
 * Every ADR-018 safety property still holds: `beginGuardedTransaction` (SERIALIZABLE, advisory
 * lock, bounded timeouts); an APPLICABLE / ALREADY_APPLIED / CONFLICT precondition state machine
 * with no partial-repair path; every Specification born `NEEDS_REVIEW`; zero `TechnicalReview`
 * rows; post-write verification that zero of this patch's rows reach
 * `v_specification_public` before `finished_at` is set; full rollback on any failure via the
 * same Prisma interactive transaction the caller opens.
 */

import { randomUUID } from "node:crypto";

import {
  EvidenceRole,
  ExtractionMethod,
  TechnicalReviewStatus,
} from "../../../../prisma/generated/enums";
import {
  EVIDENCE_SET_HASH_PATTERN,
  specificationEvidenceSetHash,
} from "../../review/evidence-set-hash";

import { beginGuardedTransaction, type ApplyTransaction } from "./apply-engine";
import { dbEnum } from "./executor";

import {
  BASE_OIL_ONBOARDING_PATCH_ID,
  DOCUMENTS,
  GRADES,
  INCREMENTAL_IMPORTER_VERSION,
  PRODUCTS,
  READINGS,
  baseOilOnboardingPatchHash,
  type BaseOilReadingDef,
} from "../incremental/base-oil-patch";

export type BaseOilPatchState = "APPLICABLE" | "ALREADY_APPLIED" | "CONFLICT";

export interface BaseOilInspection {
  readonly patchId: string;
  readonly patchHash: string;
  readonly databaseName: string;
  readonly state: BaseOilPatchState;
  readonly conflicts: readonly string[];
  readonly planned: {
    readonly products: number;
    readonly grades: number;
    readonly sourceDocuments: number;
    readonly sourceFacts: number;
    readonly specifications: number;
    readonly evidenceLinks: number;
  };
}

export interface BaseOilApplyResult extends BaseOilInspection {
  readonly wrote: boolean;
  readonly importRunId: string | null;
  readonly reviewHashesVerified: number;
  readonly publicSpecifications: number;
  readonly stepsCompleted: readonly string[];
}

export interface BaseOilApplyOptions {
  readonly expectedDatabaseName: string;
  readonly expectedPatchHash: string;
  readonly faultInjector?: (step: string) => void | Promise<void>;
}

export class BaseOilPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaseOilPatchError";
  }
}

interface Row {
  readonly [key: string]: unknown;
}

const patchHash = baseOilOnboardingPatchHash();
const PLANNED = {
  products: PRODUCTS.length,
  grades: GRADES.length,
  sourceDocuments: DOCUMENTS.length,
  sourceFacts: READINGS.length,
  specifications: READINGS.length,
  evidenceLinks: READINGS.length,
} as const;

function comparable(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(comparable);
  return value;
}

function differs(row: Row, expected: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(expected)
    .filter(
      ([key, value]) => JSON.stringify(comparable(row[key])) !== JSON.stringify(comparable(value)),
    )
    .map(([key]) => key);
}

async function databaseName(tx: ApplyTransaction): Promise<string> {
  const rows = await tx.query<{ name: string }>(`SELECT current_database() AS name`);
  return rows[0]?.name ?? "";
}

/** Read, never written by this patch — `base-oils` must already exist as a Category. */
async function readCategoryId(tx: ApplyTransaction): Promise<string | null> {
  const rows = await tx.query<{ id: string }>(
    `SELECT id::text AS id FROM categories WHERE slug = 'base-oils'`,
  );
  return rows[0]?.id ?? null;
}

function storedDecimal(value: string | null): string | null {
  return value === null ? null : Number(value).toFixed(6);
}

function desiredProductShape(
  product: (typeof PRODUCTS)[number],
  categoryId: string,
): Readonly<Record<string, unknown>> {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category_id: categoryId,
    source_ref: null,
    description: product.description,
  };
}

function desiredGradeShape(grade: (typeof GRADES)[number]): Readonly<Record<string, unknown>> {
  const product = PRODUCTS.find((p) => p.key === grade.productKey);
  if (!product) throw new BaseOilPatchError(`No product for grade ${grade.key}`);
  return {
    id: grade.id,
    product_id: product.id,
    label: grade.label,
    grade_system: null,
    sort_order: grade.sortOrder,
  };
}

function desiredDocumentShape(
  document: (typeof DOCUMENTS)[number],
): Readonly<Record<string, unknown>> {
  return {
    id: document.id,
    source_asset_id: null,
    locator_type: dbEnum(document.locatorType),
    locator_value: document.locatorValue,
    title: document.title,
    publisher: document.publisher,
    document_date: document.documentDate,
    revision_label: null,
    default_result_basis: dbEnum(document.defaultResultBasis),
    superseded_by_id: null,
  };
}

function readingGrade(reading: BaseOilReadingDef): (typeof GRADES)[number] {
  const grade = GRADES.find((g) => g.key === reading.gradeKey);
  if (!grade) throw new BaseOilPatchError(`No grade for reading ${reading.key}`);
  return grade;
}

function readingProduct(reading: BaseOilReadingDef): (typeof PRODUCTS)[number] {
  const grade = readingGrade(reading);
  const product = PRODUCTS.find((p) => p.key === grade.productKey);
  if (!product) throw new BaseOilPatchError(`No product for reading ${reading.key}`);
  return product;
}

function desiredFactShape(reading: BaseOilReadingDef): Readonly<Record<string, unknown>> {
  const document = DOCUMENTS.find((d) => d.key === reading.documentKey);
  if (!document) throw new BaseOilPatchError(`No document for reading ${reading.key}`);
  return {
    id: reading.factId,
    source_document_id: document.id,
    raw_property: reading.rawProperty,
    raw_unit: reading.rawUnit,
    raw_value: reading.rawValue,
    raw_method: reading.rawMethod,
    extraction_method: dbEnum(ExtractionMethod.MANUAL_TRANSCRIPTION),
    unit_classification: dbEnum(reading.unitClassification),
  };
}

function desiredSpecificationShape(reading: BaseOilReadingDef): Readonly<Record<string, unknown>> {
  return {
    id: reading.specificationId,
    product_id: readingProduct(reading).id,
    product_grade_id: readingGrade(reading).id,
    property_key: reading.propertyKey,
    key: reading.propertyKey,
    value: reading.displayValue,
    unit: reading.unit,
    display_value: reading.displayValue,
    value_type: dbEnum(reading.valueType),
    numeric_min: storedDecimal(reading.numericMin),
    numeric_max: storedDecimal(reading.numericMax),
    pair_first: null,
    pair_second: null,
    method: reading.rawMethod,
    qualifier: null,
    result_basis: (() => {
      const document = DOCUMENTS.find((d) => d.key === reading.documentKey);
      if (!document) throw new BaseOilPatchError(`No document for reading ${reading.key}`);
      return dbEnum(document.defaultResultBasis);
    })(),
    review_status: dbEnum(TechnicalReviewStatus.NEEDS_REVIEW),
    sort_order: reading.sortOrder,
    deleted_at: null,
  };
}

async function readProducts(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text, name, slug, category_id::text, source_ref, description
       FROM products WHERE id = ANY($1::uuid[]) ORDER BY id`,
    PRODUCTS.map((p) => p.id),
  );
}

async function readGrades(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text, product_id::text, label, grade_system, sort_order
       FROM product_grades WHERE id = ANY($1::uuid[]) ORDER BY id`,
    GRADES.map((g) => g.id),
  );
}

async function readDocuments(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text, source_asset_id, locator_type, locator_value, title, publisher,
            document_date::text, revision_label, default_result_basis, superseded_by_id
       FROM source_documents WHERE id = ANY($1::uuid[]) ORDER BY id`,
    DOCUMENTS.map((d) => d.id),
  );
}

async function readFacts(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text, source_document_id::text, raw_property, raw_unit, raw_value, raw_method,
            extraction_method, unit_classification
       FROM source_facts WHERE id = ANY($1::uuid[]) ORDER BY id`,
    READINGS.map((r) => r.factId),
  );
}

async function readSpecifications(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text, product_id::text AS product_id, product_grade_id::text AS product_grade_id,
            property_key, key, value, unit, display_value, value_type,
            numeric_min::text, numeric_max::text, pair_first::text, pair_second::text,
            method, qualifier, result_basis, review_status, sort_order, deleted_at
       FROM specifications WHERE id = ANY($1::uuid[]) ORDER BY id`,
    READINGS.map((r) => r.specificationId),
  );
}

async function readEvidence(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT specification_id::text, source_fact_id::text, role
       FROM specification_evidence
      WHERE specification_id = ANY($1::uuid[])
      ORDER BY specification_id, source_fact_id`,
    READINGS.map((r) => r.specificationId),
  );
}

export async function inspectBaseOilOnboardingPatch(
  tx: ApplyTransaction,
): Promise<BaseOilInspection> {
  const conflicts: string[] = [];
  const categoryId = await readCategoryId(tx);
  if (categoryId === null) {
    conflicts.push(
      `No "base-oils" Category exists. This patch never creates a Category — the family must ` +
        `already exist.`,
    );
  }

  const [products, grades, documents, facts, specifications, evidence, runs] = await Promise.all([
    readProducts(tx),
    readGrades(tx),
    readDocuments(tx),
    readFacts(tx),
    readSpecifications(tx),
    readEvidence(tx),
    tx.query<{ finished_at: string | null }>(
      `SELECT finished_at::text FROM import_runs WHERE manifest_hash = $1`,
      patchHash,
    ),
  ]);

  const productsApplied =
    categoryId !== null &&
    products.length === PRODUCTS.length &&
    PRODUCTS.every((wanted) => {
      const found = products.find((row) => row["id"] === wanted.id);
      return (
        found !== undefined && differs(found, desiredProductShape(wanted, categoryId)).length === 0
      );
    });
  const gradesApplied =
    grades.length === GRADES.length &&
    GRADES.every((wanted) => {
      const found = grades.find((row) => row["id"] === wanted.id);
      return found !== undefined && differs(found, desiredGradeShape(wanted)).length === 0;
    });
  const documentsApplied =
    documents.length === DOCUMENTS.length &&
    DOCUMENTS.every((wanted) => {
      const found = documents.find((row) => row["id"] === wanted.id);
      return found !== undefined && differs(found, desiredDocumentShape(wanted)).length === 0;
    });
  const factsApplied =
    facts.length === READINGS.length &&
    READINGS.every((wanted) => {
      const found = facts.find((row) => row["id"] === wanted.factId);
      return found !== undefined && differs(found, desiredFactShape(wanted)).length === 0;
    });
  const specificationsApplied =
    specifications.length === READINGS.length &&
    READINGS.every((wanted) => {
      const found = specifications.find((row) => row["id"] === wanted.specificationId);
      return found !== undefined && differs(found, desiredSpecificationShape(wanted)).length === 0;
    });
  const evidenceApplied =
    evidence.length === READINGS.length &&
    READINGS.every((wanted) =>
      evidence.some(
        (row) =>
          differs(row, {
            specification_id: wanted.specificationId,
            source_fact_id: wanted.factId,
            role: dbEnum(EvidenceRole.PRIMARY),
            note: null,
          }).length === 0,
      ),
    );
  const runFinished = runs.length === 1 && runs[0]?.finished_at !== null;

  const cleanBefore =
    products.length === 0 &&
    grades.length === 0 &&
    documents.length === 0 &&
    facts.length === 0 &&
    specifications.length === 0 &&
    evidence.length === 0 &&
    runs.length === 0;
  const cleanAfter =
    productsApplied &&
    gradesApplied &&
    documentsApplied &&
    factsApplied &&
    specificationsApplied &&
    evidenceApplied &&
    runFinished;

  if (!cleanBefore && !cleanAfter) {
    conflicts.push(
      "Target rows are in a partial or unexpected state; the patch refuses to repair or " +
        "overwrite them.",
    );
  }

  return {
    patchId: BASE_OIL_ONBOARDING_PATCH_ID,
    patchHash,
    databaseName: await databaseName(tx),
    state: conflicts.length > 0 ? "CONFLICT" : cleanAfter ? "ALREADY_APPLIED" : "APPLICABLE",
    conflicts,
    planned: PLANNED,
  };
}

async function insertRun(tx: ApplyTransaction): Promise<string> {
  const id = randomUUID();
  await tx.execute(
    `INSERT INTO import_runs (id, importer_version, manifest_hash, started_at, note)
     VALUES ($1::uuid, $2, $3, now(), $4)`,
    id,
    INCREMENTAL_IMPORTER_VERSION,
    patchHash,
    `Incremental catalog patch ${BASE_OIL_ONBOARDING_PATCH_ID}; onboards Base Oil Group I and ` +
      `Bright Stock catalog identity and grade-level Specifications from freshly-verified ` +
      `primary-source evidence; stores no source bytes.`,
  );
  return id;
}

async function writePatch(tx: ApplyTransaction, categoryId: string, runId: string): Promise<void> {
  await tx.execute(
    `INSERT INTO products (id, name, slug, category_id, source_ref, description)
     SELECT x.id::uuid, x.name, x.slug, $2::uuid, NULL, x.description
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, name text, slug text, description text)`,
    JSON.stringify(
      PRODUCTS.map((p) => ({ id: p.id, name: p.name, slug: p.slug, description: p.description })),
    ),
    categoryId,
  );

  await tx.execute(
    `INSERT INTO product_grades (id, product_id, label, grade_system, sort_order)
     SELECT x.id::uuid, x.product_id::uuid, x.label, NULL, x.sort_order
       FROM jsonb_to_recordset($1::jsonb)
         AS x(id text, product_id text, label text, sort_order int)`,
    JSON.stringify(
      GRADES.map((g) => {
        const product = PRODUCTS.find((p) => p.key === g.productKey);
        if (!product) throw new BaseOilPatchError(`No product for grade ${g.key}`);
        return { id: g.id, product_id: product.id, label: g.label, sort_order: g.sortOrder };
      }),
    ),
  );

  await tx.execute(
    `INSERT INTO source_documents
       (id, source_asset_id, locator_type, locator_value, title, publisher, document_date,
        default_result_basis, retrieved_at)
     SELECT x.id::uuid, NULL, x.locator_type::source_locator_type, x.locator_value, x.title,
            x.publisher, x.document_date::date, x.default_result_basis::result_basis,
            x.retrieved_at::timestamptz
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, locator_type text, locator_value text, title text, publisher text,
         document_date text, default_result_basis text, retrieved_at text)
     ON CONFLICT (id) DO NOTHING`,
    JSON.stringify(
      DOCUMENTS.map((d) => ({
        id: d.id,
        locator_type: dbEnum(d.locatorType),
        locator_value: d.locatorValue,
        title: d.title,
        publisher: d.publisher,
        document_date: d.documentDate,
        default_result_basis: dbEnum(d.defaultResultBasis),
        retrieved_at: d.retrievedAt,
      })),
    ),
  );

  await tx.execute(
    `INSERT INTO source_facts
       (id, source_document_id, import_run_id, raw_property, raw_unit, raw_value, raw_method,
        extraction_method, unit_classification)
     SELECT x.id::uuid, x.source_document_id::uuid, $2::uuid, x.raw_property, x.raw_unit,
            x.raw_value, x.raw_method, x.extraction_method::extraction_method,
            x.unit_classification::source_unit_classification
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, source_document_id text, raw_property text, raw_unit text, raw_value text,
         raw_method text, extraction_method text, unit_classification text)
     ON CONFLICT (id) DO NOTHING`,
    JSON.stringify(
      READINGS.map((r) => {
        const document = DOCUMENTS.find((d) => d.key === r.documentKey);
        if (!document) throw new BaseOilPatchError(`No document for reading ${r.key}`);
        return {
          id: r.factId,
          source_document_id: document.id,
          raw_property: r.rawProperty,
          raw_unit: r.rawUnit,
          raw_value: r.rawValue,
          raw_method: r.rawMethod,
          extraction_method: dbEnum(ExtractionMethod.MANUAL_TRANSCRIPTION),
          unit_classification: dbEnum(r.unitClassification),
        };
      }),
    ),
    runId,
  );

  await tx.execute(
    `INSERT INTO specifications
       (id, product_id, product_grade_id, property_key, key, value, unit, display_value,
        value_type, numeric_min, numeric_max, method, result_basis, review_status, sort_order)
     SELECT x.id::uuid, x.product_id::uuid, x.product_grade_id::uuid, x.property_key,
            x.property_key, x.display_value, x.unit, x.display_value,
            x.value_type::spec_value_type, x.numeric_min::numeric, x.numeric_max::numeric,
            x.method, x.result_basis::result_basis, 'needs_review'::technical_review_status,
            x.sort_order
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, product_id text, product_grade_id text, property_key text,
         display_value text, unit text, value_type text, numeric_min text, numeric_max text,
         method text, result_basis text, sort_order int)`,
    JSON.stringify(
      READINGS.map((r) => ({
        id: r.specificationId,
        product_id: readingProduct(r).id,
        product_grade_id: readingGrade(r).id,
        property_key: r.propertyKey,
        display_value: r.displayValue,
        unit: r.unit,
        value_type: dbEnum(r.valueType),
        numeric_min: r.numericMin,
        numeric_max: r.numericMax,
        method: r.rawMethod,
        result_basis: (() => {
          const document = DOCUMENTS.find((d) => d.key === r.documentKey);
          if (!document) throw new BaseOilPatchError(`No document for reading ${r.key}`);
          return dbEnum(document.defaultResultBasis);
        })(),
        sort_order: r.sortOrder,
      })),
    ),
  );

  await tx.execute(
    `INSERT INTO specification_evidence (specification_id, source_fact_id, role)
     SELECT x.specification_id::uuid, x.source_fact_id::uuid, x.role::evidence_role
       FROM jsonb_to_recordset($1::jsonb) AS x(specification_id text, source_fact_id text, role text)`,
    JSON.stringify(
      READINGS.map((r) => ({
        specification_id: r.specificationId,
        source_fact_id: r.factId,
        role: dbEnum(EvidenceRole.PRIMARY),
      })),
    ),
  );
}

async function verifyPatch(tx: ApplyTransaction): Promise<{ hashes: number; publicRows: number }> {
  const inspection = await inspectBaseOilOnboardingPatch(tx);
  const hashClient = {
    $queryRawUnsafe: <T>(sql: string, ...values: unknown[]): Promise<T> =>
      tx.query<unknown>(sql, ...values) as Promise<T>,
  };
  const hashes = await Promise.all(
    READINGS.map((r) => specificationEvidenceSetHash(hashClient, r.specificationId)),
  );
  const validHashCount = hashes.filter(
    (hash): hash is string => hash !== null && EVIDENCE_SET_HASH_PATTERN.test(hash),
  ).length;
  const rows = await tx.query<{ public_rows: number; reviews: number; approved: number }>(
    `SELECT
       (SELECT count(*)::int FROM v_specification_public v WHERE v.id = ANY($1::uuid[])) AS public_rows,
       (SELECT count(*)::int FROM technical_reviews tr WHERE tr.specification_id = ANY($1::uuid[])) AS reviews,
       count(*) FILTER (WHERE s.review_status = 'approved')::int AS approved
     FROM specifications s WHERE s.id = ANY($1::uuid[])`,
    READINGS.map((r) => r.specificationId),
  );
  const found = rows[0];
  if (
    !found ||
    validHashCount !== READINGS.length ||
    found.public_rows !== 0 ||
    found.reviews !== 0 ||
    found.approved !== 0
  ) {
    throw new BaseOilPatchError(
      `Post-write verification failed (hashes=${String(validHashCount)}, ` +
        `public=${String(found?.public_rows)}, reviews=${String(found?.reviews)}, ` +
        `approved=${String(found?.approved)}).`,
    );
  }
  if (
    inspection.state !== "CONFLICT" ||
    inspection.conflicts.length === 0 ||
    !inspection.conflicts.every((message) => message.startsWith("Target rows are"))
  ) {
    throw new BaseOilPatchError(`Post-write source verification failed.`);
  }
  return { hashes: validHashCount, publicRows: found.public_rows };
}

export async function executeBaseOilOnboardingPatch(
  tx: ApplyTransaction,
  options: BaseOilApplyOptions,
): Promise<BaseOilApplyResult> {
  const steps: string[] = [];
  const done = async (step: string): Promise<void> => {
    steps.push(step);
    if (options.faultInjector) await options.faultInjector(step);
  };

  await beginGuardedTransaction(tx);
  await done("guarded-transaction");
  const actualDatabase = await databaseName(tx);
  if (actualDatabase !== options.expectedDatabaseName) {
    throw new BaseOilPatchError(
      `Connected to "${actualDatabase}", authorized for "${options.expectedDatabaseName}".`,
    );
  }
  if (options.expectedPatchHash !== patchHash) {
    throw new BaseOilPatchError(
      `Patch hash mismatch: expected ${options.expectedPatchHash}, actual ${patchHash}.`,
    );
  }
  const before = await inspectBaseOilOnboardingPatch(tx);
  if (before.state === "CONFLICT") throw new BaseOilPatchError(before.conflicts.join(" "));
  if (before.state === "ALREADY_APPLIED") {
    return {
      ...before,
      wrote: false,
      importRunId: null,
      reviewHashesVerified: READINGS.length,
      publicSpecifications: 0,
      stepsCompleted: steps,
    };
  }
  await done("preflight");

  const categoryId = await readCategoryId(tx);
  if (categoryId === null) {
    throw new BaseOilPatchError(`No "base-oils" Category exists; refusing to write.`);
  }

  const runId = await insertRun(tx);
  await done("import-run");
  await writePatch(tx, categoryId, runId);
  await done("patch-write");
  const verified = await verifyPatch(tx);
  await done("post-write-verification");
  const finished = await tx.execute(
    `UPDATE import_runs SET finished_at = now() WHERE id = $1::uuid AND finished_at IS NULL`,
    runId,
  );
  if (finished !== 1) throw new BaseOilPatchError(`ImportRun did not finish exactly once.`);
  await done("import-run-finished");

  const after = await inspectBaseOilOnboardingPatch(tx);
  if (after.state !== "ALREADY_APPLIED") {
    throw new BaseOilPatchError(
      `Committed-state verification did not converge: ${after.conflicts.join(" ") || after.state}.`,
    );
  }
  return {
    ...after,
    wrote: true,
    importRunId: runId,
    reviewHashesVerified: verified.hashes,
    publicSpecifications: verified.publicRows,
    stepsCompleted: steps,
  };
}
