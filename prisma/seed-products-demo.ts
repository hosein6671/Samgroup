/**
 * Seeds sam_platform with a small DEMO / PLACEHOLDER Product set.
 *
 * ── THIS IS NOT SAM GROUP CATALOG DATA ──────────────────────────────────────
 *
 * Every row this script writes is presentation and testing data, created so the
 * catalog API and a future Product Detail route have something to serve during a
 * client demonstration. None of it is approved commercial content. No product
 * name here is a SAM Group product, no classification here is a suitability
 * claim, and nothing here carries a specification, an approval, a packaging
 * option, a quantity or an availability statement — because none of those is
 * approved, and inventing one would put an unapproved claim in a database that
 * later looks authoritative.
 *
 * These rows MUST be replaced by approved commercial product data before launch,
 * and a production deployment must never treat them as catalog content. The
 * `sam-demo-` slug prefix and the `SAM Demo` name prefix exist so that is visible
 * from every surface — a URL, a list response, an admin table — without anyone
 * having to consult this file.
 *
 * ── Why a third dedicated seed ──────────────────────────────────────────────
 *
 * Same reason prisma/seed-categories.ts is separate from prisma/seed-catalog.ts:
 * each of those files states its own scope and widening one would contradict a
 * decision written into it. This one is further apart still — its siblings write
 * APPROVED reference vocabulary, and this writes acknowledged placeholder data.
 * Mixing the two would make one command capable of both, which is precisely what
 * must not exist.
 *
 * Like both siblings it is deliberately NOT wired into prisma.config.ts's
 * `migrations.seed`, so no migration command can insert demo Products as a side
 * effect, and it is not called by either sibling.
 *
 * Run with `pnpm seed:products:demo`, and only with the acknowledgement below.
 *
 * ── What this script does NOT do, by decision rather than omission ───────────
 *
 *   - It creates NO ProductType row and writes NO productTypeId. No Product Type
 *     name or slug is approved (ADR-008), so every demo Product keeps the null
 *     that ADR-007 §4 makes the Phase 1 state.
 *   - It creates NO Specification row. A specification is a technical claim.
 *   - It creates NO ContentTranslation, SeoMeta or Media row. Translated slugs
 *     are unapproved vocabulary (ADR-009 §3, ADR-010 §8), and SeoService already
 *     falls a product's metadata back to its own name and description.
 *   - It NEVER writes `product_slug_claims`. That registry is trigger-maintained
 *     (ADR-011), and a seed that wrote it would be asserting an invariant instead
 *     of being subject to one. The claims these Products produce are produced BY
 *     the database, on the insert, which is the proof the enforcement is live.
 *   - It deletes NOTHING except the Product↔Segment memberships of the demo
 *     Products it declares. No Product, Category, Segment or ProductType is ever
 *     deleted, including demo Products dropped from the list below — removing one
 *     is a data decision, and this script reports the orphan rather than making it.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

// The generated directory has no index barrel, so the entry point is the
// client.ts inside it — not the directory itself.
import { PrismaClient } from "../apps/api/src/prisma/generated/client";

/**
 * The acknowledgement, read BEFORE `.env` is loaded and deliberately so.
 *
 * A guard that a file can satisfy is not a guard: parked in `.env` once, it would
 * arm every future run on that machine invisibly, which is the accident this
 * exists to prevent. Capturing the value first makes the variable
 * process-scoped by construction — `SAM_ALLOW_DEMO_PRODUCT_SEED=true pnpm
 * seed:products:demo`, typed each time, by someone who meant it.
 */
const ACKNOWLEDGEMENT_VARIABLE = "SAM_ALLOW_DEMO_PRODUCT_SEED";
const ACKNOWLEDGEMENT_VALUE = "true";
const acknowledgementFromProcess = process.env[ACKNOWLEDGEMENT_VARIABLE];

// Prisma 7 does not load .env automatically, and this file is also runnable
// outside the Prisma CLI. Guarded because a fresh clone has no .env yet.
if (existsSync(".env")) {
  process.loadEnvFile();
}

/** True when `.env` supplied the acknowledgement — which is not allowed to count. */
const acknowledgementCameFromEnvFile =
  acknowledgementFromProcess === undefined && process.env[ACKNOWLEDGEMENT_VARIABLE] !== undefined;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env before seeding.");
}

// Prisma 7 requires a driver adapter for a direct PostgreSQL connection.
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface DemoProduct {
  readonly name: string;
  readonly slug: string;
  /** An APPROVED Product Family `Category.slug` (ADR-009 §1). Never created here. */
  readonly categorySlug: string;
  /** APPROVED `Segment.slug` values (ADR-008 §4). Never created here. */
  readonly segmentSlugs: readonly string[];
}

/**
 * The single description every demo Product carries.
 *
 * One shared sentence rather than ten written ones, on purpose: ten distinct
 * paragraphs would read as product copy, and product copy is exactly what is not
 * approved. This says what the row is and says nothing about what the product
 * does.
 */
const DEMO_DESCRIPTION =
  "DEMO / PLACEHOLDER CONTENT — non-authoritative sample data for interface evaluation only. " +
  "This is not a SAM Group product and makes no specification, approval, packaging or " +
  "availability claim. Replace with approved commercial product data before launch.";

/**
 * The demo set — ten Products across all six approved Product Families and all
 * eight approved Segments.
 *
 * The distribution is chosen to exercise the API rather than to describe a range:
 * several Families carry more than one Product so a Family filter returns a list
 * rather than a row, several Products carry more than one Segment so the M:N side
 * is real, and the Segment memberships overlap Families so that
 * `?category=&segment=` narrows on both axes at once instead of one implying the
 * other. It is not a balanced grid, because a balanced grid would look like a
 * statement about the catalog.
 *
 * Names avoid every number and letter combination that reads as a grade — no
 * `100`, no `SN 500`, no `15W-40`, no `ISO VG 46`. A trailing letter is a
 * sequence label and nothing else. That is deliberate: a demo row whose NAME
 * implies a viscosity grade is a technical claim wearing a placeholder prefix.
 */
const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    name: "SAM Demo Base Oil A",
    slug: "sam-demo-base-oil-a",
    categorySlug: "base-oils",
    segmentSlugs: ["industry"],
  },
  {
    name: "SAM Demo Base Oil B",
    slug: "sam-demo-base-oil-b",
    categorySlug: "base-oils",
    segmentSlugs: ["industry", "marine"],
  },
  {
    name: "SAM Demo Lubricant Additive A",
    slug: "sam-demo-lubricant-additive-a",
    categorySlug: "lubricant-additives",
    segmentSlugs: ["industry"],
  },
  {
    name: "SAM Demo Engine Oil A",
    slug: "sam-demo-engine-oil-a",
    categorySlug: "engine-oils-automotive-lubricants",
    segmentSlugs: ["passenger-cars"],
  },
  {
    name: "SAM Demo Engine Oil B",
    slug: "sam-demo-engine-oil-b",
    categorySlug: "engine-oils-automotive-lubricants",
    segmentSlugs: ["trucks-buses", "construction-mining"],
  },
  {
    name: "SAM Demo Engine Oil C",
    slug: "sam-demo-engine-oil-c",
    categorySlug: "engine-oils-automotive-lubricants",
    segmentSlugs: ["motorcycle-atv", "passenger-cars"],
  },
  {
    name: "SAM Demo Industrial Oil A",
    slug: "sam-demo-industrial-oil-a",
    categorySlug: "industrial-oils-lubricants",
    segmentSlugs: ["industry"],
  },
  {
    name: "SAM Demo Industrial Oil B",
    slug: "sam-demo-industrial-oil-b",
    categorySlug: "industrial-oils-lubricants",
    segmentSlugs: ["industry", "agriculture", "construction-mining"],
  },
  {
    name: "SAM Demo Marine Oil A",
    slug: "sam-demo-marine-oil-a",
    categorySlug: "marine-oils-lubricants",
    segmentSlugs: ["marine"],
  },
  {
    name: "SAM Demo Antifreeze Coolant A",
    slug: "sam-demo-antifreeze-coolant-a",
    categorySlug: "antifreeze-coolants",
    segmentSlugs: ["passenger-cars", "trucks-buses", "agriculture", "gardening"],
  },
];

/**
 * What makes a Product row demo-owned, and therefore mutable by this script.
 *
 * Ownership is carried by the slug because the slug is the one Product column
 * that is unique, immutable in practice and visible in a URL. A `Product` has no
 * `isDemo` column and adding one would be a schema change made to improve a
 * demo — which is exactly what this gate forbids.
 */
const DEMO_SLUG_PREFIX = "sam-demo-";

/**
 * The only database this script may ever write to. ADR-002 makes the two
 * databases independent by credentials, but a mistyped or stale DATABASE_URL can
 * still point somewhere unintended — at sam_cms, at a future staging database, or
 * at `postgres` itself. The server is asked what it actually is, and anything
 * other than this name stops the run before a single row is read or written.
 */
const TARGET_DATABASE = "sam_platform";

/**
 * A local declaration of ADR-010 §4, for MESSAGE QUALITY ONLY.
 *
 * The authority is `product_slug_reserved()` in the database (ADR-011), and
 * nothing here may be read as enforcement: the triggers reject a reserved slug
 * whether or not this constant exists or agrees with them. This is here so a
 * mistake in the list above fails while pointing at the list, rather than as a
 * check_violation from a function the reader has to go and find.
 */
const RESERVED_SLUGS = ["finder", "segments", "types"] as const;

/** Raised only for conditions that need a human decision, never for I/O faults. */
class DemoProductSeedAbort extends Error {}

interface ProductOutcome {
  slug: string;
  name: string;
  id: string;
  categorySlug: string;
  segmentSlugs: string[];
  state: "created" | "updated" | "unchanged";
  segmentsAdded: string[];
  segmentsRemoved: string[];
}

interface SeedSummary {
  database: string;
  outcomes: ProductOutcome[];
  /** Demo-slugged Products in the database that this script no longer declares. */
  orphanedDemoSlugs: string[];
  /** Non-demo Products found alongside. Reported so their presence is never a surprise. */
  foreignProductSlugs: string[];
  /** Demo Products carrying a productTypeId this script did not write. */
  unexpectedProductTypes: string[];
}

/**
 * Everything the guards must pass before any write, then all writes, in ONE
 * transaction.
 *
 * A partial apply is the failure mode worth spending a transaction on here: half
 * the demo Products present, with a Family filter returning a list that looks
 * complete because nothing downstream knows how long it should be. Either the
 * whole demo set is there or none of it is.
 */
async function applyDemoProducts(): Promise<SeedSummary> {
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
      throw new DemoProductSeedAbort(
        `demo product seed is only allowed against ${TARGET_DATABASE}; ` +
          `connected database is '${database}'.`,
      );
    }

    // The two reference tables are read, never written. A missing row means the
    // approved reference data has not been seeded — `pnpm seed:categories` and
    // `pnpm seed:catalog` own that, and creating one here would be this script
    // inventing approved vocabulary.
    const [categories, segments] = await Promise.all([
      tx.category.findMany({ select: { id: true, slug: true } }),
      tx.segment.findMany({ select: { id: true, slug: true } }),
    ]);

    const categoryIdBySlug = new Map(categories.map((row) => [row.slug, row.id]));
    const segmentIdBySlug = new Map(segments.map((row) => [row.slug, row.id]));

    const missingCategories = [
      ...new Set(
        DEMO_PRODUCTS.map((product) => product.categorySlug).filter(
          (slug) => !categoryIdBySlug.has(slug),
        ),
      ),
    ];

    if (missingCategories.length > 0) {
      throw new DemoProductSeedAbort(
        `Approved Product Family Categories are missing: ${missingCategories.join(", ")}. ` +
          "Run `pnpm seed:categories` first. This script does not create Categories.",
      );
    }

    const missingSegments = [
      ...new Set(
        DEMO_PRODUCTS.flatMap((product) => product.segmentSlugs).filter(
          (slug) => !segmentIdBySlug.has(slug),
        ),
      ),
    ];

    if (missingSegments.length > 0) {
      throw new DemoProductSeedAbort(
        `Approved Segments are missing: ${missingSegments.join(", ")}. ` +
          "Run `pnpm seed:catalog` first. This script does not create Segments.",
      );
    }

    // The three checks below duplicate what the ADR-011 triggers enforce, and
    // that duplication is the point: the database is the authority and will
    // reject any of these regardless, but its message names a normalized key and
    // a UUID, while these name the entry in DEMO_PRODUCTS that is wrong.
    const reserved = DEMO_PRODUCTS.filter((product) =>
      (RESERVED_SLUGS as readonly string[]).includes(product.slug.toLowerCase()),
    );

    if (reserved.length > 0) {
      throw new DemoProductSeedAbort(
        `Demo slugs use values reserved by ADR-010 §4: ` +
          `${reserved.map((product) => product.slug).join(", ")}.`,
      );
    }

    const familyCollisions = DEMO_PRODUCTS.filter((product) =>
      categoryIdBySlug.has(product.slug.toLowerCase()),
    );

    if (familyCollisions.length > 0) {
      throw new DemoProductSeedAbort(
        `Demo slugs collide with Product Family slugs in the shared ` +
          `/{locale}/products/{slug} namespace (ADR-010 §5): ` +
          `${familyCollisions.map((product) => product.slug).join(", ")}.`,
      );
    }

    const notPrefixed = DEMO_PRODUCTS.filter(
      (product) => !product.slug.startsWith(DEMO_SLUG_PREFIX),
    );

    if (notPrefixed.length > 0) {
      throw new DemoProductSeedAbort(
        `Demo slugs must start with '${DEMO_SLUG_PREFIX}' — that prefix is what marks a row as ` +
          `demo-owned and therefore safe for this script to rewrite: ` +
          `${notPrefixed.map((product) => product.slug).join(", ")}.`,
      );
    }

    const existingProducts = await tx.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        categoryId: true,
        productTypeId: true,
        segments: { select: { segmentId: true } },
      },
      orderBy: { slug: "asc" },
    });
    const existingBySlug = new Map(existingProducts.map((row) => [row.slug, row]));

    const declaredSlugs = new Set(DEMO_PRODUCTS.map((product) => product.slug));
    const orphanedDemoSlugs = existingProducts
      .filter((row) => row.slug.startsWith(DEMO_SLUG_PREFIX) && !declaredSlugs.has(row.slug))
      .map((row) => row.slug);
    const foreignProductSlugs = existingProducts
      .filter((row) => !row.slug.startsWith(DEMO_SLUG_PREFIX))
      .map((row) => row.slug);

    const outcomes: ProductOutcome[] = [];
    const unexpectedProductTypes: string[] = [];
    // Built once rather than per product: it exists only to turn the ids the
    // membership diff works in back into the slugs the report is written in.
    const slugBySegmentId = new Map([...segmentIdBySlug].map(([slug, id]) => [id, slug]));

    for (const product of DEMO_PRODUCTS) {
      // Non-null by the missingCategories guard above; the assertion satisfies
      // noUncheckedIndexedAccess rather than describing a reachable state.
      const categoryId = categoryIdBySlug.get(product.categorySlug) as string;
      const declaredSegmentIds = product.segmentSlugs.map(
        (slug) => segmentIdBySlug.get(slug) as string,
      );
      const existing = existingBySlug.get(product.slug);

      // `slug` is the match key and is never written on update. It is this row's
      // identity, its claim in `product_slug_claims`, and its public URL —
      // rewriting it would move all three and orphan the id every membership
      // points at.
      //
      // `productTypeId` is written by neither branch. On create the column
      // defaults to null, which is the Phase 1 state ADR-007 §4 describes; on
      // update it is left exactly as found, because nulling a value someone set
      // deliberately would be this script deciding a Product Type question it is
      // explicitly not allowed to decide. A non-null value is reported instead.
      const row = await tx.product.upsert({
        where: { slug: product.slug },
        create: {
          name: product.name,
          slug: product.slug,
          categoryId,
          description: DEMO_DESCRIPTION,
        },
        update: {
          name: product.name,
          categoryId,
          description: DEMO_DESCRIPTION,
        },
        select: { id: true, productTypeId: true },
      });

      if (row.productTypeId !== null) {
        unexpectedProductTypes.push(product.slug);
      }

      // Memberships converge to the declared set: what is declared and missing is
      // added, what is present and undeclared is removed. Scoped to this demo
      // Product's own rows and no others — the deletion below can only ever touch
      // memberships of a row this script owns by slug prefix.
      const existingSegmentIds = new Set(
        existing?.segments.map((membership) => membership.segmentId) ?? [],
      );
      const declaredSegmentIdSet = new Set(declaredSegmentIds);

      const removedIds = [...existingSegmentIds].filter((id) => !declaredSegmentIdSet.has(id));
      const addedIds = declaredSegmentIds.filter((id) => !existingSegmentIds.has(id));

      if (removedIds.length > 0) {
        await tx.productSegment.deleteMany({
          where: { productId: row.id, segmentId: { in: removedIds } },
        });
      }

      if (addedIds.length > 0) {
        // skipDuplicates rather than a bare createMany: the composite primary key
        // already makes a rerun's re-insert an error, and the point of this
        // script is that a rerun is boring.
        await tx.productSegment.createMany({
          data: addedIds.map((segmentId) => ({ productId: row.id, segmentId })),
          skipDuplicates: true,
        });
      }

      const changed =
        existing !== undefined &&
        (existing.name !== product.name ||
          existing.categoryId !== categoryId ||
          existing.description !== DEMO_DESCRIPTION);

      outcomes.push({
        slug: product.slug,
        name: product.name,
        id: row.id,
        categorySlug: product.categorySlug,
        segmentSlugs: [...product.segmentSlugs],
        state:
          existing === undefined
            ? "created"
            : changed || removedIds.length > 0 || addedIds.length > 0
              ? "updated"
              : "unchanged",
        segmentsAdded: addedIds.map((id) => slugBySegmentId.get(id) ?? id),
        segmentsRemoved: removedIds.map((id) => slugBySegmentId.get(id) ?? id),
      });
    }

    return {
      database,
      outcomes,
      orphanedDemoSlugs,
      foreignProductSlugs,
      unexpectedProductTypes,
    };
  });
}

interface ClaimReport {
  familyClaims: number;
  demoProductClaims: number;
  otherProductClaims: number;
  totalClaims: number;
  missingDemoClaims: string[];
  misownedDemoClaims: string[];
}

/**
 * Reads back what the ADR-011 triggers did, AFTER the transaction commits.
 *
 * Deliberately a separate read rather than part of the write transaction: inside
 * it, this would be reporting on uncommitted state, and the question being asked
 * is what the namespace actually holds now. Nothing here writes
 * `product_slug_claims` — it is the registry's own account of itself, which is
 * the only account worth printing.
 */
async function reportClaims(outcomes: readonly ProductOutcome[]): Promise<ClaimReport> {
  const claims = await prisma.productSlugClaim.findMany({
    select: { slugKey: true, ownerType: true, ownerId: true },
  });

  const claimByKey = new Map(claims.map((claim) => [claim.slugKey, claim]));
  const missingDemoClaims: string[] = [];
  const misownedDemoClaims: string[] = [];

  for (const outcome of outcomes) {
    // The demo slugs are ASCII lower-case already, so the normalized key equals
    // the slug. This mirrors `slug_key()` for the values this file can produce
    // and is not a general reimplementation of it.
    const claim = claimByKey.get(outcome.slug.toLowerCase());

    if (claim === undefined) {
      missingDemoClaims.push(outcome.slug);
    } else if (claim.ownerType !== "Product" || claim.ownerId !== outcome.id) {
      misownedDemoClaims.push(outcome.slug);
    }
  }

  const demoSlugKeys = new Set(outcomes.map((outcome) => outcome.slug.toLowerCase()));

  return {
    familyClaims: claims.filter((claim) => claim.ownerType === "Category").length,
    demoProductClaims: claims.filter(
      (claim) => claim.ownerType === "Product" && demoSlugKeys.has(claim.slugKey),
    ).length,
    otherProductClaims: claims.filter(
      (claim) => claim.ownerType === "Product" && !demoSlugKeys.has(claim.slugKey),
    ).length,
    totalClaims: claims.length,
    missingDemoClaims,
    misownedDemoClaims,
  };
}

/**
 * A driver error can carry the DSN in its message, and the DSN carries the
 * password. Nothing from an error object reaches stdout or stderr un-redacted.
 */
function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown error";
  return raw.replace(/postgres(?:ql)?:\/\/\S*/gi, "[redacted connection string]");
}

/**
 * The acknowledgement gate. Runs before the client connects, so an unarmed
 * invocation costs a process start and nothing else.
 */
function requireAcknowledgement(): void {
  if (acknowledgementCameFromEnvFile) {
    throw new DemoProductSeedAbort(
      `${ACKNOWLEDGEMENT_VARIABLE} is set in .env. It must be process-scoped — a demo-data ` +
        "guard that a file can satisfy arms every future run on this machine silently. " +
        "Remove it from .env and pass it on the command line instead.",
    );
  }

  if (acknowledgementFromProcess !== ACKNOWLEDGEMENT_VALUE) {
    throw new DemoProductSeedAbort(
      "This seed writes DEMO / PLACEHOLDER Products that are NOT approved SAM Group catalog " +
        `data. Re-run with ${ACKNOWLEDGEMENT_VARIABLE}=${ACKNOWLEDGEMENT_VALUE} to acknowledge ` +
        "that, e.g.\n" +
        `  ${ACKNOWLEDGEMENT_VARIABLE}=${ACKNOWLEDGEMENT_VALUE} pnpm seed:products:demo\n` +
        "Nothing was written.",
    );
  }
}

async function main(): Promise<void> {
  requireAcknowledgement();

  const summary = await applyDemoProducts();
  const claims = await reportClaims(summary.outcomes);

  const created = summary.outcomes.filter((outcome) => outcome.state === "created");
  const updated = summary.outcomes.filter((outcome) => outcome.state === "updated");
  const unchanged = summary.outcomes.filter((outcome) => outcome.state === "unchanged");

  console.info(`Target database: ${summary.database}`);
  console.info("");
  console.info("*** DEMO / PLACEHOLDER DATA — NOT APPROVED SAM GROUP CATALOG CONTENT ***");
  console.info("*** Replace with approved commercial product data before launch.      ***");
  console.info("");
  console.info(
    `Demo Products — created ${created.length}, updated ${updated.length}, ` +
      `unchanged ${unchanged.length} (declared ${DEMO_PRODUCTS.length})`,
  );

  for (const outcome of summary.outcomes) {
    console.info(
      `  ${outcome.state.padEnd(9)} ${outcome.slug} ` +
        `[${outcome.categorySlug}] segments: ${outcome.segmentSlugs.join(", ")}`,
    );

    if (outcome.segmentsAdded.length > 0) {
      console.info(`            + segments added: ${outcome.segmentsAdded.join(", ")}`);
    }

    if (outcome.segmentsRemoved.length > 0) {
      console.info(`            - segments removed: ${outcome.segmentsRemoved.join(", ")}`);
    }
  }

  console.info("");
  console.info("ADR-011 namespace registry (trigger-maintained, read only):");
  console.info(`  Category (Product Family) claims : ${claims.familyClaims}`);
  console.info(`  demo Product claims              : ${claims.demoProductClaims}`);
  console.info(`  other Product claims             : ${claims.otherProductClaims}`);
  console.info(`  total rows                       : ${claims.totalClaims}`);

  if (claims.missingDemoClaims.length > 0) {
    console.error(
      `ERROR: demo Products hold no namespace claim: ${claims.missingDemoClaims.join(", ")}. ` +
        "The ADR-011 triggers are not doing their job — investigate before trusting this data.",
    );
    process.exitCode = 1;
  }

  if (claims.misownedDemoClaims.length > 0) {
    console.error(
      `ERROR: namespace claims for demo slugs are held by another entity: ` +
        `${claims.misownedDemoClaims.join(", ")}.`,
    );
    process.exitCode = 1;
  }

  for (const slug of summary.orphanedDemoSlugs) {
    console.warn(
      `WARNING: demo-slugged Product '${slug}' exists but is no longer declared here. ` +
        "Left untouched — deleting a Product is a data decision this script does not make.",
    );
  }

  for (const slug of summary.foreignProductSlugs) {
    console.warn(`NOTE: non-demo Product '${slug}' is present and was not touched.`);
  }

  for (const slug of summary.unexpectedProductTypes) {
    console.warn(
      `WARNING: demo Product '${slug}' carries a productTypeId. This script never writes one ` +
        "and left it as found — no Product Type vocabulary is approved (ADR-008).",
    );
  }

  console.info("");
  console.info("Demo product seed complete. These rows are placeholder data.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    if (error instanceof DemoProductSeedAbort) {
      console.error(`ABORTED: ${error.message}`);
    } else {
      console.error(`Demo product seed failed: ${safeMessage(error)}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
