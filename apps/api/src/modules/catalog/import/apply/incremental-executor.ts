import { TechnicalReviewStatus } from "../../../../prisma/generated/enums";
import {
  EVIDENCE_SET_HASH_PATTERN,
  specificationEvidenceSetHash,
} from "../../review/evidence-set-hash";

import { beginGuardedTransaction, type ApplyTransaction } from "./apply-engine";
import { dbEnum } from "./executor";
import * as ids from "./identities";

import { incrementalPatchHash } from "../incremental/manifest";
import {
  COOLANT_NORMALIZATION_PATCH,
  INCREMENTAL_IMPORTER_VERSION,
  LEGACY_MAPPING_STATE,
  patchEvidence,
  patchMappings,
  patchProperties,
  patchSpecifications,
} from "../incremental/patch";

export type IncrementalPatchState = "APPLICABLE" | "ALREADY_APPLIED" | "CONFLICT";

export interface IncrementalInspection {
  readonly patchId: string;
  readonly patchHash: string;
  readonly databaseName: string;
  readonly state: IncrementalPatchState;
  readonly conflicts: readonly string[];
  readonly planned: {
    readonly specProperties: 2;
    readonly mappingUpdates: 2;
    readonly specifications: 4;
    readonly evidenceLinks: 4;
  };
}

export interface IncrementalApplyResult extends IncrementalInspection {
  readonly wrote: boolean;
  readonly importRunId: string | null;
  readonly reviewHashesVerified: number;
  readonly publicSpecifications: number;
  readonly stepsCompleted: readonly string[];
}

export interface IncrementalApplyOptions {
  readonly expectedDatabaseName: string;
  readonly expectedPatchHash: string;
  readonly faultInjector?: (step: string) => void | Promise<void>;
}

export class IncrementalPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncrementalPatchError";
  }
}

interface Row {
  readonly [key: string]: unknown;
}

const desiredProperties = patchProperties();
const desiredMappings = patchMappings();
const desiredSpecifications = patchSpecifications();
const desiredEvidence = patchEvidence();
const patchHash = incrementalPatchHash(COOLANT_NORMALIZATION_PATCH);

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

async function inspectFactsAndProducts(tx: ApplyTransaction): Promise<string[]> {
  const conflicts: string[] = [];
  for (const fact of COOLANT_NORMALIZATION_PATCH.facts) {
    const rows = await tx.query<Row>(
      `SELECT sf.id::text AS id, sf.raw_property, sf.raw_unit, sf.raw_value, sf.raw_method,
              sd.title AS document_title, p.id::text AS product_id, p.source_ref
         FROM source_facts sf
         JOIN source_documents sd ON sd.id = sf.source_document_id
         CROSS JOIN LATERAL (
           SELECT id, source_ref FROM products WHERE source_ref = $2
         ) p
        WHERE sf.id = $1::uuid`,
      fact.sourceFactId,
      fact.productSourceRef,
    );
    if (rows.length !== 1) {
      conflicts.push(`${fact.sourceFactId}: expected one immutable SourceFact and Product.`);
      continue;
    }
    const difference = differs(rows[0] ?? {}, {
      id: fact.sourceFactId,
      raw_property: fact.rawProperty,
      raw_unit: fact.rawUnit,
      raw_value: fact.rawValue,
      raw_method: fact.rawMethod,
      document_title: fact.documentTitle,
      product_id: ids.productId(fact.productSourceRef),
      source_ref: fact.productSourceRef,
    });
    if (difference.length > 0) {
      conflicts.push(
        `${fact.sourceFactId}: source precondition differs (${difference.join(", ")}).`,
      );
    }
  }
  return conflicts;
}

async function readProperties(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT key, canonical_meaning, quantity, value_kind, allowed_units, method_requirement
       FROM spec_properties WHERE key = ANY($1::text[]) ORDER BY key`,
    desiredProperties.map((row) => row.key),
  );
}

async function readMappings(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text AS id, raw_property, raw_unit, spec_property_key, confidence,
            review_status, note
       FROM spec_property_mappings
      WHERE raw_property = ANY($1::text[]) AND raw_unit IS NULL
      ORDER BY raw_property`,
    desiredMappings.map((row) => row.rawProperty),
  );
}

async function readSpecifications(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT id::text AS id, product_id::text AS product_id,
            product_grade_id::text AS product_grade_id, property_key, key, value, unit,
            display_value, value_type, numeric_min::text, numeric_max::text,
            pair_first::text, pair_second::text, method, qualifier, result_basis,
            review_status, sort_order, deleted_at
       FROM specifications WHERE id = ANY($1::uuid[]) ORDER BY id`,
    desiredSpecifications.map((row) => row.id),
  );
}

async function readEvidence(tx: ApplyTransaction): Promise<Row[]> {
  return tx.query<Row>(
    `SELECT specification_id::text, source_fact_id::text, role, note
       FROM specification_evidence
      WHERE specification_id = ANY($1::uuid[])
      ORDER BY specification_id, source_fact_id`,
    desiredSpecifications.map((row) => row.id),
  );
}

function desiredPropertyShape(
  row: (typeof desiredProperties)[number],
): Readonly<Record<string, unknown>> {
  return {
    key: row.key,
    canonical_meaning: row.canonicalMeaning,
    quantity: row.quantity,
    value_kind: dbEnum(row.valueKind),
    allowed_units: [...row.allowedUnits],
    method_requirement: dbEnum(row.methodRequirement),
  };
}

function desiredMappingShape(
  row: (typeof desiredMappings)[number],
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    raw_property: row.rawProperty,
    raw_unit: row.rawUnit,
    spec_property_key: row.specPropertyKey,
    confidence: dbEnum(row.confidence),
    review_status: dbEnum(row.reviewStatus),
    note: row.note,
  };
}

function legacyMappingShape(
  row: (typeof desiredMappings)[number],
): Readonly<Record<string, unknown>> {
  const legacy = LEGACY_MAPPING_STATE[row.rawProperty as keyof typeof LEGACY_MAPPING_STATE];
  return {
    id: row.id,
    raw_property: row.rawProperty,
    raw_unit: null,
    spec_property_key: legacy.specPropertyKey,
    confidence: dbEnum(legacy.confidence),
    review_status: dbEnum(legacy.reviewStatus),
    note: legacy.note,
  };
}

function storedDecimal(value: string | null): string | null {
  return value === null ? null : Number(value).toFixed(6);
}

function desiredSpecificationShape(
  row: (typeof desiredSpecifications)[number],
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    product_id: row.productId,
    product_grade_id: null,
    property_key: row.propertyKey,
    key: row.key,
    value: row.value,
    unit: row.unit,
    display_value: row.displayValue,
    value_type: dbEnum(row.valueType),
    numeric_min: storedDecimal(row.numericMin),
    numeric_max: storedDecimal(row.numericMax),
    pair_first: null,
    pair_second: null,
    method: row.method,
    qualifier: null,
    result_basis: dbEnum(row.resultBasis),
    review_status: dbEnum(row.reviewStatus),
    sort_order: row.sortOrder,
    deleted_at: null,
  };
}

export async function inspectCoolantNormalizationPatch(
  tx: ApplyTransaction,
): Promise<IncrementalInspection> {
  const conflicts = await inspectFactsAndProducts(tx);
  const [properties, mappings, specifications, evidence, runs] = await Promise.all([
    readProperties(tx),
    readMappings(tx),
    readSpecifications(tx),
    readEvidence(tx),
    tx.query<{ finished_at: string | null }>(
      `SELECT finished_at::text FROM import_runs WHERE manifest_hash = $1`,
      patchHash,
    ),
  ]);

  const propertiesApplied =
    properties.length === desiredProperties.length &&
    desiredProperties.every((wanted) => {
      const found = properties.find((row) => row["key"] === wanted.key);
      return found !== undefined && differs(found, desiredPropertyShape(wanted)).length === 0;
    });
  const mappingsLegacy =
    mappings.length === desiredMappings.length &&
    desiredMappings.every((wanted) => {
      const found = mappings.find((row) => row["id"] === wanted.id);
      return found !== undefined && differs(found, legacyMappingShape(wanted)).length === 0;
    });
  const mappingsApplied =
    mappings.length === desiredMappings.length &&
    desiredMappings.every((wanted) => {
      const found = mappings.find((row) => row["id"] === wanted.id);
      return found !== undefined && differs(found, desiredMappingShape(wanted)).length === 0;
    });
  const specificationsApplied =
    specifications.length === desiredSpecifications.length &&
    desiredSpecifications.every((wanted) => {
      const found = specifications.find((row) => row["id"] === wanted.id);
      return found !== undefined && differs(found, desiredSpecificationShape(wanted)).length === 0;
    });
  const evidenceApplied =
    evidence.length === desiredEvidence.length &&
    desiredEvidence.every((wanted) =>
      evidence.some(
        (row) =>
          differs(row, {
            specification_id: wanted.specificationId,
            source_fact_id: wanted.sourceFactId,
            role: dbEnum(wanted.role),
            note: null,
          }).length === 0,
      ),
    );
  const runFinished = runs.length === 1 && runs[0]?.finished_at !== null;

  const cleanBefore =
    properties.length === 0 &&
    mappingsLegacy &&
    specifications.length === 0 &&
    evidence.length === 0 &&
    runs.length === 0;
  const cleanAfter =
    propertiesApplied && mappingsApplied && specificationsApplied && evidenceApplied && runFinished;

  if (!cleanBefore && !cleanAfter) {
    conflicts.push(
      "Target rows are in a partial or unexpected state; the patch refuses to repair or overwrite them.",
    );
  }

  return {
    patchId: COOLANT_NORMALIZATION_PATCH.patchId,
    patchHash,
    databaseName: await databaseName(tx),
    state: conflicts.length > 0 ? "CONFLICT" : cleanAfter ? "ALREADY_APPLIED" : "APPLICABLE",
    conflicts,
    planned: {
      specProperties: 2,
      mappingUpdates: 2,
      specifications: 4,
      evidenceLinks: 4,
    },
  };
}

async function insertRun(tx: ApplyTransaction): Promise<string> {
  const id = ids.importRunId(patchHash);
  await tx.execute(
    `INSERT INTO import_runs (id, importer_version, manifest_hash, started_at, note)
     VALUES ($1::uuid, $2, $3, now(), $4)`,
    id,
    INCREMENTAL_IMPORTER_VERSION,
    patchHash,
    `Incremental catalog patch ${COOLANT_NORMALIZATION_PATCH.patchId}; reuses immutable SourceFacts and stores no source bytes.`,
  );
  return id;
}

async function writePatch(tx: ApplyTransaction): Promise<void> {
  await tx.execute(
    `INSERT INTO spec_properties
       (key, canonical_meaning, quantity, value_kind, allowed_units, method_requirement)
     SELECT x.key, x.canonical_meaning, x.quantity, x.value_kind::spec_value_kind,
            x.allowed_units, x.method_requirement::method_requirement
       FROM jsonb_to_recordset($1::jsonb) AS x(
         key text, canonical_meaning text, quantity text, value_kind text,
         allowed_units text[], method_requirement text)`,
    JSON.stringify(desiredProperties.map(desiredPropertyShape)),
  );

  for (const mapping of desiredMappings) {
    const legacy = legacyMappingShape(mapping);
    const updated = await tx.execute(
      `UPDATE spec_property_mappings
          SET spec_property_key = $2, confidence = $3::mapping_confidence, note = $4
        WHERE id = $1::uuid
          AND raw_property = $5 AND raw_unit IS NULL
          AND spec_property_key IS NULL
          AND confidence = $6::mapping_confidence
          AND review_status = $7::technical_review_status
          AND note = $8`,
      mapping.id,
      mapping.specPropertyKey,
      dbEnum(mapping.confidence),
      mapping.note,
      mapping.rawProperty,
      legacy.confidence,
      legacy.review_status,
      legacy.note,
    );
    if (updated !== 1) throw new IncrementalPatchError(`${mapping.rawProperty}: mapping changed.`);
  }

  await tx.execute(
    `INSERT INTO specifications
       (id, product_id, product_grade_id, property_key, key, value, unit, display_value,
        value_type, numeric_min, numeric_max, pair_first, pair_second, method, qualifier,
        result_basis, review_status, sort_order)
     SELECT x.id::uuid, x.product_id::uuid, NULL, x.property_key, x.key, x.value, x.unit,
            x.display_value, x.value_type::spec_value_type, x.numeric_min::numeric,
            x.numeric_max::numeric, NULL, NULL, x.method, NULL, x.result_basis::result_basis,
            x.review_status::technical_review_status, x.sort_order
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, product_id text, property_key text, key text, value text, unit text,
         display_value text, value_type text, numeric_min text, numeric_max text,
         method text, result_basis text, review_status text, sort_order int)`,
    JSON.stringify(desiredSpecifications.map(desiredSpecificationShape)),
  );

  await tx.execute(
    `INSERT INTO specification_evidence (specification_id, source_fact_id, role)
     SELECT x.specification_id::uuid, x.source_fact_id::uuid, x.role::evidence_role
       FROM jsonb_to_recordset($1::jsonb) AS x(
         specification_id text, source_fact_id text, role text)`,
    JSON.stringify(
      desiredEvidence.map((row) => ({
        specification_id: row.specificationId,
        source_fact_id: row.sourceFactId,
        role: dbEnum(row.role),
      })),
    ),
  );
}

async function verifyPatch(tx: ApplyTransaction): Promise<{ hashes: number; publicRows: number }> {
  const inspection = await inspectCoolantNormalizationPatch(tx);
  // The run is deliberately unfinished during verification, so the state must be partial only
  // because of that one auditable fact. Verify the row payloads separately below.
  const hashClient = {
    $queryRawUnsafe: <T>(sql: string, ...values: unknown[]): Promise<T> =>
      tx.query<unknown>(sql, ...values) as Promise<T>,
  };
  const hashes = await Promise.all(
    desiredSpecifications.map((row) => specificationEvidenceSetHash(hashClient, row.id)),
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
    desiredSpecifications.map((row) => row.id),
  );
  const found = rows[0];
  if (
    !found ||
    validHashCount !== 4 ||
    found.public_rows !== 0 ||
    found.reviews !== 0 ||
    found.approved !== 0
  ) {
    throw new IncrementalPatchError(
      `Post-write verification failed (hashes=${String(validHashCount)}, public=${String(found?.public_rows)}, reviews=${String(found?.reviews)}, approved=${String(found?.approved)}).`,
    );
  }
  if (
    inspection.state !== "CONFLICT" ||
    inspection.conflicts.length === 0 ||
    !inspection.conflicts.every((message) => message.startsWith("Target rows are"))
  ) {
    throw new IncrementalPatchError(`Post-write source verification failed.`);
  }
  return { hashes: validHashCount, publicRows: found.public_rows };
}

export async function executeCoolantNormalizationPatch(
  tx: ApplyTransaction,
  options: IncrementalApplyOptions,
): Promise<IncrementalApplyResult> {
  const steps: string[] = [];
  const done = async (step: string): Promise<void> => {
    steps.push(step);
    if (options.faultInjector) await options.faultInjector(step);
  };

  await beginGuardedTransaction(tx);
  await done("guarded-transaction");
  const actualDatabase = await databaseName(tx);
  if (actualDatabase !== options.expectedDatabaseName) {
    throw new IncrementalPatchError(
      `Connected to "${actualDatabase}", authorized for "${options.expectedDatabaseName}".`,
    );
  }
  if (options.expectedPatchHash !== patchHash) {
    throw new IncrementalPatchError(
      `Patch hash mismatch: expected ${options.expectedPatchHash}, actual ${patchHash}.`,
    );
  }
  const before = await inspectCoolantNormalizationPatch(tx);
  if (before.state === "CONFLICT") throw new IncrementalPatchError(before.conflicts.join(" "));
  if (before.state === "ALREADY_APPLIED") {
    return {
      ...before,
      wrote: false,
      importRunId: null,
      reviewHashesVerified: 4,
      publicSpecifications: 0,
      stepsCompleted: steps,
    };
  }
  await done("preflight");

  const runId = await insertRun(tx);
  await done("import-run");
  await writePatch(tx);
  await done("patch-write");
  const verified = await verifyPatch(tx);
  await done("post-write-verification");
  const finished = await tx.execute(
    `UPDATE import_runs SET finished_at = now() WHERE id = $1::uuid AND finished_at IS NULL`,
    runId,
  );
  if (finished !== 1) throw new IncrementalPatchError(`ImportRun did not finish exactly once.`);
  await done("import-run-finished");

  const after = await inspectCoolantNormalizationPatch(tx);
  if (after.state !== "ALREADY_APPLIED") {
    throw new IncrementalPatchError(
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

export const PATCH_REVIEW_STATUS = TechnicalReviewStatus.NEEDS_REVIEW;
