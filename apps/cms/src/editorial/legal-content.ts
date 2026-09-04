import { CMS_DEFAULT_LOCALE, CMS_LOCALE_CODES, type CmsLocaleCode } from "../localization";

/**
 * The approved-legal-text source format, and every check that runs before a word of it is published.
 *
 * ── Why a source file rather than typing into the admin panel ───────────────
 *
 * Nothing here drafts, generates, completes or approximates legal text — SITE_STRUCTURE.md §12 is
 * explicit that the four legal pages are "specifications for a legal drafter, not finished legal
 * text" and require actual legal review before publication. A human still writes and reviews the
 * policy; this module only carries it, unchanged, into Payload.
 *
 * What it buys over hand-entry in the admin panel is exactly what a legal page needs:
 *
 * - **All three locales land in one run.** INTERNATIONALIZATION_STRATEGY.md requires human review of
 *   legal copy in every locale, and Payload's `fallback: true` will happily serve English under
 *   `/fa` — a document published in one language looks finished in all three. This refuses to
 *   publish unless every active locale carries reviewed text.
 * - **The revision is reviewable.** The file is a commit, so what was published, when, and in which
 *   languages is in the history rather than in one editor's memory.
 * - **Placeholders cannot reach the database.** `[TO CONFIRM]` and friends are rejected outright,
 *   which is CLAUDE.md §4's rule made mechanical.
 *
 * ── What it deliberately does not do ────────────────────────────────────────
 *
 * No default text, no example clause, no fallback title, no generated "last updated" date. Every
 * value is either present in the source file or the publish fails. A missing field is never filled
 * in, because the only thing worse than an unpublished privacy policy is a published one nobody
 * wrote.
 */

/**
 * The four legal pages SITE_STRUCTURE.md §12 names, and the only slugs this flow will write.
 *
 * `Pages` is the Legal Pages collection and nothing else (PAYLOAD_CONTENT_ARCHITECTURE.md §1), so an
 * unrecognised slug is a mistake rather than a new page — refusing it here is what stops this
 * becoming a generic page-publishing tool.
 */
export const LEGAL_PAGE_SLUGS = [
  "privacy-policy",
  "terms-of-use",
  "cookie-notice",
  "general-sales-conditions",
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

/**
 * One block of the document body.
 *
 * A deliberately small vocabulary — headings, paragraphs and lists — because that is the whole of
 * what a legal page's body is, and every element it admits maps onto a Lexical node Payload already
 * renders and the API's rich-text sanitizer already allows through. Adding a block type here adds a
 * shape to the published document, so the set is closed.
 */
export type LegalBlock =
  | { readonly kind: "heading"; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly ordered?: boolean; readonly items: readonly string[] };

/** One locale's reviewed text. Every field is required; none has a default. */
export type LegalLocaleContent = {
  /** The page's own heading, in this language. */
  readonly title: string;
  readonly body: readonly LegalBlock[];
  /** Optional, and omitted rather than derived when absent. */
  readonly metaTitle?: string;
  readonly metaDescription?: string;
};

export type LegalPageSource = {
  readonly slug: LegalPageSlug;
  /**
   * The revision date of the document, `YYYY-MM-DD`.
   *
   * Not localized and not generated: a legal page is not revised on different dates in different
   * languages, and substituting today's date would assert a revision nobody made.
   */
  readonly lastUpdatedDate: string;
  /**
   * A short identifier for this revision of the text.
   *
   * This flow does not write it into Payload; it is carried so the published revision and
   * `ACTIVE_PRIVACY_POLICY_REVISION` in `apps/api` can be set from one reviewed source rather than
   * from two people's recollections. See the note in `publish-legal-pages.ts`.
   */
  readonly revision: string;
  readonly locales: Readonly<Record<CmsLocaleCode, LegalLocaleContent>>;
};

/** A source file that cannot be published, with the reason stated in full. */
export class LegalContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalContentError";
  }
}

/**
 * Markers that must never reach the database.
 *
 * CLAUDE.md §4 treats `[TO CONFIRM]` and `[ESTIMATE — CONFIRM]` as placeholders that may never be
 * seeded into a database or a page; the rest are the usual drafting scaffolding. Matched
 * case-insensitively against every string in the document, titles and SEO values included.
 */
const PLACEHOLDER_MARKERS = [
  "[to confirm]",
  "[estimate",
  "lorem ipsum",
  "todo",
  "tbd",
  "xxx",
  "placeholder",
];

function assertText(value: unknown, where: string): string {
  if (typeof value !== "string") {
    throw new LegalContentError(`${where} must be a string.`);
  }

  const text = value.trim();

  if (text === "") {
    throw new LegalContentError(
      `${where} is empty. Approved text is required — nothing is generated to fill it.`,
    );
  }

  const lowered = text.toLowerCase();
  const marker = PLACEHOLDER_MARKERS.find((entry) => lowered.includes(entry));

  if (marker !== undefined) {
    throw new LegalContentError(
      `${where} contains the placeholder marker "${marker}". Legal text must be final and reviewed before it is published.`,
    );
  }

  return text;
}

function assertBlock(value: unknown, where: string): LegalBlock {
  if (typeof value !== "object" || value === null) {
    throw new LegalContentError(`${where} must be an object.`);
  }

  const block = value as Record<string, unknown>;

  if (block.kind === "heading") {
    const level = block.level;

    if (level !== 2 && level !== 3) {
      throw new LegalContentError(
        `${where}.level must be 2 or 3. The page's own title is its h1, so a body heading starts at 2.`,
      );
    }

    return { kind: "heading", level, text: assertText(block.text, `${where}.text`) };
  }

  if (block.kind === "paragraph") {
    return { kind: "paragraph", text: assertText(block.text, `${where}.text`) };
  }

  if (block.kind === "list") {
    if (!Array.isArray(block.items) || block.items.length === 0) {
      throw new LegalContentError(`${where}.items must be a non-empty array.`);
    }

    if (block.ordered !== undefined && typeof block.ordered !== "boolean") {
      throw new LegalContentError(`${where}.ordered must be a boolean when present.`);
    }

    return {
      kind: "list",
      ...(block.ordered === true && { ordered: true }),
      items: block.items.map((item, index) => assertText(item, `${where}.items[${String(index)}]`)),
    };
  }

  throw new LegalContentError(
    `${where}.kind must be "heading", "paragraph" or "list"; received ${JSON.stringify(block.kind)}.`,
  );
}

function assertLocaleContent(value: unknown, where: string): LegalLocaleContent {
  if (typeof value !== "object" || value === null) {
    throw new LegalContentError(`${where} must be an object.`);
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.body) || record.body.length === 0) {
    throw new LegalContentError(
      `${where}.body must be a non-empty array of blocks. An empty body is an unwritten page.`,
    );
  }

  return {
    title: assertText(record.title, `${where}.title`),
    body: record.body.map((block, index) => assertBlock(block, `${where}.body[${String(index)}]`)),
    ...(record.metaTitle !== undefined && {
      metaTitle: assertText(record.metaTitle, `${where}.metaTitle`),
    }),
    ...(record.metaDescription !== undefined && {
      metaDescription: assertText(record.metaDescription, `${where}.metaDescription`),
    }),
  };
}

/** `YYYY-MM-DD`, and a date that actually exists. */
function assertIsoDate(value: unknown, where: string): string {
  const text = assertText(value, where);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new LegalContentError(`${where} must be an ISO date, YYYY-MM-DD; received "${text}".`);
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(text)) {
    throw new LegalContentError(`${where} is not a real calendar date: "${text}".`);
  }

  return text;
}

/**
 * A parsed source file, or a `LegalContentError` naming exactly what is wrong with it.
 *
 * **Every active locale is required.** Payload's `fallback: true` means a document published in
 * `en` alone still answers 200 under `/fa` and `/ar`, showing English text beneath the frontend's
 * "not translated into this language" notice. That is acceptable for editorial copy and not for a
 * policy a visitor is asked to consent to, so a partial document is refused here rather than
 * published and completed later.
 */
export function parseLegalPageSource(value: unknown): LegalPageSource {
  if (typeof value !== "object" || value === null) {
    throw new LegalContentError("The source file must contain a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const slug = record.slug;

  if (typeof slug !== "string" || !LEGAL_PAGE_SLUGS.includes(slug as LegalPageSlug)) {
    throw new LegalContentError(
      `"slug" must be one of ${LEGAL_PAGE_SLUGS.join(", ")}; received ${JSON.stringify(slug)}.`,
    );
  }

  if (typeof record.locales !== "object" || record.locales === null) {
    throw new LegalContentError('"locales" must be an object keyed by locale code.');
  }

  const supplied = record.locales as Record<string, unknown>;
  const missing = CMS_LOCALE_CODES.filter((code) => supplied[code] === undefined);

  if (missing.length > 0) {
    throw new LegalContentError(
      `Reviewed text is missing for: ${missing.join(", ")}. All of ${CMS_LOCALE_CODES.join(", ")} ` +
        `are required — Payload serves the ${CMS_DEFAULT_LOCALE} text under an untranslated locale, ` +
        `and a legal document read in a language it was not reviewed in is not a translation.`,
    );
  }

  const unrecognised = Object.keys(supplied).filter(
    (code) => !CMS_LOCALE_CODES.includes(code as CmsLocaleCode),
  );

  if (unrecognised.length > 0) {
    throw new LegalContentError(
      `"locales" carries ${unrecognised.join(", ")}, which the platform does not serve. ` +
        `The active set is ${CMS_LOCALE_CODES.join(", ")}.`,
    );
  }

  const locales = Object.fromEntries(
    CMS_LOCALE_CODES.map((code) => [code, assertLocaleContent(supplied[code], `locales.${code}`)]),
  ) as Record<CmsLocaleCode, LegalLocaleContent>;

  return {
    slug: slug as LegalPageSlug,
    lastUpdatedDate: assertIsoDate(record.lastUpdatedDate, '"lastUpdatedDate"'),
    revision: assertText(record.revision, '"revision"'),
    locales,
  };
}

/* ----------------------------------------------------- Lexical conversion */

type LexicalNode = Record<string, unknown>;

function textNode(text: string): LexicalNode {
  return { type: "text", detail: 0, format: 0, mode: "normal", style: "", text, version: 1 };
}

function listItem(text: string, index: number): LexicalNode {
  return {
    type: "listitem",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    value: index + 1,
    children: [textNode(text)],
  };
}

/**
 * One locale's blocks as the Lexical document Payload's `richText` field stores.
 *
 * The paragraph node is the one `publish-company-pages.ts` already writes; the heading and list
 * nodes are the default editor's own. `direction` stays `"ltr"` for `fa` and `ar` too: it is
 * Lexical's per-node bookkeeping, while the reading direction a visitor sees comes from
 * `<html dir>`, which the frontend sets from the `Locale` table.
 */
export function toLexicalDocument(body: readonly LegalBlock[]): Record<string, unknown> {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: body.map((block) => {
        if (block.kind === "heading") {
          return {
            type: "heading",
            tag: `h${String(block.level)}`,
            format: "",
            indent: 0,
            version: 1,
            direction: "ltr",
            children: [textNode(block.text)],
          };
        }

        if (block.kind === "list") {
          return {
            type: "list",
            listType: block.ordered === true ? "number" : "bullet",
            tag: block.ordered === true ? "ol" : "ul",
            start: 1,
            format: "",
            indent: 0,
            version: 1,
            direction: "ltr",
            children: block.items.map((item, index) => listItem(item, index)),
          };
        }

        return {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction: "ltr",
          textFormat: 0,
          textStyle: "",
          children: [textNode(block.text)],
        };
      }),
    },
  };
}
