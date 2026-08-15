/**
 * Seeds sam_platform with a small DEMO / PLACEHOLDER Blog set.
 *
 * ── THIS IS NOT SAM GROUP EDITORIAL CONTENT ─────────────────────────────────
 *
 * Every row this script writes is presentation and testing data, created so the
 * blog API and the Insights routes have something to serve during a client
 * demonstration. None of it is approved editorial content.
 *
 * Nothing here is, or may become, any of the following — each one is excluded by
 * decision rather than by omission:
 *
 *   - a company announcement, milestone, or piece of news
 *   - a certification, approval, standard, or compliance claim
 *   - a market statistic, forecast, price, or volume figure
 *   - a customer story, testimonial, reference, or named partner
 *   - a technical assertion about any product, grade, or specification
 *   - an author, byline, biography, or editorial attribution
 *   - a publication history: the five dates below span nine days and exist only
 *     because `blog_posts.published_at` is what makes a post visible at all
 *
 * These rows MUST be replaced by approved editorial content before launch, and a
 * production deployment must never treat them as published articles. The
 * `sam-demo-` slug prefix and the `Demo:` title prefix exist so that is visible
 * from every surface — a URL, a list response, an admin table — without anyone
 * having to consult this file.
 *
 * ── Why a fourth dedicated seed ─────────────────────────────────────────────
 *
 * The same reason prisma/seed-products-demo.ts is separate from its two
 * approved-reference-data siblings: each file states its own scope and widening
 * one would contradict a decision written into it. This one is separate from the
 * demo PRODUCT seed as well, because a single command capable of writing both
 * demo catalog data and demo editorial content is precisely the command that
 * gets run by accident.
 *
 * Like all three siblings it is deliberately NOT wired into prisma.config.ts's
 * `migrations.seed`, so no migration command can insert demo posts as a side
 * effect, and it is not called by any of them.
 *
 * Run with `pnpm seed:blog:demo`, and only with the acknowledgement below.
 *
 * ── What this script does NOT do, by decision rather than omission ──────────
 *
 *   - It creates NO BlogTag and NO BlogPostTag row. No blog tag vocabulary is
 *     approved, and inventing a taxonomy to populate a UI is exactly what this
 *     gate forbids. `blog_post_tags` is never read or written here.
 *   - It creates exactly ONE BlogCategory, and only because
 *     `blog_posts.category_id` is NOT NULL. SITE_STRUCTURE.md §8 lists five
 *     candidate category names; none is approved as reference data, so seeding
 *     them would be this script approving a vocabulary. The one row it does
 *     create is named and slugged as demo content precisely so it cannot be
 *     mistaken for that vocabulary.
 *   - It writes NO author. `blog_posts.author_id` stays null — `users` holds no
 *     rows, and a byline is a claim about a person.
 *   - It creates NO ContentTranslation and NO SeoMeta row. Persian and Arabic
 *     translations are unapproved vocabulary, and the locale-fallback path is
 *     what the untranslated state is meant to exercise.
 *   - It has NOTHING to do with `product_slug_claims`. The ADR-011 namespace
 *     covers `/{locale}/products/{slug}` only — its triggers read `categories`,
 *     `products` and `content_translations` where `entity_type IN ('Category',
 *     'Product')`. Blog slugs live under `/{locale}/insights/{slug}`, a separate
 *     namespace with its own unique key on `blog_posts.slug`. The claim count is
 *     reported before and after purely to prove that.
 *   - It deletes NOTHING. No BlogPost, BlogCategory or BlogTag is ever removed,
 *     including demo posts dropped from the list below — removing one is a data
 *     decision, and this script reports the orphan rather than making it.
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
 * exists to prevent. Capturing the value first makes the variable process-scoped
 * by construction — `SAM_ALLOW_DEMO_BLOG_SEED=true pnpm seed:blog:demo`, typed
 * each time, by someone who meant it.
 */
const ACKNOWLEDGEMENT_VARIABLE = "SAM_ALLOW_DEMO_BLOG_SEED";
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

/**
 * The only database this script may ever write to. ADR-002 makes the two
 * databases independent by credentials, but a mistyped or stale DATABASE_URL can
 * still point somewhere unintended — at sam_cms, at a future staging database, or
 * at `postgres` itself. The server is asked what it actually is, and anything
 * other than this name stops the run before a single row is read or written.
 */
const TARGET_DATABASE = "sam_platform";

/**
 * What makes a row demo-owned, and therefore mutable by this script.
 *
 * Ownership is carried by the slug because the slug is the one column on both
 * `blog_posts` and `blog_categories` that is unique, immutable in practice and
 * visible in a URL. Neither table has an `isDemo` column and adding one would be
 * a schema change made to improve a demo.
 */
const DEMO_SLUG_PREFIX = "sam-demo-";

/**
 * The single BlogCategory, created only because `blog_posts.category_id` is NOT
 * NULL. It is not a proposal for the blog taxonomy and its name says so.
 */
const DEMO_CATEGORY = {
  name: "Demo Content",
  slug: "sam-demo-insights",
} as const;

/**
 * The disclaimer every demo post's body opens with.
 *
 * One shared block rather than five written introductions, on purpose: five
 * distinct pieces of prose would read as editorial copy, and editorial copy is
 * exactly what is not approved. It states what the row is and states nothing
 * about the subject.
 */
const DEMO_BODY_DISCLAIMER =
  "DEMO / PLACEHOLDER CONTENT — NON-AUTHORITATIVE.\n\n" +
  "This entry exists so the Insights pages have something to render during interface " +
  "evaluation. It is not a SAM Group publication, it is not editorial content, and it has not " +
  "been written or reviewed by anyone. It makes no technical, commercial, market or " +
  "certification claim, names no customer or partner, and carries no author.\n\n" +
  "Its publication date is placeholder metadata, not a real publication date.\n\n" +
  "This entry must be replaced with approved editorial content before launch.";

interface DemoPost {
  readonly title: string;
  readonly slug: string;
  /**
   * The subject the eventual approved article is expected to cover. Rendered as a
   * single labelled line rather than as prose, so it reads as a placeholder for
   * content rather than as content.
   */
  readonly intendedTopic: string;
  /**
   * Placeholder metadata. Fixed literals so a rerun writes the identical value,
   * and deliberately inside one nine-day window so the set cannot read as a
   * publication history. All five are in the past, which is what
   * `publishedAt <= now()` requires for a post to be served at all.
   */
  readonly publishedAt: string;
}

/**
 * The demo set — five posts, all in the one demo category.
 *
 * Five rather than a full page, because the point is to exercise the list, the
 * detail route, the ordering and the pagination boundary, not to look like an
 * archive. The topics are the generic educational placeholders approved for this
 * gate; each is named as an intention, never written up.
 */
const DEMO_POSTS: readonly DemoPost[] = [
  {
    title: "Demo: Understanding Base Oil Groups",
    slug: "sam-demo-understanding-base-oil-groups",
    intendedTopic: "Base oil groups, as an educational overview.",
    publishedAt: "2026-08-01T09:00:00.000Z",
  },
  {
    title: "Demo: Lubricant Additives Overview",
    slug: "sam-demo-lubricant-additives-overview",
    intendedTopic: "Lubricant additives, as an educational overview.",
    publishedAt: "2026-08-03T09:00:00.000Z",
  },
  {
    title: "Demo: Industrial Lubrication",
    slug: "sam-demo-industrial-lubrication",
    intendedTopic: "Industrial lubrication, as an educational overview.",
    publishedAt: "2026-08-05T09:00:00.000Z",
  },
  {
    title: "Demo: Marine Lubricants",
    slug: "sam-demo-marine-lubricants",
    intendedTopic: "Marine lubricants, as an educational overview.",
    publishedAt: "2026-08-07T09:00:00.000Z",
  },
  {
    title: "Demo: Antifreeze and Coolants",
    slug: "sam-demo-antifreeze-and-coolants",
    intendedTopic: "Antifreeze and coolants, as an educational overview.",
    publishedAt: "2026-08-09T09:00:00.000Z",
  },
];

/** Raised only for conditions that need a human decision, never for I/O faults. */
class DemoBlogSeedAbort extends Error {}

interface PostOutcome {
  slug: string;
  title: string;
  id: string;
  publishedAt: string;
  state: "created" | "updated" | "unchanged";
}

interface SeedSummary {
  database: string;
  categoryId: string;
  categoryState: "created" | "updated" | "unchanged";
  outcomes: PostOutcome[];
  /** Demo-slugged posts in the database that this script no longer declares. */
  orphanedDemoSlugs: string[];
  /** Non-demo posts found alongside. Reported so their presence is never a surprise. */
  foreignPostSlugs: string[];
  /** Non-demo blog categories found alongside. Never touched. */
  foreignCategorySlugs: string[];
  /** Demo posts carrying an authorId this script did not write. */
  unexpectedAuthors: string[];
}

function bodyFor(post: DemoPost): string {
  return `${DEMO_BODY_DISCLAIMER}\n\nIntended topic: ${post.intendedTopic}`;
}

/**
 * Which database was actually reached, asked of the server rather than parsed out
 * of a URL that would carry credentials.
 */
async function currentDatabase(client: Pick<typeof prisma, "$queryRaw">): Promise<string> {
  const identity = await client.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;

  // Indexed access is checked (packages/tsconfig/base.json sets
  // noUncheckedIndexedAccess), and this query cannot return zero rows — the
  // fallback exists to satisfy the type, not to describe a reachable state.
  return identity[0]?.current_database ?? "unknown";
}

/**
 * The database guard, run BEFORE the first read of any kind.
 *
 * It is checked twice, here and again inside the write transaction, and that is
 * deliberate rather than redundant: this call is what stops the pre-run row
 * counts being taken against the wrong database, and the in-transaction check is
 * what makes the guard hold for the writes themselves even if a future caller
 * reaches `applyDemoBlog` by another path.
 */
async function requireTargetDatabase(): Promise<string> {
  const database = await currentDatabase(prisma);

  if (database !== TARGET_DATABASE) {
    throw new DemoBlogSeedAbort(
      `demo blog seed is only allowed against ${TARGET_DATABASE}; ` +
        `connected database is '${database}'.`,
    );
  }

  return database;
}

/**
 * Everything the guards must pass before any write, then all writes, in ONE
 * transaction.
 *
 * A partial apply is the failure mode worth spending a transaction on here: three
 * of five posts present, with a list that looks complete because nothing
 * downstream knows how long it should be. Either the whole demo set is there or
 * none of it is.
 */
async function applyDemoBlog(): Promise<SeedSummary> {
  return prisma.$transaction(async (tx) => {
    // Identity of what was actually reached, rather than what was intended.
    // ADR-002 makes connecting to the wrong database the expensive mistake.
    // Re-asked inside the transaction so the guard covers the writes themselves —
    // `requireTargetDatabase` has already answered it for the reads before this.
    const database = await currentDatabase(tx);

    // Placed before the first read as well as the first write, so a wrong target
    // fails on its own terms rather than as a confusing "relation does not
    // exist" from a database that legitimately has no blog tables.
    if (database !== TARGET_DATABASE) {
      throw new DemoBlogSeedAbort(
        `demo blog seed is only allowed against ${TARGET_DATABASE}; ` +
          `connected database is '${database}'.`,
      );
    }

    const notPrefixed = DEMO_POSTS.filter((post) => !post.slug.startsWith(DEMO_SLUG_PREFIX));

    if (notPrefixed.length > 0) {
      throw new DemoBlogSeedAbort(
        `Demo slugs must start with '${DEMO_SLUG_PREFIX}' — that prefix is what marks a row as ` +
          `demo-owned and therefore safe for this script to rewrite: ` +
          `${notPrefixed.map((post) => post.slug).join(", ")}.`,
      );
    }

    if (!DEMO_CATEGORY.slug.startsWith(DEMO_SLUG_PREFIX)) {
      throw new DemoBlogSeedAbort(
        `The demo BlogCategory slug must start with '${DEMO_SLUG_PREFIX}'.`,
      );
    }

    const duplicateSlugs = DEMO_POSTS.map((post) => post.slug).filter(
      (slug, index, all) => all.indexOf(slug) !== index,
    );

    if (duplicateSlugs.length > 0) {
      throw new DemoBlogSeedAbort(
        `Two demo posts declare the same slug: ${[...new Set(duplicateSlugs)].join(", ")}.`,
      );
    }

    // A future-dated post is a SCHEDULED post — the API serves `published_at <=
    // now()` only — so one here would silently be missing from every list and
    // 404 on its detail route, which would look like a bug rather than a data
    // choice. Checked at seed time, where the fix is one literal.
    const now = new Date();
    const futureDated = DEMO_POSTS.filter((post) => new Date(post.publishedAt) > now);

    if (futureDated.length > 0) {
      throw new DemoBlogSeedAbort(
        `Demo posts carry publication dates in the future and would not be served: ` +
          `${futureDated.map((post) => post.slug).join(", ")}.`,
      );
    }

    const existingCategory = await tx.blogCategory.findUnique({
      where: { slug: DEMO_CATEGORY.slug },
      select: { id: true, name: true },
    });

    const category = await tx.blogCategory.upsert({
      where: { slug: DEMO_CATEGORY.slug },
      create: { name: DEMO_CATEGORY.name, slug: DEMO_CATEGORY.slug },
      update: { name: DEMO_CATEGORY.name },
      select: { id: true },
    });

    const categoryState =
      existingCategory === null
        ? "created"
        : existingCategory.name === DEMO_CATEGORY.name
          ? "unchanged"
          : "updated";

    const existingPosts = await tx.blogPost.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        categoryId: true,
        authorId: true,
        publishedAt: true,
      },
      orderBy: { slug: "asc" },
    });
    const existingBySlug = new Map(existingPosts.map((row) => [row.slug, row]));

    const declaredSlugs = new Set(DEMO_POSTS.map((post) => post.slug));
    const orphanedDemoSlugs = existingPosts
      .filter((row) => row.slug.startsWith(DEMO_SLUG_PREFIX) && !declaredSlugs.has(row.slug))
      .map((row) => row.slug);
    const foreignPostSlugs = existingPosts
      .filter((row) => !row.slug.startsWith(DEMO_SLUG_PREFIX))
      .map((row) => row.slug);

    const allCategories = await tx.blogCategory.findMany({ select: { slug: true } });
    const foreignCategorySlugs = allCategories
      .filter((row) => !row.slug.startsWith(DEMO_SLUG_PREFIX))
      .map((row) => row.slug);

    const outcomes: PostOutcome[] = [];
    const unexpectedAuthors: string[] = [];

    for (const post of DEMO_POSTS) {
      const content = bodyFor(post);
      const publishedAt = new Date(post.publishedAt);
      const existing = existingBySlug.get(post.slug);

      // `slug` is the match key and is never written on update. It is this row's
      // identity and its public URL — rewriting it would move both.
      //
      // `authorId` is written by neither branch. On create the column defaults to
      // null, which is the state this script requires; on update it is left
      // exactly as found, because nulling a value someone set deliberately would
      // be this script making a data decision. A non-null value is reported
      // instead.
      const row = await tx.blogPost.upsert({
        where: { slug: post.slug },
        create: {
          title: post.title,
          slug: post.slug,
          content,
          categoryId: category.id,
          publishedAt,
        },
        update: {
          title: post.title,
          content,
          categoryId: category.id,
          publishedAt,
        },
        select: { id: true, authorId: true },
      });

      if (row.authorId !== null) {
        unexpectedAuthors.push(post.slug);
      }

      const changed =
        existing !== undefined &&
        (existing.title !== post.title ||
          existing.content !== content ||
          existing.categoryId !== category.id ||
          existing.publishedAt?.getTime() !== publishedAt.getTime());

      outcomes.push({
        slug: post.slug,
        title: post.title,
        id: row.id,
        publishedAt: post.publishedAt,
        state: existing === undefined ? "created" : changed ? "updated" : "unchanged",
      });
    }

    return {
      database,
      categoryId: category.id,
      categoryState,
      outcomes,
      orphanedDemoSlugs,
      foreignPostSlugs,
      foreignCategorySlugs,
      unexpectedAuthors,
    };
  });
}

interface CountReport {
  blogPosts: number;
  blogCategories: number;
  blogTags: number;
  blogPostTags: number;
  productSlugClaims: number;
}

/**
 * The blog row counts after the commit, plus the ADR-011 claim count.
 *
 * `productSlugClaims` is here for one reason: to make it checkable, rather than
 * merely asserted in a comment, that writing blog rows leaves the products slug
 * namespace untouched. The triggers that maintain it read `categories`,
 * `products` and `content_translations` only — this number must be identical
 * before and after.
 */
async function reportCounts(): Promise<CountReport> {
  const [blogPosts, blogCategories, blogTags, blogPostTags, productSlugClaims] = await Promise.all([
    prisma.blogPost.count(),
    prisma.blogCategory.count(),
    prisma.blogTag.count(),
    prisma.blogPostTag.count(),
    prisma.productSlugClaim.count(),
  ]);

  return { blogPosts, blogCategories, blogTags, blogPostTags, productSlugClaims };
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
    throw new DemoBlogSeedAbort(
      `${ACKNOWLEDGEMENT_VARIABLE} is set in .env. It must be process-scoped — a demo-data ` +
        "guard that a file can satisfy arms every future run on this machine silently. " +
        "Remove it from .env and pass it on the command line instead.",
    );
  }

  if (acknowledgementFromProcess !== ACKNOWLEDGEMENT_VALUE) {
    throw new DemoBlogSeedAbort(
      "This seed writes DEMO / PLACEHOLDER Blog posts that are NOT approved SAM Group editorial " +
        `content. Re-run with ${ACKNOWLEDGEMENT_VARIABLE}=${ACKNOWLEDGEMENT_VALUE} to acknowledge ` +
        "that, e.g.\n" +
        `  ${ACKNOWLEDGEMENT_VARIABLE}=${ACKNOWLEDGEMENT_VALUE} pnpm seed:blog:demo\n` +
        "Nothing was written.",
    );
  }
}

async function main(): Promise<void> {
  requireAcknowledgement();
  await requireTargetDatabase();

  const before = await reportCounts();
  const summary = await applyDemoBlog();
  const after = await reportCounts();

  const created = summary.outcomes.filter((outcome) => outcome.state === "created");
  const updated = summary.outcomes.filter((outcome) => outcome.state === "updated");
  const unchanged = summary.outcomes.filter((outcome) => outcome.state === "unchanged");

  console.info(`Target database: ${summary.database}`);
  console.info("");
  console.info("*** DEMO / PLACEHOLDER DATA — NOT APPROVED SAM GROUP EDITORIAL CONTENT ***");
  console.info("*** Replace with approved editorial content before launch.             ***");
  console.info("");
  console.info(
    `Demo BlogCategory — ${summary.categoryState}: ` +
      `${DEMO_CATEGORY.name} [${DEMO_CATEGORY.slug}]`,
  );
  console.info(
    `Demo BlogPosts — created ${created.length}, updated ${updated.length}, ` +
      `unchanged ${unchanged.length} (declared ${DEMO_POSTS.length})`,
  );

  for (const outcome of summary.outcomes) {
    console.info(`  ${outcome.state.padEnd(9)} ${outcome.slug} [published ${outcome.publishedAt}]`);
  }

  console.info("");
  console.info("Row counts (before -> after):");
  console.info(`  blog_posts           : ${before.blogPosts} -> ${after.blogPosts}`);
  console.info(`  blog_categories      : ${before.blogCategories} -> ${after.blogCategories}`);
  console.info(`  blog_tags            : ${before.blogTags} -> ${after.blogTags}`);
  console.info(`  blog_post_tags       : ${before.blogPostTags} -> ${after.blogPostTags}`);
  console.info(
    `  product_slug_claims  : ${before.productSlugClaims} -> ${after.productSlugClaims} ` +
      "(must be unchanged — blog slugs are a separate namespace)",
  );

  if (before.productSlugClaims !== after.productSlugClaims) {
    console.error(
      "ERROR: the products slug namespace registry changed while seeding blog rows. " +
        "Blog slugs are not part of the ADR-011 namespace — investigate before trusting this data.",
    );
    process.exitCode = 1;
  }

  if (after.blogTags !== before.blogTags || after.blogPostTags !== before.blogPostTags) {
    console.error(
      "ERROR: tag rows changed. This script never writes BlogTag or BlogPostTag — no blog tag " +
        "vocabulary is approved.",
    );
    process.exitCode = 1;
  }

  for (const slug of summary.orphanedDemoSlugs) {
    console.warn(
      `WARNING: demo-slugged BlogPost '${slug}' exists but is no longer declared here. ` +
        "Left untouched — deleting a post is a data decision this script does not make.",
    );
  }

  for (const slug of summary.foreignPostSlugs) {
    console.warn(`NOTE: non-demo BlogPost '${slug}' is present and was not touched.`);
  }

  for (const slug of summary.foreignCategorySlugs) {
    console.warn(`NOTE: non-demo BlogCategory '${slug}' is present and was not touched.`);
  }

  for (const slug of summary.unexpectedAuthors) {
    console.warn(
      `WARNING: demo BlogPost '${slug}' carries an authorId. This script never writes one and ` +
        "left it as found — a byline is a claim about a person.",
    );
  }

  console.info("");
  console.info("Demo blog seed complete. These rows are placeholder data.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    if (error instanceof DemoBlogSeedAbort) {
      console.error(`ABORTED: ${error.message}`);
    } else {
      console.error(`Demo blog seed failed: ${safeMessage(error)}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
