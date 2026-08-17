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

import { demoImagePng } from "./demo-image";

import type { Page } from "../payload-types";

const DEMO_SLUG = "cms-demo-page";
const DEMO_TITLE = "CMS Demo Page";
const EXPECTED_DATABASE = "sam_cms";
const ARMING_VARIABLE = "SAM_ALLOW_DEMO_CMS_SEED";

/**
 * The demo social image.
 *
 * The filename is the idempotency key — a second run finds this record and reuses it rather than
 * uploading a second copy of identical bytes. `alt` says what it is, in the same register as the
 * page body: an editor who opens the media library must not have to guess whether this is real.
 */
const DEMO_IMAGE_FILENAME = "cms-demo-placeholder.png";
const DEMO_IMAGE_ALT =
  "DEMO / PLACEHOLDER: a plain grey rectangle generated for testing. Not SAM Group imagery.";

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

/**
 * Find or create the demo image, and return its id.
 *
 * Idempotent on `filename`: Payload's upload handling would otherwise happily store a second object
 * under a suffixed name, leaving two identical grey rectangles in the bucket and no way to tell
 * which one a page points at.
 *
 * @returns the media document's id, for the page's `seo.socialImage`.
 */
async function ensureDemoImage(
  payload: Awaited<ReturnType<typeof getPayload>>,
  locale: typeof CMS_DEFAULT_LOCALE,
  // Payload's generated types key an upload relationship by the collection's own id type, so the
  // return type is read from `Page` rather than widened to `number | string` — the generated types
  // are the authority on which it is, and a widened type would only be cast back at the call site.
): Promise<NonNullable<NonNullable<Page["seo"]>["socialImage"]>> {
  const existing = await payload.find({
    collection: "media",
    where: { filename: { equals: DEMO_IMAGE_FILENAME } },
    limit: 1,
    overrideAccess: true,
  });

  const found = existing.docs[0];

  if (found !== undefined) {
    console.log(`unchanged: media "${DEMO_IMAGE_FILENAME}" already exists.`);

    return found.id;
  }

  const created = await payload.create({
    collection: "media",
    locale,
    overrideAccess: true,
    data: { alt: DEMO_IMAGE_ALT },
    // The bytes never touch this container's disk — the S3 adapter streams them to the public
    // bucket, and only the record lands in sam_cms (DEVOPS.md "Object storage").
    file: {
      data: demoImagePng(),
      mimetype: "image/png",
      name: DEMO_IMAGE_FILENAME,
      size: demoImagePng().length,
    },
  });

  console.log(`created: media "${DEMO_IMAGE_FILENAME}" — generated placeholder, not real imagery.`);

  return created.id;
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

  /*
   * The media row comes first, because the page's SEO group references it. Both are looked up
   * before either is written, so a rerun after a partial failure reuses whatever survived instead of
   * uploading a duplicate.
   */
  const socialImageId = await ensureDemoImage(payload, defaultLocale);

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
      /*
       * Deliberately partial. Only the fields the proof actually exercises are set — a title, a
       * description, the social image, and the robots flags left at their defaults — so the response
       * shows real values where an editor supplied one and real fallbacks where none exists. Filling
       * every field would prove less, not more: nothing would be left to demonstrate the fallback
       * chain SEO_ARCHITECTURE.md §11 describes.
       */
      seo: {
        metaTitle: "DEMO — CMS Demo Page (non-authoritative)",
        metaDescription:
          "DEMO / PLACEHOLDER metadata. Proves SEO fields stored in Payload reach the site through the NestJS Content API. Describes nothing real about SAM Group.",
        socialImage: socialImageId,
      },
    },
  });

  console.log(`created: "${DEMO_SLUG}" in locale "${defaultLocale}", published, with SEO fields.`);
  console.log("DEMO / PLACEHOLDER content. Not SAM Group copy. Remove it before launch.");
}

await seed();
