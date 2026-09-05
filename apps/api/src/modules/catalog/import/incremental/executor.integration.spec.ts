import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../prisma/generated/client";

import * as ids from "../apply/identities";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readCounts,
  readDatabaseConfig,
  withDisposableClient,
} from "../apply/__tests__/disposable-database";
import { databaseNameOf } from "../apply/disposable-harness";
import { dbEnum } from "../apply/executor";
import { prismaApplyTransaction } from "../apply/prisma-transaction";

import { incrementalPatchHash } from "./manifest";
import {
  COOLANT_NORMALIZATION_PATCH,
  LEGACY_MAPPING_STATE,
  PATCH_PROPERTY_KEYS,
  patchMappings,
  patchSpecifications,
} from "./patch";
import {
  executeCoolantNormalizationPatch,
  inspectCoolantNormalizationPatch,
} from "../apply/incremental-executor";

const config = readDatabaseConfig();
const suite = config ? describe : describe.skip;
const patchHash = incrementalPatchHash(COOLANT_NORMALIZATION_PATCH);

/**
 * The coolant patch's own read-only precondition (`inspectFactsAndProducts` in
 * `incremental-executor.ts`): two immutable SourceFacts per product, already linked to a
 * finished base import, with the two raw properties still in their pre-patch, unmapped legacy
 * state. `inspectCoolantNormalizationPatch` only ever READS this — it has no code path that
 * creates it.
 *
 * Before this gate, this suite supplied that precondition implicitly, by relying on
 * `CATALOG_APPLY_TEST_TEMPLATE` (default `sam_platform`) already having been through the real
 * catalog import. That is exactly the flaw PRODUCT-DATA-TECH-HARDEN found: pointed at the
 * project's actual `sam_platform`, the clone ALSO already carried this exact patch (a finished
 * `import_runs` row for `patchHash`, dated 29 August 2026 in this repository's own operational
 * history), so `inspectCoolantNormalizationPatch` correctly reported `ALREADY_APPLIED`, not
 * `APPLICABLE`. Pointed instead at a genuinely clean database built from nothing but this
 * repository's migrations, the precondition is simply ABSENT — no such Product, no such
 * SourceFact exists yet — and the same function correctly reports `CONFLICT`
 * ("expected one immutable SourceFact and Product"), proven directly against such a database
 * before this fixture existed. Neither result was a defect in `incremental-executor.ts`; both
 * were this suite depending on ambient state it never created for itself, unlike its sibling
 * `apply-integration.spec.ts`, which runs the real (workbook-driven) import to build its own.
 *
 * This seeds the minimal, self-consistent precondition directly — two Products, one finished
 * base ImportRun, two SourceDocuments, the four exact SourceFacts `patch.ts` names by id, and
 * the two SpecPropertyMappings in their legacy (pre-patch) shape — on the suite's own disposable
 * clone. No workbook, no `ProductsService`, no `buildPlanFor`: this is fixture data for one test
 * file's own precondition, not a catalog import, and every id involved is either a fresh
 * `randomUUID()` scoped to this run or the exact deterministic id `patch.ts`/`identities.ts`
 * already name — nothing here could collide with or mutate a real Product.
 *
 * ── Reset, not merely ensured ────────────────────────────────────────────────
 *
 * A `CATALOG_APPLY_TEST_TEMPLATE` clone can arrive already carrying this exact patch — a real
 * `sam_platform` does, today — and existence-only seeding (`ON CONFLICT DO NOTHING`) would leave
 * it in that state, which is a true and correct answer for that ambient history but not the
 * `APPLICABLE` baseline this suite exists to exercise. So after ensuring the immutable evidence
 * exists, this forces the PATCH'S OWN mutable output back to its pre-patch baseline on this
 * disposable clone alone: the two SpecificationEvidence links, the four Specifications, the two
 * SpecProperties and the patch's own ImportRun are deleted if present, and the two mappings are
 * reset to `LEGACY_MAPPING_STATE` by upsert rather than left whatever they were. Nothing here
 * touches a persistent database — every statement runs against the clone this function was
 * handed, which its caller creates fresh and drops when done.
 */
async function seedBasePreconditions(url: string): Promise<void> {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const categoryId = randomUUID();
    const importRunId = randomUUID();
    const documentIdByTitle = new Map(
      [...new Set(COOLANT_NORMALIZATION_PATCH.facts.map((fact) => fact.documentTitle))].map(
        (title) => [title, randomUUID()],
      ),
    );

    await client.$executeRawUnsafe(
      `INSERT INTO categories (id, name, slug) VALUES ($1::uuid, $2, $3)`,
      categoryId,
      "Coolant patch precondition fixture",
      `test-fixture-coolant-precondition-${databaseNameOf(url)}`,
    );

    for (const sourceRef of new Set(
      COOLANT_NORMALIZATION_PATCH.facts.map((fact) => fact.productSourceRef),
    )) {
      await client.$executeRawUnsafe(
        `INSERT INTO products (id, name, slug, source_ref, category_id)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)
         ON CONFLICT (id) DO NOTHING`,
        ids.productId(sourceRef),
        `Coolant patch precondition fixture — ${sourceRef}`,
        `test-fixture-${sourceRef.toLowerCase()}-${databaseNameOf(url)}`,
        sourceRef,
        categoryId,
      );
    }

    await client.$executeRawUnsafe(
      `INSERT INTO import_runs (id, importer_version, started_at, finished_at, manifest_hash)
       VALUES ($1::uuid, $2, now(), now(), $3)`,
      importRunId,
      "test-fixture-base-import/0.0.0",
      "0".repeat(64),
    );

    for (const [title, documentId] of documentIdByTitle) {
      await client.$executeRawUnsafe(
        `INSERT INTO source_documents (id, locator_type, locator_value, title, retrieved_at)
         VALUES ($1::uuid, 'url'::source_locator_type, $2, $3, now())
         ON CONFLICT (id) DO NOTHING`,
        documentId,
        `https://example.invalid/test-fixture/${encodeURIComponent(title)}`,
        title,
      );
    }

    for (const fact of COOLANT_NORMALIZATION_PATCH.facts) {
      await client.$executeRawUnsafe(
        `INSERT INTO source_facts
           (id, source_document_id, import_run_id, raw_property, raw_unit, raw_value, raw_method,
            extraction_method, unit_classification)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7,
                 'spreadsheet_cell'::extraction_method, 'stated'::source_unit_classification)
         ON CONFLICT (id) DO NOTHING`,
        fact.sourceFactId,
        documentIdByTitle.get(fact.documentTitle),
        importRunId,
        fact.rawProperty,
        fact.rawUnit,
        fact.rawValue,
        fact.rawMethod,
      );
    }

    // Reset the patch's own mutable output to its pre-patch baseline — see the doc comment above.
    const specificationIds = patchSpecifications().map((row) => row.id);
    await client.$executeRawUnsafe(
      `DELETE FROM specification_evidence WHERE specification_id = ANY($1::uuid[])`,
      specificationIds,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM specifications WHERE id = ANY($1::uuid[])`,
      specificationIds,
    );

    for (const mapping of patchMappings()) {
      const legacy = LEGACY_MAPPING_STATE[mapping.rawProperty as keyof typeof LEGACY_MAPPING_STATE];
      await client.$executeRawUnsafe(
        `INSERT INTO spec_property_mappings
           (id, raw_property, raw_unit, spec_property_key, confidence, review_status, note)
         VALUES ($1::uuid, $2, NULL, NULL, $3::mapping_confidence, $4::technical_review_status, $5)
         ON CONFLICT (id) DO UPDATE SET
           spec_property_key = NULL,
           confidence = EXCLUDED.confidence,
           review_status = EXCLUDED.review_status,
           note = EXCLUDED.note`,
        mapping.id,
        mapping.rawProperty,
        dbEnum(legacy.confidence),
        dbEnum(legacy.reviewStatus),
        legacy.note,
      );
    }

    await client.$executeRawUnsafe(`DELETE FROM spec_properties WHERE key = ANY($1::text[])`, [
      ...PATCH_PROPERTY_KEYS,
    ]);
    await client.$executeRawUnsafe(`DELETE FROM import_runs WHERE manifest_hash = $1`, patchHash);
  } finally {
    await client.$disconnect();
  }
}

async function apply(url: string, faultInjector?: (step: string) => void): Promise<void> {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await client.$transaction(
      (tx) =>
        executeCoolantNormalizationPatch(prismaApplyTransaction(tx), {
          expectedDatabaseName: databaseNameOf(url),
          expectedPatchHash: patchHash,
          ...(faultInjector ? { faultInjector } : {}),
        }),
      { isolationLevel: "Serializable", maxWait: 20_000, timeout: 60_000 },
    );
  } finally {
    await client.$disconnect();
  }
}

/**
 * `createDisposableDatabase` clones a real database and `seedBasePreconditions` runs a dozen
 * further statements against it — comfortably under Jest's 5-second default in isolation, but
 * this suite shares one Postgres instance with every other disposable-database suite in the
 * project, and the full `pnpm test` run exercises all of them in parallel workers. Under that
 * contention the same sequence measurably exceeds 5 seconds — not a defect in the executor this
 * suite tests, just an explicit budget this file never gave itself. Every sibling integration
 * suite in this module (`public-boundary.spec.ts`, `apply-integration.spec.ts`) already passes
 * its own generous timeout for the same reason; this one had not, because it predates the
 * seeding this gate added.
 */
const TIMEOUT_MS = 60_000;

suite("incremental coolant normalization on a disposable clone", () => {
  const integrationConfig = config!;
  let url = "";

  beforeAll(async () => {
    url = await createDisposableDatabase(integrationConfig, `incremental_${process.pid}`);
    await seedBasePreconditions(url);
  }, TIMEOUT_MS);
  afterAll(async () => {
    if (url) await dropDisposableDatabase(integrationConfig, url);
  }, TIMEOUT_MS);

  it(
    "applies atomically, stays non-public, and replays without a write",
    async () => {
      const before = await readCounts(url);
      await withDisposableClient(url, async (client) => {
        const inspection = await inspectCoolantNormalizationPatch(prismaApplyTransaction(client));
        expect(inspection.state).toBe("APPLICABLE");
      });

      await apply(url);
      const after = await readCounts(url);
      expect(after["spec_properties"]).toBe((before["spec_properties"] ?? 0) + 2);
      expect(after["specifications"]).toBe((before["specifications"] ?? 0) + 4);
      expect(after["specification_evidence"]).toBe((before["specification_evidence"] ?? 0) + 4);
      expect(after["source_facts"]).toBe(before["source_facts"]);
      expect(after["technical_reviews"]).toBe(before["technical_reviews"]);

      await withDisposableClient(url, async (client) => {
        const inspection = await inspectCoolantNormalizationPatch(prismaApplyTransaction(client));
        expect(inspection.state).toBe("ALREADY_APPLIED");
        const rows = await client.$queryRawUnsafe<Array<{ public_rows: number; hashes: number }>>(
          `SELECT
          (SELECT count(*)::int FROM v_specification_public WHERE id = ANY($1::uuid[])) public_rows,
          (SELECT count(*)::int FROM specifications s
            WHERE s.id = ANY($1::uuid[])
              AND specification_review_hash_v2(s.id) ~ '^[0-9a-f]{64}$') hashes`,
          patchSpecifications().map((row) => row.id),
        );
        expect(rows[0]).toEqual({ public_rows: 0, hashes: 4 });
      });

      await apply(url);
      expect(await readCounts(url)).toEqual(after);
    },
    TIMEOUT_MS,
  );

  it(
    "rolls back every row when a later step fails",
    async () => {
      const rollbackUrl = await createDisposableDatabase(
        integrationConfig,
        `incremental_rollback_${process.pid}`,
      );
      try {
        await seedBasePreconditions(rollbackUrl);
        const before = await readCounts(rollbackUrl);
        await expect(
          apply(rollbackUrl, (step) => {
            if (step === "patch-write") throw new Error("injected rollback probe");
          }),
        ).rejects.toThrow(/injected rollback probe/);
        expect(await readCounts(rollbackUrl)).toEqual(before);
        await withDisposableClient(rollbackUrl, async (client) => {
          const inspection = await inspectCoolantNormalizationPatch(prismaApplyTransaction(client));
          expect(inspection.state).toBe("APPLICABLE");
        });
      } finally {
        await dropDisposableDatabase(integrationConfig, rollbackUrl);
      }
    },
    TIMEOUT_MS,
  );
});
