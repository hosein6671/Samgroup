/**
 * Seeds sam_platform with the six approved Product Family Categories.
 *
 * SCOPE — `Category` only, and only the six default-locale slugs ADR-009 freezes
 * as canonical Product Family identifiers.
 *
 * This is a SECOND dedicated catalog seed rather than an extension of
 * prisma/seed-catalog.ts, and the reason is the same one ADR-008 §7 used to keep
 * Segments out of prisma/seed.ts: that file states its own scope ("Segments
 * only") and widening it would contradict a decision written into a file rather
 * than extend one. The duplicated database guard below is the accepted price of
 * leaving an approved, shipped script untouched. Like its sibling it is
 * deliberately NOT wired into prisma.config.ts's `migrations.seed`, so no
 * migration command can insert catalog data as a side effect.
 *
 * Run with `pnpm seed:categories`.
 *
 * Idempotent: upserts by `slug`, the model's only unique key besides `id`.
 * Rerunning corrects a drifted `name` in place. `slug`, `parentId` and `id` are
 * never written on update — `slug` is simultaneously the Prisma key, Payload's
 * `ProductCategoryContent.categoryKey` and the public URL segment (ADR-009 §1),
 * and `id` is what SeoMeta, ContentTranslation and products.category_id point
 * at. Nothing here deletes.
 *
 * What this script does NOT create, by decision rather than omission:
 *   - any child Category. The six are roots; sub-ranges are navigation content,
 *     not Category rows, and none is approved.
 *   - any ContentTranslation. The six rows carry DEFAULT-locale values only; the
 *     fa/ar names and slugs are unapproved vocabulary, and ADR-009 §3 makes a
 *     localized slug request vocabulary rather than an identifier.
 *   - any SeoMeta row. SeoService falls metaTitle back to the entity name, so a
 *     category page has usable metadata with no persisted record.
 *   - any Product, ProductType or membership row.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

// The generated directory has no index barrel, so the entry point is the
// client.ts inside it — not the directory itself.
import { PrismaClient } from "../apps/api/src/prisma/generated/client";

// Prisma 7 does not load .env automatically, and this file is also runnable
// outside the Prisma CLI. Guarded because a fresh clone has no .env yet.
if (existsSync(".env")) {
  process.loadEnvFile();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env before seeding.");
}

// Prisma 7 requires a driver adapter for a direct PostgreSQL connection.
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface ApprovedCategory {
  readonly name: string;
  readonly slug: string;
}

/**
 * The six Product Families, in SITE_STRUCTURE.md §0 order. That order is
 * recorded here for readability only: `Category` carries no sortOrder column, so
 * `GET /categories` returns these alphabetically by name and navigation order
 * stays frontend-owned (site-routes.ts). Adding a sort column is a schema change
 * and a separate decision.
 *
 * Each `slug` is the canonical Product Family identifier ADR-009 §1 froze — the
 * one value that is simultaneously this row's key, the default-locale route
 * segment, Payload's `categoryKey` and the frontend `ProductFamily.id`. They are
 * transcribed from that ADR's table unchanged.
 */
const APPROVED_CATEGORIES: readonly ApprovedCategory[] = [
  { name: "Base Oils", slug: "base-oils" },
  { name: "Lubricant Additives & Components", slug: "lubricant-additives" },
  { name: "Engine Oils & Automotive Lubricants", slug: "engine-oils-automotive-lubricants" },
  { name: "Industrial Oils & Lubricants", slug: "industrial-oils-lubricants" },
  { name: "Marine Oils & Lubricants", slug: "marine-oils-lubricants" },
  { name: "Antifreeze & Coolants", slug: "antifreeze-coolants" },
];

/**
 * The only database this script may ever write to. ADR-002 makes the two
 * databases independent by credentials, but a mistyped or stale DATABASE_URL can
 * still point somewhere unintended — at sam_cms, at a future staging database, or
 * at `postgres` itself. The server is asked what it actually is, and anything
 * other than this name stops the run before a single row is read or written.
 */
const TARGET_DATABASE = "sam_platform";

/** Raised only for conditions that need a human decision, never for I/O faults. */
class CategorySeedAbort extends Error {}

interface ExistingCategory {
  name: string;
  slug: string;
  parentId: string | null;
}

interface SeedSummary {
  database: string;
  created: string[];
  updated: string[];
  unchanged: string[];
  unapproved: ExistingCategory[];
  possibleRenames: ExistingCategory[];
}

const approvedSlugs = new Set(APPROVED_CATEGORIES.map((category) => category.slug));
const approvedNames = new Map(
  APPROVED_CATEGORIES.map((category) => [category.name.trim().toLowerCase(), category.slug]),
);

/**
 * Classification and all six writes share one transaction, so the only two
 * observable outcomes are "families unchanged" and "families fully applied". A
 * partial apply would leave a product navigation missing a family while every
 * other one resolves — a shape nothing downstream can detect as broken.
 */
async function applyCategories(): Promise<SeedSummary> {
  return prisma.$transaction(async (tx) => {
    // Identity of what was actually reached, rather than what was intended.
    // ADR-002 makes connecting to the wrong database the expensive mistake, and
    // this answers it from the server rather than by parsing a URL that would
    // carry credentials.
    const identity = await tx.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    // Indexed access is checked (packages/tsconfig/base.json sets
    // noUncheckedIndexedAccess), and this query cannot return zero rows — the
    // fallback exists to satisfy the type, not to describe a reachable state.
    const database = identity[0]?.current_database ?? "unknown";

    // Placed before the first read as well as the first write, so a wrong target
    // fails on its own terms rather than as a confusing "relation does not
    // exist" from a database that legitimately has no catalog tables.
    if (database !== TARGET_DATABASE) {
      throw new CategorySeedAbort(
        `category seed is only allowed against ${TARGET_DATABASE}; ` +
          `connected database is '${database}'.`,
      );
    }

    const existingRows = await tx.category.findMany({
      select: { name: true, slug: true, parentId: true },
      // `categories` has no ordering column; slug is the stable key, so ordering
      // by it makes two runs emit their warnings in the same sequence.
      orderBy: { slug: "asc" },
    });
    const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));

    // A Product Family that is not a root is invisible to the API: both
    // findAll() and findSitemapCandidates() filter `parent_id IS NULL`. Seeding
    // around such a row would report success while leaving the family unreachable,
    // and re-parenting it is a data decision this script is not authorized to
    // make — so it stops instead, having written nothing.
    const misparented = existingRows.filter(
      (row) => approvedSlugs.has(row.slug) && row.parentId !== null,
    );

    if (misparented.length > 0) {
      throw new CategorySeedAbort(
        `Approved Product Family Categories exist with a non-null parentId: ` +
          `${misparented.map((row) => row.slug).join(", ")}. The six families must be root ` +
          "categories — GET /categories and the sitemap read only `parent_id IS NULL`. No " +
          "Category was written, and this script will not re-parent an existing row.",
      );
    }

    const unapproved = existingRows.filter((row) => !approvedSlugs.has(row.slug));
    const possibleRenames = unapproved.filter((row) =>
      approvedNames.has(row.name.trim().toLowerCase()),
    );

    const created: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];

    for (const category of APPROVED_CATEGORIES) {
      const existing = existingBySlug.get(category.slug);

      if (!existing) {
        created.push(category.slug);
      } else if (existing.name === category.name) {
        unchanged.push(category.slug);
      } else {
        updated.push(category.slug);
      }

      // `slug` is the match key and `parentId` the root guarantee; neither is
      // written on update. Changing the slug would move a public URL and orphan
      // Payload's categoryKey join, and rewriting parentId would silently undo a
      // hierarchy someone created on purpose — which is why the check above
      // aborts on it instead.
      await tx.category.upsert({
        where: { slug: category.slug },
        create: { name: category.name, slug: category.slug, parentId: null },
        update: { name: category.name },
      });
    }

    return { database, created, updated, unchanged, unapproved, possibleRenames };
  });
}

/**
 * A driver error can carry the DSN in its message, and the DSN carries the
 * password. Nothing from an error object reaches stdout or stderr un-redacted.
 */
function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown error";
  return raw.replace(/postgres(?:ql)?:\/\/\S*/gi, "[redacted connection string]");
}

async function main(): Promise<void> {
  const summary = await applyCategories();

  console.info(`Target database: ${summary.database}`);
  console.info(
    `Categories — created ${summary.created.length}, ` +
      `updated ${summary.updated.length}, unchanged ${summary.unchanged.length}`,
  );
  console.info(`  ${APPROVED_CATEGORIES.map((category) => category.slug).join(", ")}`);

  for (const row of summary.unapproved) {
    console.warn(`WARNING: unapproved Category slug '${row.slug}' left untouched.`);
  }

  for (const row of summary.possibleRenames) {
    console.warn(
      `WARNING: Category '${row.slug}' carries an approved NAME under an unapproved slug — ` +
        "possible rename or conflict. Not reconciled automatically.",
    );
  }

  console.info("Category seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    if (error instanceof CategorySeedAbort) {
      console.error(`ABORTED: ${error.message}`);
    } else {
      console.error(`Category seed failed: ${safeMessage(error)}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
