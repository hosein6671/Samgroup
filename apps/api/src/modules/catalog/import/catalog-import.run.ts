#!/usr/bin/env tsx
/**
 * Executable entry for `pnpm catalog:import --dry-run`.
 *
 * Separated from `cli.ts` so that file stays importable by tests without opening a database
 * connection, and so the only place a PrismaClient is constructed is a file that does
 * nothing else.
 *
 * The client is used for exactly two SELECTs — row counts and the slug namespace. It is not
 * registered with Nest, it is not the application's `PrismaService`, and it is disconnected
 * in a `finally` so a failed run does not leave a socket open.
 *
 * `DATABASE_URL` may be absent: with `--offline` the run uses a stand-in that reports zero
 * rows and an empty namespace, which is enough to build and hash the plan but proves nothing
 * about the database. The summary says which of the two was used.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../prisma/generated/client";

import { main, OFFLINE_DATABASE, prismaDryRunDatabase } from "./cli";

import type { DryRunDatabase } from "./dry-run";

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
    return await main(argv, database);
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
