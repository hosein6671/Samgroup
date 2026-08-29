#!/usr/bin/env tsx
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../prisma/generated/client";

import { APPLY_STATEMENT_TIMEOUT_MS } from "../apply/apply-engine";
import { prismaApplyTransaction } from "../apply/prisma-transaction";

import { runIncrementalCatalog } from "./cli";
import {
  executeCoolantNormalizationPatch,
  inspectCoolantNormalizationPatch,
} from "../apply/incremental-executor";

import type { IncrementalDatabase } from "./cli";

const TARGET_DATABASE = "sam_platform";

function incrementalDatabase(client: PrismaClient): IncrementalDatabase {
  return {
    inspect: () => inspectCoolantNormalizationPatch(prismaApplyTransaction(client)),
    apply: (expectedPatchHash, expectedDatabaseName) => {
      if (expectedDatabaseName !== TARGET_DATABASE) {
        throw new Error(`This executable writes only to ${TARGET_DATABASE}.`);
      }
      return client.$transaction(
        (tx) =>
          executeCoolantNormalizationPatch(prismaApplyTransaction(tx), {
            expectedPatchHash,
            expectedDatabaseName,
          }),
        {
          isolationLevel: "Serializable",
          maxWait: 20_000,
          timeout: APPLY_STATEMENT_TIMEOUT_MS + 300_000,
        },
      );
    },
  };
}

async function main(): Promise<number> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    return await runIncrementalCatalog(process.argv.slice(2), incrementalDatabase(client));
  } finally {
    await client.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
