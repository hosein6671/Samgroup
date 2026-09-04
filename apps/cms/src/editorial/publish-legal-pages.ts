import config from "@payload-config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPayload } from "payload";

import { CMS_DEFAULT_LOCALE, CMS_LOCALE_CODES } from "../localization";

import { LegalContentError, parseLegalPageSource, toLexicalDocument } from "./legal-content";

import type { LegalPageSource } from "./legal-content";

/**
 * Publishes one legal page — Privacy Policy today — into Payload from a reviewed source file.
 *
 * ```
 * SAM_ALLOW_LEGAL_CONTENT_PUBLISH=true \
 * SAM_LEGAL_CONTENT_FILE=./legal-content/privacy-policy.json \
 * pnpm --filter @sam-group/cms publish:legal-content
 * ```
 *
 * ── It publishes text; it does not write any ────────────────────────────────
 *
 * Every word this script sends to `sam_cms` comes out of the file named by `SAM_LEGAL_CONTENT_FILE`.
 * There is no default document, no template body, no generated title and no fallback date; if the
 * file is absent, incomplete, or carries a placeholder marker, the run fails and the database is
 * untouched. SITE_STRUCTURE.md §12 requires actual legal review before any of these four pages is
 * published, and this flow is the mechanism for carrying the reviewed result in — not a substitute
 * for it.
 *
 * ── Three guards, in this order ─────────────────────────────────────────────
 *
 * 1. **Armed explicitly.** `SAM_ALLOW_LEGAL_CONTENT_PUBLISH=true`, the same shape
 *    `publish-company-pages.ts` and the Prisma demo seeds use. Publishing a legal page is not
 *    something a mistyped command should be able to do.
 * 2. **Validated before Payload is opened.** `parseLegalPageSource` runs first, so a malformed or
 *    partial document fails without a connection being made and without a draft being left behind.
 * 3. **All locales or none.** The source must carry reviewed text for every active locale; see
 *    `legal-content.ts` for why a locale fallback is not a translation on a legal page.
 *
 * ── What it writes, and what it deliberately leaves alone ───────────────────
 *
 * One `Pages` document per run: `slug`, `lastUpdatedDate`, and per locale the `title`, `body` and
 * the two SEO strings when the source carries them. It creates the document if the slug is new and
 * updates it in place if it exists, so re-running after a correction produces one revised page
 * rather than a second one. The default locale is written first, because that is the value
 * Payload's `fallback: true` serves if a later locale write fails.
 *
 * It never touches the SEO group's other fields, any other document, any Global, or the `Media`
 * collection, and it never rotates a credential — that is `rotate-content-service-key.ts`.
 *
 * ── One thing this cannot do for you ────────────────────────────────────────
 *
 * `ACTIVE_PRIVACY_POLICY_REVISION` in `apps/api/src/modules/forms/privacy-policy-revision.ts` is
 * the value every consent record is stamped with, and it is `null` until an approved policy exists.
 * It lives in `apps/api`, a different application and a different database, and a CMS script must
 * not reach into it — the constant is deliberately code-owned so that changing it is a commit with
 * a reviewer. The run prints the `revision` from the source file at the end so the two can be set
 * from the same reviewed value; setting it is a separate, deliberate change.
 */

if (process.env.SAM_ALLOW_LEGAL_CONTENT_PUBLISH !== "true") {
  throw new Error(
    "Set SAM_ALLOW_LEGAL_CONTENT_PUBLISH=true for this approved legal-content publish. " +
      "This writes a published legal page to sam_cms and must never run by accident.",
  );
}

const sourcePath = process.env.SAM_LEGAL_CONTENT_FILE?.trim();

if (sourcePath === undefined || sourcePath === "") {
  throw new Error(
    "SAM_LEGAL_CONTENT_FILE must name the reviewed legal-text JSON file to publish, " +
      "for example ./legal-content/privacy-policy.json. See legal-content/README.md for the format.",
  );
}

const absolutePath = resolve(process.cwd(), sourcePath);

let raw: string;

try {
  raw = readFileSync(absolutePath, "utf8");
} catch {
  throw new Error(
    `No legal-text source file at ${absolutePath}. Nothing was published, and no placeholder was written in its place.`,
  );
}

let parsed: unknown;

try {
  parsed = JSON.parse(raw);
} catch (error) {
  throw new Error(
    `${absolutePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let source: LegalPageSource;

try {
  source = parseLegalPageSource(parsed);
} catch (error) {
  if (error instanceof LegalContentError) {
    throw new Error(`${absolutePath} cannot be published — ${error.message}`);
  }

  throw error;
}

const payload = await getPayload({ config });

const existing = await payload.find({
  collection: "pages",
  overrideAccess: true,
  draft: true,
  where: { slug: { equals: source.slug } },
  limit: 1,
});

/**
 * The locale write order: default first, then the rest.
 *
 * If a later write fails, the document is left with the default locale's reviewed text rather than
 * with nothing — which is the same state Payload's fallback would serve anyway, and a strictly
 * better failure than a half-written document whose default locale is missing.
 */
const localeOrder = [
  CMS_DEFAULT_LOCALE,
  ...CMS_LOCALE_CODES.filter((code) => code !== CMS_DEFAULT_LOCALE),
] as const;

function localeData(locale: (typeof localeOrder)[number]): Record<string, unknown> {
  const content = source.locales[locale];

  return {
    title: content.title,
    body: toLexicalDocument(content.body),
    ...(content.metaTitle !== undefined || content.metaDescription !== undefined
      ? {
          seo: {
            ...(content.metaTitle !== undefined && { metaTitle: content.metaTitle }),
            ...(content.metaDescription !== undefined && {
              metaDescription: content.metaDescription,
            }),
          },
        }
      : {}),
  };
}

const existingDoc = existing.docs[0];
let id: string | number;

if (existingDoc === undefined) {
  const created = await payload.create({
    collection: "pages",
    locale: CMS_DEFAULT_LOCALE,
    overrideAccess: true,
    data: {
      _status: "published",
      slug: source.slug,
      lastUpdatedDate: source.lastUpdatedDate,
      ...localeData(CMS_DEFAULT_LOCALE),
    } as never,
  });

  id = created.id;
  console.log(`Created ${source.slug} and published its ${CMS_DEFAULT_LOCALE} text.`);
} else {
  id = existingDoc.id;
  await payload.update({
    collection: "pages",
    id,
    locale: CMS_DEFAULT_LOCALE,
    overrideAccess: true,
    data: {
      _status: "published",
      lastUpdatedDate: source.lastUpdatedDate,
      ...localeData(CMS_DEFAULT_LOCALE),
    } as never,
  });

  console.log(`Updated ${source.slug} and published its ${CMS_DEFAULT_LOCALE} text.`);
}

for (const locale of localeOrder.filter((code) => code !== CMS_DEFAULT_LOCALE)) {
  await payload.update({
    collection: "pages",
    id,
    locale,
    overrideAccess: true,
    data: { _status: "published", ...localeData(locale) } as never,
  });

  console.log(`Published the ${locale} text.`);
}

console.log(
  [
    "",
    `Published /${CMS_LOCALE_CODES.join("|")}/${source.slug} from ${absolutePath}.`,
    `  last updated: ${source.lastUpdatedDate}`,
    `  revision:     ${source.revision}`,
    "",
    "The public route serves this immediately — the Content API requests published content only.",
    source.slug === "privacy-policy"
      ? "Remaining, and deliberately not automated: set ACTIVE_PRIVACY_POLICY_REVISION in " +
        `apps/api/src/modules/forms/privacy-policy-revision.ts to "${source.revision}" so consent ` +
        "records name the text they were given against."
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n"),
);
