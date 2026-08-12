/**
 * Seeds sam_platform with the approved catalog reference vocabulary.
 *
 * SCOPE — Segments only, and only the eight slugs ADR-008 approves.
 *
 * This is deliberately NOT prisma/seed.ts and deliberately NOT wired into
 * prisma.config.ts's `migrations.seed`. ADR-008 §7 approves a dedicated,
 * idempotent, EXPLICITLY invoked catalog seed as the initial reference-data
 * mechanism, and rejects the three alternatives by name: bootstrap seeding
 * (prisma/seed.ts scopes itself to Locale and excludes catalog content),
 * migration INSERTs (which weld reference rows to schema history), and Payload
 * (which owns editorial content, never structured catalog entities). Keeping
 * this file out of `prisma db seed` is what guarantees no migration command can
 * insert catalog data as a side effect.
 *
 * Run with `pnpm seed:catalog`.
 *
 * Idempotent: upserts by `slug`, which is the model's unique key. Rerunning
 * corrects a drifted `name` or `sortOrder` in place and PRESERVES `Segment.id`,
 * so ProductSegment memberships, SegmentProductType memberships and
 * ContentTranslation rows attached to a Segment survive every rerun. Nothing
 * here deletes.
 *
 * What this script does NOT create, by decision rather than omission:
 *   - an `Other` Segment — ADR-008 resolves it as vocabulary, not a row. Nine
 *     approved names, eight persisted Segments.
 *   - any ProductType row. No Product Type name or slug is approved at all.
 *   - any SegmentProductType membership. All nine per-Segment lists are pending
 *     and none may be inferred from the family sub-ranges.
 *   - any ProductSegment membership, ContentTranslation, or SeoMeta row.
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

interface ApprovedSegment {
  readonly name: string;
  readonly slug: string;
  readonly sortOrder: number;
}

/**
 * The eight persisted Segments approved by ADR-008 §4, in their approved
 * navigation order. `sortOrder` is editorial rather than alphabetical, which is
 * the whole reason the column exists.
 *
 * Six of these slugs are the identifiers apps/web already publishes as Engine
 * Oils sub-range anchors, adopted unchanged so that one vocabulary serves both —
 * including where a slug drops a conjunction its name carries.
 */
const APPROVED_SEGMENTS: readonly ApprovedSegment[] = [
  { name: "Passenger Cars", slug: "passenger-cars", sortOrder: 1 },
  { name: "Trucks and Buses", slug: "trucks-buses", sortOrder: 2 },
  { name: "Construction and Mining", slug: "construction-mining", sortOrder: 3 },
  { name: "Agriculture", slug: "agriculture", sortOrder: 4 },
  { name: "Gardening", slug: "gardening", sortOrder: 5 },
  { name: "Motorcycle & ATV", slug: "motorcycle-atv", sortOrder: 6 },
  { name: "Industry", slug: "industry", sortOrder: 7 },
  { name: "Marine", slug: "marine", sortOrder: 8 },
];

/**
 * `Other` is vocabulary, not a row (ADR-008). A persisted row carrying this
 * slug contradicts a frozen decision, so it stops the run rather than being
 * repaired: deleting it is unauthorized, and continuing would quietly bless a
 * data shape the architecture rejects.
 */
const FORBIDDEN_SLUG = "other";

/**
 * The only database this script may ever write to. ADR-002 makes the two
 * databases independent by credentials, but a mistyped or stale DATABASE_URL can
 * still point somewhere unintended — at sam_cms, at a future staging database, or
 * at `postgres` itself. The server is asked what it actually is, and anything
 * other than this name stops the run before a single row is written.
 */
const TARGET_DATABASE = "sam_platform";

/** Raised only for conditions that need a human decision, never for I/O faults. */
class CatalogSeedAbort extends Error {}

interface ExistingSegment {
  name: string;
  slug: string;
  sortOrder: number;
}

interface SeedSummary {
  database: string;
  created: string[];
  updated: string[];
  unchanged: string[];
  unapproved: ExistingSegment[];
  possibleRenames: ExistingSegment[];
}

const approvedSlugs = new Set(APPROVED_SEGMENTS.map((segment) => segment.slug));
const approvedNames = new Map(
  APPROVED_SEGMENTS.map((segment) => [segment.name.trim().toLowerCase(), segment.slug]),
);

/**
 * Classification and all eight writes share one transaction, so the only two
 * observable outcomes are "vocabulary unchanged" and "vocabulary fully applied".
 * A partial apply would leave a navigation list that looks coherent but is
 * ordered wrongly — the failure mode nothing downstream can detect.
 */
async function applyVocabulary(): Promise<SeedSummary> {
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
      throw new CatalogSeedAbort(
        `catalog seed is only allowed against ${TARGET_DATABASE}; ` +
          `connected database is '${database}'.`,
      );
    }

    const existingRows = await tx.segment.findMany({
      select: { name: true, slug: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });
    const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));

    if (existingBySlug.has(FORBIDDEN_SLUG)) {
      throw new CatalogSeedAbort(
        `A Segment row with slug '${FORBIDDEN_SLUG}' exists. ADR-008 freezes 'Other' as ` +
          "vocabulary, not a persisted Segment, so this row contradicts an accepted decision. " +
          "No Segment was written. Resolve it as an architecture/data decision — this script " +
          "will not delete or rewrite it.",
      );
    }

    const unapproved = existingRows.filter((row) => !approvedSlugs.has(row.slug));
    const possibleRenames = unapproved.filter((row) =>
      approvedNames.has(row.name.trim().toLowerCase()),
    );

    const created: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];

    for (const segment of APPROVED_SEGMENTS) {
      const existing = existingBySlug.get(segment.slug);

      if (!existing) {
        created.push(segment.slug);
      } else if (existing.name === segment.name && existing.sortOrder === segment.sortOrder) {
        unchanged.push(segment.slug);
      } else {
        updated.push(segment.slug);
      }

      // `slug` is the match key and is never written on update: changing it
      // would orphan every membership and translation row pointing at this id.
      await tx.segment.upsert({
        where: { slug: segment.slug },
        create: { name: segment.name, slug: segment.slug, sortOrder: segment.sortOrder },
        update: { name: segment.name, sortOrder: segment.sortOrder },
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
  const summary = await applyVocabulary();

  console.info(`Target database: ${summary.database}`);
  console.info(
    `Segments — created ${summary.created.length}, ` +
      `updated ${summary.updated.length}, unchanged ${summary.unchanged.length}`,
  );
  console.info(`  ${APPROVED_SEGMENTS.map((segment) => segment.slug).join(", ")}`);

  for (const row of summary.unapproved) {
    console.warn(`WARNING: unapproved Segment slug '${row.slug}' left untouched.`);
  }

  for (const row of summary.possibleRenames) {
    console.warn(
      `WARNING: Segment '${row.slug}' carries an approved NAME under an unapproved slug — ` +
        "possible rename or conflict. Not reconciled automatically.",
    );
  }

  console.info("Catalog seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    if (error instanceof CatalogSeedAbort) {
      console.error(`ABORTED: ${error.message}`);
    } else {
      console.error(`Catalog seed failed: ${safeMessage(error)}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
