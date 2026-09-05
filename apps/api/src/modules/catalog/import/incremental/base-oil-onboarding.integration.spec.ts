/**
 * Disposable-clone proof for `base-oil-onboarding-v1` — ADR-018 §5's required gate before any
 * live apply: this suite must pass (apply, identical replay, injected rollback) before the
 * patch may be run against the real Local DEV `sam_platform` database.
 *
 * ── This suite needs a template that has never seen this patch — `sam_platform` no longer is ──
 *
 * `sam_platform` now genuinely has `base-oil-onboarding-v1` applied (the Local DEV mutation
 * procedure this gate's report describes), and that is permanent in a way the coolant patch's
 * own equivalent state is not: `source_facts_immutable_guard` (ENABLE ALWAYS) refuses every
 * UPDATE and DELETE on `source_facts` unconditionally, and `source_facts.import_run_id`
 * (`onDelete: Restrict`) then makes this patch's own `ImportRun` undeletable too, once a fact
 * references it. A disposable clone of `sam_platform` therefore inherits an ALREADY_APPLIED
 * state that cannot be reset back to APPLICABLE by deleting anything — unlike the coolant
 * patch, which cites facts that pre-date it and can be left untouched while only its OWN
 * mutable output (Specifications, mappings) is reset.
 *
 * So this suite must run with `CATALOG_APPLY_TEST_TEMPLATE` naming a database built from
 * nothing but this repository's migrations — see the reproducible command in this gate's own
 * report. Run this way, `describe.skip` never fires (unlike a workbook-dependent suite) and
 * every scenario below is a genuine, reproducible first-apply.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../prisma/generated/client";

import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readCounts,
  readDatabaseConfig,
  withDisposableClient,
} from "../apply/__tests__/disposable-database";
import {
  executeBaseOilOnboardingPatch,
  inspectBaseOilOnboardingPatch,
} from "../apply/base-oil-executor";
import { databaseNameOf } from "../apply/disposable-harness";
import { prismaApplyTransaction } from "../apply/prisma-transaction";

import {
  baseOilOnboardingPatchHash,
  DOCUMENTS,
  GRADES,
  PRODUCTS,
  READINGS,
} from "./base-oil-patch";

const config = readDatabaseConfig();
const suite = config ? describe : describe.skip;
const patchHash = baseOilOnboardingPatchHash();
const TIMEOUT_MS = 60_000;

async function apply(url: string, faultInjector?: (step: string) => void): Promise<void> {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await client.$transaction(
      (tx) =>
        executeBaseOilOnboardingPatch(prismaApplyTransaction(tx), {
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

suite("base-oil-onboarding-v1 on a disposable clone", () => {
  const integrationConfig = config!;
  let url = "";

  beforeAll(async () => {
    url = await createDisposableDatabase(integrationConfig, `baseoil_${process.pid}`);
  }, TIMEOUT_MS);
  afterAll(async () => {
    if (url) await dropDisposableDatabase(integrationConfig, url);
  }, TIMEOUT_MS);

  it(
    "reports APPLICABLE against the clean clone — base-oils exists, holds zero products",
    async () => {
      await withDisposableClient(url, async (client) => {
        const inspection = await inspectBaseOilOnboardingPatch(prismaApplyTransaction(client));
        expect(inspection.state).toBe("APPLICABLE");
        expect(inspection.conflicts).toEqual([]);
        expect(inspection.planned).toEqual({
          products: PRODUCTS.length,
          grades: GRADES.length,
          sourceDocuments: DOCUMENTS.length,
          sourceFacts: READINGS.length,
          specifications: READINGS.length,
          evidenceLinks: READINGS.length,
        });
      });
    },
    TIMEOUT_MS,
  );

  it(
    "applies atomically, writes exactly the planned rows, stays non-public, and replays without a write",
    async () => {
      const before = await readCounts(url);
      await apply(url);
      const after = await readCounts(url);

      // readCounts() doesn't track products/product_grades/source_documents/source_facts
      // directly, so this suite reads them itself — the delta is the whole point.
      await withDisposableClient(url, async (client) => {
        const rows = await client.$queryRawUnsafe<
          Array<{ products: bigint; grades: bigint; documents: bigint; facts: bigint }>
        >(
          `SELECT
             (SELECT count(*) FROM products WHERE id = ANY($1::uuid[])) AS products,
             (SELECT count(*) FROM product_grades WHERE id = ANY($2::uuid[])) AS grades,
             (SELECT count(*) FROM source_documents WHERE id = ANY($3::uuid[])) AS documents,
             (SELECT count(*) FROM source_facts WHERE id = ANY($4::uuid[])) AS facts`,
          PRODUCTS.map((p) => p.id),
          GRADES.map((g) => g.id),
          DOCUMENTS.map((d) => d.id),
          READINGS.map((r) => r.factId),
        );
        expect(Number(rows[0]?.products)).toBe(PRODUCTS.length);
        expect(Number(rows[0]?.grades)).toBe(GRADES.length);
        expect(Number(rows[0]?.documents)).toBe(DOCUMENTS.length);
        expect(Number(rows[0]?.facts)).toBe(READINGS.length);
      });

      expect(after["specifications"]).toBe((before["specifications"] ?? 0) + READINGS.length);
      expect(after["specification_evidence"]).toBe(
        (before["specification_evidence"] ?? 0) + READINGS.length,
      );
      expect(after["technical_reviews"]).toBe(before["technical_reviews"]);
      // 100 imported Products plus this patch's 2 — proven as a delta, never an absolute count.
      expect(after["products"]).toBe((before["products"] ?? 0) + PRODUCTS.length);

      await withDisposableClient(url, async (client) => {
        const inspection = await inspectBaseOilOnboardingPatch(prismaApplyTransaction(client));
        expect(inspection.state).toBe("ALREADY_APPLIED");
        const rows = await client.$queryRawUnsafe<Array<{ public_rows: number; hashes: number }>>(
          `SELECT
            (SELECT count(*)::int FROM v_specification_public WHERE id = ANY($1::uuid[])) public_rows,
            (SELECT count(*)::int FROM specifications s
              WHERE s.id = ANY($1::uuid[])
                AND specification_review_hash_v2(s.id) ~ '^[0-9a-f]{64}$') hashes`,
          READINGS.map((r) => r.specificationId),
        );
        expect(rows[0]).toEqual({ public_rows: 0, hashes: READINGS.length });
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
        `baseoil_rollback_${process.pid}`,
      );
      try {
        const before = await readCounts(rollbackUrl);
        await expect(
          apply(rollbackUrl, (step) => {
            if (step === "patch-write") throw new Error("injected rollback probe");
          }),
        ).rejects.toThrow(/injected rollback probe/);
        expect(await readCounts(rollbackUrl)).toEqual(before);
        await withDisposableClient(rollbackUrl, async (client) => {
          const inspection = await inspectBaseOilOnboardingPatch(prismaApplyTransaction(client));
          expect(inspection.state).toBe("APPLICABLE");
        });
      } finally {
        await dropDisposableDatabase(integrationConfig, rollbackUrl);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "reports CONFLICT when the base-oils Category does not exist",
    async () => {
      const noCategoryUrl = await createDisposableDatabase(
        integrationConfig,
        `baseoil_nocat_${process.pid}`,
      );
      try {
        await withDisposableClient(noCategoryUrl, (client) =>
          client.$executeRawUnsafe(`DELETE FROM categories WHERE slug = 'base-oils'`),
        );
        await withDisposableClient(noCategoryUrl, async (client) => {
          const inspection = await inspectBaseOilOnboardingPatch(prismaApplyTransaction(client));
          expect(inspection.state).toBe("CONFLICT");
          expect(inspection.conflicts.some((message) => message.includes("base-oils"))).toBe(true);
        });
      } finally {
        await dropDisposableDatabase(integrationConfig, noCategoryUrl);
      }
    },
    TIMEOUT_MS,
  );
});
