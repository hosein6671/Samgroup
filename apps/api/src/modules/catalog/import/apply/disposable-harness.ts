/**
 * The ONLY way to execute the catalog writer, and it refuses to run against a real database.
 *
 * ── Why the writer has no other executor ────────────────────────────────────
 *
 * `APPLY_EXECUTION_ENABLED` is false in this build, so `--apply` performs every confirmation,
 * every guard and every preflight and then stops where the transaction would open. That leaves
 * the writer unproven unless something can run it — and "something" must not become a second,
 * quieter way into the live catalogue.
 *
 * So this harness exists, and it is the opposite of a bypass: it is STRICTER than the CLI. It
 * takes a connection string, reads the database's own name from it, and refuses anything that
 * is not explicitly named as disposable. There is no flag that relaxes that, no environment
 * variable, and no argument that names a live database — `sam_platform` cannot be reached from
 * here at all, whatever is passed.
 *
 * ── The naming rule ─────────────────────────────────────────────────────────
 *
 * A disposable database is called `sam_platform_disposable_<something>`. A convention rather
 * than a registry, because a registry is a file somebody can add a line to; a name is
 * something the operator has to have typed when they created the database, and a restore of
 * production under that name is a deliberate act, not an accident.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../prisma/generated/client";

import { executeCatalogApply, type ApplyResult, type ExecuteApplyOptions } from "./executor";

import type { ApplyTransaction } from "./apply-engine";

/** Databases this harness must never be able to reach, whatever it is handed. */
export const PROTECTED_DATABASE_NAMES: readonly string[] = [
  "sam_platform",
  "sam_cms",
  "postgres",
  "template0",
  "template1",
];

/** The shape a disposable database's name must have. */
export const DISPOSABLE_DATABASE_PATTERN = /^sam_platform_disposable_[a-z0-9_]{1,40}$/;

export class NotADisposableDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotADisposableDatabaseError";
  }
}

/**
 * Prisma's transaction timeout has to be longer than the statement timeout the engine sets,
 * or Prisma aborts a statement Postgres was still willing to run and the failure reports the
 * wrong cause.
 */
const PRISMA_TRANSACTION_TIMEOUT_MS = 900_000;
const PRISMA_MAX_WAIT_MS = 20_000;

/** Reads the database name out of a Postgres connection string. */
export function databaseNameOf(connectionString: string): string {
  const path = new URL(connectionString).pathname;
  return decodeURIComponent(path.replace(/^\//, ""));
}

export function assertDisposableDatabase(name: string): void {
  if (PROTECTED_DATABASE_NAMES.includes(name)) {
    throw new NotADisposableDatabaseError(
      `"${name}" is a real database. The apply writer is never executed against one from a ` +
        `test harness; running the real import is its own reviewed gate, through the CLI, ` +
        `with the nine confirmations and a backup.`,
    );
  }
  if (!DISPOSABLE_DATABASE_PATTERN.test(name)) {
    throw new NotADisposableDatabaseError(
      `"${name}" is not named as a disposable database. Expected a name matching ` +
        `${DISPOSABLE_DATABASE_PATTERN.source} — the name is the authorization, and a ` +
        `database nobody deliberately named that way is treated as real.`,
    );
  }
}

/** Wraps a Prisma interactive transaction in the engine's narrow write surface. */
export function prismaApplyTransaction(client: {
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number>;
  $queryRawUnsafe: <T>(sql: string, ...values: unknown[]) => Promise<T>;
}): ApplyTransaction {
  return {
    execute: (sql, ...params) => client.$executeRawUnsafe(sql, ...params),
    query: <T>(sql: string, ...params: readonly unknown[]): Promise<T[]> =>
      client.$queryRawUnsafe<T[]>(sql, ...params),
  };
}

export type DisposableApplyOptions = Omit<ExecuteApplyOptions, "expectedDatabaseName"> & {
  readonly connectionString: string;
};

/**
 * Runs the complete apply against a disposable database and COMMITS on success.
 *
 * Commit is the transaction's default exit: `executeCatalogApply` returns only when every
 * assertion has passed and throws otherwise, and a throw inside a Prisma interactive
 * transaction rolls the whole thing back — the demo deletion, the slug-claim trigger effects,
 * the reference rows, the Products, every technical row and the ImportRun together.
 */
export async function runApplyOnDisposableDatabase(
  options: DisposableApplyOptions,
): Promise<ApplyResult> {
  const databaseName = databaseNameOf(options.connectionString);
  assertDisposableDatabase(databaseName);

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: options.connectionString }),
  });
  try {
    return await client.$transaction(
      async (tx) =>
        executeCatalogApply(prismaApplyTransaction(tx), {
          plan: options.plan,
          manifestHash: options.manifestHash,
          workbookSha256: options.workbookSha256,
          ledgerSha256: options.ledgerSha256,
          expectedDatabaseName: databaseName,
          demoReplacementAuthorized: options.demoReplacementAuthorized,
          ...(options.acceptInquirySetNull === undefined
            ? {}
            : { acceptInquirySetNull: options.acceptInquirySetNull }),
          ...(options.faultInjector === undefined ? {} : { faultInjector: options.faultInjector }),
        }),
      {
        isolationLevel: "Serializable",
        maxWait: PRISMA_MAX_WAIT_MS,
        timeout: PRISMA_TRANSACTION_TIMEOUT_MS,
      },
    );
  } finally {
    await client.$disconnect();
  }
}

/** Read-only helper for tests that need to look at a disposable database after a run. */
export async function readDisposableDatabase<T>(
  connectionString: string,
  read: (query: <R>(sql: string, ...params: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  assertDisposableDatabase(databaseNameOf(connectionString));
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    return await read(<R>(sql: string, ...params: unknown[]): Promise<R[]> =>
      client.$queryRawUnsafe<R[]>(sql, ...params),
    );
  } finally {
    await client.$disconnect();
  }
}
