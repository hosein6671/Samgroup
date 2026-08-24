/**
 * The Prisma → `ApplyTransaction` adapter, in one place.
 *
 * ── Why this is its own module ──────────────────────────────────────────────
 *
 * It used to live in `disposable-harness.ts`, which was fine while the harness was the only
 * thing that could execute the writer. PRODUCT-DATA-2C-B2A-H1 gave the production entry point
 * a runner too, and it needs the same adapter — but importing the disposable harness into a
 * production executable would put a second, quieter way into a write one import away.
 *
 * Copying the eight lines instead would have been worse in a different way: `dry-run.spec.ts`
 * asserts that no file outside `apply/` contains a write surface at all, and a copy in
 * `catalog-import.run.ts` breaks that invariant rather than satisfying it. Extracting it keeps
 * every raw-SQL surface inside `apply/`, where the guard already looks.
 *
 * This file adds no behaviour. It is the narrow shape the engine already asked for, wrapped
 * around whatever Prisma client or interactive transaction it is handed.
 */

import type { ApplyTransaction } from "./apply-engine";

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
