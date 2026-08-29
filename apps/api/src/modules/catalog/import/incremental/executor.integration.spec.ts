import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../prisma/generated/client";

import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readCounts,
  readDatabaseConfig,
  withDisposableClient,
} from "../apply/__tests__/disposable-database";
import { databaseNameOf } from "../apply/disposable-harness";
import { prismaApplyTransaction } from "../apply/prisma-transaction";

import { incrementalPatchHash } from "./manifest";
import { COOLANT_NORMALIZATION_PATCH, patchSpecifications } from "./patch";
import {
  executeCoolantNormalizationPatch,
  inspectCoolantNormalizationPatch,
} from "../apply/incremental-executor";

const config = readDatabaseConfig();
const suite = config ? describe : describe.skip;
const patchHash = incrementalPatchHash(COOLANT_NORMALIZATION_PATCH);

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

suite("incremental coolant normalization on a disposable clone", () => {
  const integrationConfig = config!;
  let url = "";

  beforeAll(async () => {
    url = await createDisposableDatabase(integrationConfig, `incremental_${process.pid}`);
  });
  afterAll(async () => {
    if (url) await dropDisposableDatabase(integrationConfig, url);
  });

  it("applies atomically, stays non-public, and replays without a write", async () => {
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
  });

  it("rolls back every row when a later step fails", async () => {
    const rollbackUrl = await createDisposableDatabase(
      integrationConfig,
      `incremental_rollback_${process.pid}`,
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
        const inspection = await inspectCoolantNormalizationPatch(prismaApplyTransaction(client));
        expect(inspection.state).toBe("APPLICABLE");
      });
    } finally {
      await dropDisposableDatabase(integrationConfig, rollbackUrl);
    }
  });
});
