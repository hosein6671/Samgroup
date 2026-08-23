/**
 * Test-only lifecycle for disposable databases.
 *
 * ── Why the integration tests are opt-in ────────────────────────────────────
 *
 * `pnpm test` must pass on a machine with no PostgreSQL and no workbook — the workbook is not
 * in version control and CI has never seen it. So every database-backed test in this folder
 * reads its configuration from the environment and SKIPS, loudly and by name, when it is not
 * there. A skipped test says so; it never passes by doing nothing.
 *
 * ── What it may create, and what it may not ─────────────────────────────────
 *
 * Only `sam_platform_disposable_*`, only by cloning the live template, and it drops exactly
 * what it created. `DROP DATABASE` is routed through the same name check as everything else,
 * so no argument, typo or interpolation can point it at `sam_platform`.
 *
 * The clone is `CREATE DATABASE ... TEMPLATE`, which copies the schema, the data, the
 * triggers and the ownership in one statement and needs no external tool. It reads the
 * template and never writes to it.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../../prisma/generated/client";

import { assertDisposableDatabase, databaseNameOf } from "../disposable-harness";

/** What a suite needs to make and drop clones. No workbook, so no import. */
export interface DatabaseConfig {
  /** Connection to a maintenance database, used only to CREATE and DROP the clones. */
  readonly adminUrl: string;
  /** The database each clone is copied from. Read, never written. */
  readonly templateDatabase: string;
  /** The role each clone is owned by, so a clone matches the original's privileges. */
  readonly ownerRole: string;
}

/** What a suite needs to run the importer as well. */
export interface IntegrationConfig extends DatabaseConfig {
  /** Absolute path to the approved master workbook. */
  readonly workbookPath: string;
}

/**
 * Null when no maintenance connection is configured.
 *
 * Split from `readIntegrationConfig` so a suite that only needs a DATABASE — the public
 * Specification security tests, which build their own rows — runs on a machine that has
 * PostgreSQL but has never seen the workbook. Requiring the workbook for those would skip
 * a security check for a reason that has nothing to do with security.
 */
export function readDatabaseConfig(): DatabaseConfig | null {
  const adminUrl = process.env["CATALOG_APPLY_TEST_ADMIN_URL"];
  if (!adminUrl) return null;
  return {
    adminUrl,
    templateDatabase: process.env["CATALOG_APPLY_TEST_TEMPLATE"] ?? "sam_platform",
    ownerRole: process.env["CATALOG_APPLY_TEST_ROLE"] ?? "sam_platform_user",
  };
}

/** Null when the environment does not configure the importer integration suite. */
export function readIntegrationConfig(): IntegrationConfig | null {
  const base = readDatabaseConfig();
  const workbookPath = process.env["CATALOG_WORKBOOK"];
  if (base === null || !workbookPath) return null;
  return { ...base, workbookPath };
}

function identifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Refusing to use "${value}" as a SQL identifier.`);
  }
  return `"${value}"`;
}

async function withAdmin<T>(
  config: DatabaseConfig,
  run: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.adminUrl }),
  });
  try {
    return await run(client);
  } finally {
    await client.$disconnect();
  }
}

/** The connection string for a named clone, derived from the admin one. */
export function disposableUrl(config: DatabaseConfig, name: string): string {
  const url = new URL(config.adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

export async function createDisposableDatabase(
  config: DatabaseConfig,
  suffix: string,
): Promise<string> {
  const name = `sam_platform_disposable_${suffix}`;
  assertDisposableDatabase(name);
  await withAdmin(config, async (client) => {
    await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${identifier(name)} WITH (FORCE)`);
    await client.$executeRawUnsafe(
      `CREATE DATABASE ${identifier(name)} TEMPLATE ${identifier(config.templateDatabase)} ` +
        `OWNER ${identifier(config.ownerRole)}`,
    );
  });
  return disposableUrl(config, name);
}

export async function dropDisposableDatabase(config: DatabaseConfig, url: string): Promise<void> {
  const name = databaseNameOf(url);
  // The same check the writer uses. A drop is at least as destructive as a write.
  assertDisposableDatabase(name);
  await withAdmin(config, (client) =>
    client.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${identifier(name)} WITH (FORCE)`),
  );
}

/** Opens a short-lived client against a disposable database. Never against a real one. */
export async function withDisposableClient<T>(
  url: string,
  run: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  assertDisposableDatabase(databaseNameOf(url));
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    return await run(client);
  } finally {
    await client.$disconnect();
  }
}

/** Every count the gate reports, read in one place so two tests cannot count differently. */
export async function readCounts(url: string): Promise<Record<string, number>> {
  return withDisposableClient(url, async (client) => {
    const rows = await client.$queryRawUnsafe<{ t: string; n: number }[]>(
      `SELECT 'products' t, count(*)::int n FROM products
       UNION ALL SELECT 'products_demo', count(*)::int FROM products WHERE slug LIKE 'sam-demo-%'
       UNION ALL SELECT 'products_with_source_ref', count(*)::int FROM products WHERE source_ref IS NOT NULL
       UNION ALL SELECT 'product_types', count(*)::int FROM product_types
       UNION ALL SELECT 'product_segments', count(*)::int FROM product_segments
       UNION ALL SELECT 'product_grades', count(*)::int FROM product_grades
       UNION ALL SELECT 'product_slug_claims', count(*)::int FROM product_slug_claims
       UNION ALL SELECT 'slug_claims_product', count(*)::int FROM product_slug_claims WHERE owner_type = 'Product'
       UNION ALL SELECT 'slug_claims_category', count(*)::int FROM product_slug_claims WHERE owner_type = 'Category'
       UNION ALL SELECT 'slug_claims_demo', count(*)::int FROM product_slug_claims WHERE slug LIKE 'sam-demo-%'
       UNION ALL SELECT 'categories', count(*)::int FROM categories
       UNION ALL SELECT 'segments', count(*)::int FROM segments
       UNION ALL SELECT 'specifications', count(*)::int FROM specifications
       UNION ALL SELECT 'product_claims', count(*)::int FROM product_claims
       UNION ALL SELECT 'source_facts', count(*)::int FROM source_facts
       UNION ALL SELECT 'source_assets', count(*)::int FROM source_assets
       UNION ALL SELECT 'source_documents', count(*)::int FROM source_documents
       UNION ALL SELECT 'specification_evidence', count(*)::int FROM specification_evidence
       UNION ALL SELECT 'claim_evidence', count(*)::int FROM claim_evidence
       UNION ALL SELECT 'spec_properties', count(*)::int FROM spec_properties
       UNION ALL SELECT 'spec_property_mappings', count(*)::int FROM spec_property_mappings
       UNION ALL SELECT 'import_runs', count(*)::int FROM import_runs
       UNION ALL SELECT 'import_runs_finished', count(*)::int FROM import_runs WHERE finished_at IS NOT NULL
       UNION ALL SELECT 'technical_reviews', count(*)::int FROM technical_reviews
       UNION ALL SELECT 'inquiries', count(*)::int FROM inquiries`,
    );
    return Object.fromEntries(rows.map((row) => [row.t, Number(row.n)]));
  });
}
