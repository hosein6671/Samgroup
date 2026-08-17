/**
 * DEMO / PLACEHOLDER CMS content — opt-in, idempotent, and deliberately worthless.
 *
 * Run with:
 *
 *   SAM_ALLOW_DEMO_CMS_SEED=true pnpm --filter @sam-group/cms seed:demo
 *
 * ── What it creates ─────────────────────────────────────────────────────────
 *
 * Exactly one `Pages` entry, `cms-demo-page`, published, in the default locale only. Its body says
 * in its own text that it is placeholder content. Nothing else is written, and nothing existing is
 * modified or deleted.
 *
 * ── What it must never create ───────────────────────────────────────────────
 *
 * No Privacy Policy, no Terms of Use, no Cookie Notice, no General Sales Conditions, no contact
 * address, phone number or email, no certification, and no company claim of any kind.
 * SITE_STRUCTURE.md §12 states the legal pages are drafting specifications requiring actual legal
 * review before publication, and §7 warns explicitly against publishing placeholder certifications.
 * A seeded approximation of any of those would be worse than their absence, because absence is
 * visibly missing while a placeholder reads as finished.
 *
 * ── Why it exists only in `en` ──────────────────────────────────────────────
 *
 * Inventing Persian or Arabic copy would be inventing translated content, which no gate has
 * approved. One locale is also what makes the fallback path provable: `fa` and `ar` requests are
 * served the English values, and the API reports `meta.localeFallback: true` for exactly that
 * reason.
 *
 * ── Guards ──────────────────────────────────────────────────────────────────
 *
 * Same shape as the Prisma demo seeds (`prisma/seed-products-demo.ts`, `prisma/seed-blog-demo.ts`):
 * an explicit process-scoped arming variable, and a database identity assertion made against the
 * connection itself rather than against the string that opened it.
 */

import config from "@payload-config";
import { getPayload } from "payload";

import { CMS_DEFAULT_LOCALE } from "../localization";

import type { Page } from "../payload-types";

const DEMO_SLUG = "cms-demo-page";
const DEMO_TITLE = "CMS Demo Page";
const EXPECTED_DATABASE = "sam_cms";
const ARMING_VARIABLE = "SAM_ALLOW_DEMO_CMS_SEED";

const DEMO_BODY_PARAGRAPHS: readonly string[] = [
  "DEMO / PLACEHOLDER / NON-AUTHORITATIVE. This page exists only to prove that editorial content stored in Payload reaches the public site through the NestJS Content API. It is not SAM Group content and states nothing true about the company.",
  "It makes no legal, commercial, technical, certification, availability or contact claim, and it must never be published to a production environment or treated as approved copy. Delete it once real editorial content exists.",
  "It is authored in English only. A request for Persian or Arabic is answered with these English values by Payload's locale fallback, and the API reports that it fell back — which is the behaviour this page was created to demonstrate.",
];

/** One Lexical paragraph node, in the shape Payload's default editor produces. */
function paragraph(text: string): Page["body"]["root"]["children"][number] {
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    textFormat: 0,
    textStyle: "",
    children: [
      {
        type: "text",
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text,
        version: 1,
      },
    ],
  };
}

function demoBody(): Page["body"] {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: DEMO_BODY_PARAGRAPHS.map(paragraph),
    },
  };
}

/**
 * Asserts the open connection is `sam_cms`, by asking the server rather than by re-reading the
 * connection string.
 *
 * `src/env.ts` already refuses a `DATABASE_URI` naming another database, so this is the second of
 * two independent checks: the first covers a mistyped variable, this one covers everything the
 * string cannot prove — a connection pooler, a `search_path` surprise, an alias. The Prisma demo
 * seeds assert `current_database()` for the same reason.
 */
async function assertCmsDatabase(db: unknown): Promise<void> {
  const pool = (db as { pool?: { query?: (text: string) => Promise<unknown> } }).pool;

  if (pool?.query === undefined) {
    throw new Error(
      "Could not reach the Postgres pool to verify the database identity. Refusing to write.",
    );
  }

  const result = (await pool.query("select current_database() as name")) as {
    rows?: { name?: unknown }[];
  };
  const name = result.rows?.[0]?.name;

  if (name !== EXPECTED_DATABASE) {
    throw new Error(
      `Connected to "${String(name)}" but this seed may only write to ${EXPECTED_DATABASE}. Refusing to write.`,
    );
  }
}

async function seed(): Promise<void> {
  if (process.env[ARMING_VARIABLE] !== "true") {
    console.error(
      `Refusing to run: ${ARMING_VARIABLE} is not "true". This seed writes DEMO content and is opt-in by design.`,
    );
    process.exit(1);
  }

  const payload = await getPayload({ config });

  await assertCmsDatabase(payload.db);

  /*
   * The frozen default from `localization.ts`, not a value read back out of the running config and
   * cast: the constant and the config are the same declaration, so reading the constant is reading
   * the authority. `assertFrozenLocalization()` has already run as part of building the config this
   * script imported.
   */
  const defaultLocale = CMS_DEFAULT_LOCALE;

  const existing = await payload.find({
    collection: "pages",
    where: { slug: { equals: DEMO_SLUG } },
    limit: 1,
    // The seed runs as no user; without this every read and write below is refused by the
    // collection's own access control, which is authenticated-only by design.
    overrideAccess: true,
    // Drafts included: a demo page someone has since unpublished still exists and must not be
    // duplicated by a second create.
    draft: true,
  });

  if (existing.totalDocs > 0) {
    console.log(`unchanged: "${DEMO_SLUG}" already exists. Nothing was written.`);
    console.log(
      "This seed never edits or deletes an existing page — an editor's changes are theirs to keep.",
    );

    return;
  }

  await payload.create({
    collection: "pages",
    locale: defaultLocale,
    overrideAccess: true,
    data: {
      title: DEMO_TITLE,
      slug: DEMO_SLUG,
      body: demoBody(),
      lastUpdatedDate: new Date().toISOString(),
      _status: "published",
    },
  });

  console.log(`created: "${DEMO_SLUG}" in locale "${defaultLocale}", published.`);
  console.log("DEMO / PLACEHOLDER content. Not SAM Group copy. Remove it before launch.");
}

await seed();
