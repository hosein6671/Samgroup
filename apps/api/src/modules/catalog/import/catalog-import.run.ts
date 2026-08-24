#!/usr/bin/env tsx
/**
 * Executable entry for `pnpm catalog:import --dry-run`.
 *
 * Separated from `cli.ts` so that file stays importable by tests without opening a database
 * connection, and so the only place a PrismaClient is constructed is a file that does
 * nothing else.
 *
 * On a dry run the client is used for exactly two SELECTs — row counts and the slug namespace.
 * On an apply it additionally carries the single interactive transaction the writer runs in.
 * It is not registered with Nest, it is not the application's `PrismaService`, and it is
 * disconnected in a `finally` so a failed run does not leave a socket open.
 *
 * This file is where the production apply runner is CONSTRUCTED, and `cli.ts` is where it is
 * decided whether to call it. That split is the point: the CLI stays testable with no database
 * and holds no global Prisma state, and the only code that can open a write transaction
 * against the live catalogue is the executable the operator actually ran. The disposable test
 * harness is deliberately not imported here — it is a test dependency, and a production entry
 * point that could reach it would be a second way into a write.
 *
 * `DATABASE_URL` may be absent: with `--offline` the run uses a stand-in that reports zero
 * rows and an empty namespace, which is enough to build and hash the plan but proves nothing
 * about the database. The summary says which of the two was used.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../prisma/generated/client";

import { APPLY_STATEMENT_TIMEOUT_MS } from "./apply/apply-engine";
import { executeCatalogApply } from "./apply/executor";
import { prismaApplyTransaction } from "./apply/prisma-transaction";
import { main, OFFLINE_DATABASE, prismaDryRunDatabase } from "./cli";

import type { ApplyRunner } from "./cli";
import type { DryRunDatabase } from "./dry-run";

/**
 * The one database this executable may ever write to.
 *
 * `--target-database` is a confirmation — the operator states which database they believe they
 * are pointed at, and the CLI refuses if `SELECT current_database()` disagrees. That makes it a
 * check, NOT a destination chooser, and this constant is what stops it from quietly becoming
 * one. `sam_cms` is Payload's and is never written by this importer (ADR-002); a disposable
 * clone is reached by the integration suites through their own runner, never through here.
 */
const PRODUCTION_TARGET_DATABASE = "sam_platform";

/**
 * Prisma's transaction timeout has to be longer than the statement timeout the engine sets, or
 * Prisma aborts a statement PostgreSQL was still willing to run and the failure reports the
 * wrong cause. Derived from the engine's own constant rather than restated, so the two cannot
 * drift apart.
 */
const PRISMA_TRANSACTION_TIMEOUT_MS = APPLY_STATEMENT_TIMEOUT_MS + 300_000;
const PRISMA_MAX_WAIT_MS = 20_000;

/**
 * The production apply runner: the ONLY place in this application that opens a write
 * transaction against the live catalogue.
 *
 * It owns nothing but the connection. Transaction ordering, the advisory lock, the isolation
 * assertion, the demo guard, the row builders, the deterministic identities and the post-write
 * verification all belong to `executeCatalogApply`, which is called once and unwrapped never.
 * Commit is the transaction's default exit: the executor returns only when every assertion has
 * passed and throws otherwise, and a throw inside a Prisma interactive transaction rolls the
 * whole thing back.
 */
function productionApplyRunner(client: PrismaClient): ApplyRunner {
  return (request) => {
    if (request.expectedDatabaseName !== PRODUCTION_TARGET_DATABASE) {
      throw new Error(
        `This executable writes only to "${PRODUCTION_TARGET_DATABASE}", and was authorized ` +
          `for "${request.expectedDatabaseName}". --target-database confirms which database ` +
          `the operator believes they are pointed at; it does not choose one.`,
      );
    }
    return client.$transaction(
      (tx) =>
        executeCatalogApply(prismaApplyTransaction(tx), {
          plan: request.plan,
          manifestHash: request.manifestHash,
          workbookSha256: request.workbookSha256,
          ledgerSha256: request.ledgerSha256,
          expectedDatabaseName: request.expectedDatabaseName,
          demoReplacementAuthorized: request.demoReplacementAuthorized,
        }),
      {
        isolationLevel: "Serializable",
        maxWait: PRISMA_MAX_WAIT_MS,
        timeout: PRISMA_TRANSACTION_TIMEOUT_MS,
      },
    );
  };
}

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const offline = argv.includes("--offline");

  if (offline) {
    console.log("DATABASE                offline stand-in (no connection, counts are zero)\n");
    return main(argv, OFFLINE_DATABASE);
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Set it, or pass --offline to build the plan without the " +
        "database checks (which then prove nothing about the database).",
    );
    return 1;
  }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const database: DryRunDatabase = prismaDryRunDatabase(client);
  try {
    console.log(`DATABASE                live connection\n`);
    // `enabled` is deliberately NOT passed: it defaults to the committed
    // `APPLY_EXECUTION_ENABLED`, which is the only production enablement mechanism. The runner
    // is supplied regardless, so flipping that one constant needs no change here.
    return await main(argv, database, console.log, { runner: productionApplyRunner(client) });
  } finally {
    await client.$disconnect();
  }
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
