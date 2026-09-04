import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  LEGAL_PAGE_SLUGS,
  LegalContentError,
  parseLegalPageSource,
  toLexicalDocument,
} from "./editorial/legal-content";
import { CMS_LOCALE_CODES } from "./localization";

/**
 * The legal-content publishing flow's validator, which is the part that decides whether text is
 * allowed to become a published legal page.
 *
 * The publish script itself is not exercised here: it opens Payload and writes to `sam_cms`, so a
 * test of it would be a test of a database. Everything that decides *whether* a file may be
 * published is in `legal-content.ts` and is pure, which is why it lives there.
 */

/** A minimal source that passes, used as the base every negative case mutates one field of. */
function validSource(): Record<string, unknown> {
  const locale = (language: string): Record<string, unknown> => ({
    title: `Privacy Policy (${language})`,
    body: [
      { kind: "heading", level: 2, text: `What we collect (${language})` },
      { kind: "paragraph", text: `We collect the details you send us (${language}).` },
      { kind: "list", items: [`Your name (${language})`, `Your company (${language})`] },
    ],
  });

  return {
    slug: "privacy-policy",
    lastUpdatedDate: "2026-08-30",
    revision: "2026-08-30",
    locales: { en: locale("en"), fa: locale("fa"), ar: locale("ar") },
  };
}

function rejects(source: unknown, expected: RegExp): void {
  assert.throws(
    () => parseLegalPageSource(source),
    (error: unknown) => error instanceof LegalContentError && expected.test(error.message),
  );
}

describe("the legal-text source format", () => {
  test("accepts a complete, reviewed document in every active locale", () => {
    const parsed = parseLegalPageSource(validSource());

    assert.equal(parsed.slug, "privacy-policy");
    assert.equal(parsed.lastUpdatedDate, "2026-08-30");
    assert.deepEqual(Object.keys(parsed.locales).sort(), [...CMS_LOCALE_CODES].sort());
  });

  test("serves only the four legal pages, never an arbitrary slug", () => {
    assert.deepEqual(
      [...LEGAL_PAGE_SLUGS],
      ["privacy-policy", "terms-of-use", "cookie-notice", "general-sales-conditions"],
    );
    rejects({ ...validSource(), slug: "about-us" }, /must be one of/);
  });

  /**
   * The rule the whole flow exists for. Payload's `fallback: true` makes an English-only document
   * answer 200 under `/fa` and `/ar`, so "published" and "translated" are not the same fact — and on
   * a document a visitor consents to, only the second one counts.
   */
  test("refuses a document that is missing any locale's reviewed text", () => {
    for (const missing of CMS_LOCALE_CODES) {
      const source = validSource();
      const locales = { ...(source.locales as Record<string, unknown>) };

      delete locales[missing];
      rejects({ ...source, locales }, new RegExp(`missing for: ${missing}`));
    }
  });

  test("refuses a locale the platform does not serve", () => {
    const source = validSource();
    const locales = {
      ...(source.locales as Record<string, unknown>),
      de: { title: "x", body: [] },
    };

    rejects({ ...source, locales }, /does not serve/);
  });

  test("refuses empty and whitespace-only text rather than publishing a blank page", () => {
    for (const blank of ["", "   "]) {
      const source = validSource();
      const locales = source.locales as Record<string, Record<string, unknown>>;

      rejects(
        { ...source, locales: { ...locales, fa: { ...locales.fa, title: blank } } },
        /is empty/,
      );
    }
  });

  test("refuses every placeholder marker, wherever it appears", () => {
    const markers = ["[TO CONFIRM]", "[ESTIMATE — CONFIRM]", "Lorem ipsum", "TODO", "TBD", "XXX"];

    for (const marker of markers) {
      const source = validSource();
      const locales = source.locales as Record<string, Record<string, unknown>>;

      rejects(
        {
          ...source,
          locales: { ...locales, en: { ...locales.en, title: `Privacy Policy ${marker}` } },
        },
        /placeholder marker/,
      );
    }
  });

  test("refuses a body with no blocks", () => {
    const source = validSource();
    const locales = source.locales as Record<string, Record<string, unknown>>;

    rejects(
      { ...source, locales: { ...locales, ar: { ...locales.ar, body: [] } } },
      /non-empty array of blocks/,
    );
  });

  test("refuses a revision date that is not a real calendar date", () => {
    rejects({ ...validSource(), lastUpdatedDate: "30-08-2026" }, /must be an ISO date/);
    rejects({ ...validSource(), lastUpdatedDate: "2026-02-31" }, /not a real calendar date/);
  });

  test("requires a revision identifier, and never derives one", () => {
    const source = validSource();

    delete source.revision;
    rejects(source, /revision/);
  });

  test("omits optional SEO values rather than deriving them from the title", () => {
    const parsed = parseLegalPageSource(validSource());

    assert.equal(parsed.locales.en.metaTitle, undefined);
    assert.equal(parsed.locales.en.metaDescription, undefined);
  });

  test("keeps supplied SEO values exactly as written", () => {
    const source = validSource();
    const locales = source.locales as Record<string, Record<string, unknown>>;
    const parsed = parseLegalPageSource({
      ...source,
      locales: {
        ...locales,
        en: {
          ...locales.en,
          metaTitle: "Privacy Policy | SAM Group",
          metaDescription: "How we handle enquiry data.",
        },
      },
    });

    assert.equal(parsed.locales.en.metaTitle, "Privacy Policy | SAM Group");
    assert.equal(parsed.locales.en.metaDescription, "How we handle enquiry data.");
  });

  test("rejects a body block kind that is not in the closed vocabulary", () => {
    const source = validSource();
    const locales = source.locales as Record<string, Record<string, unknown>>;

    rejects(
      { ...source, locales: { ...locales, en: { ...locales.en, body: [{ kind: "image" }] } } },
      /must be "heading", "paragraph" or "list"/,
    );
  });

  test("rejects a heading above level 3 — the page title is the h1", () => {
    const source = validSource();
    const locales = source.locales as Record<string, Record<string, unknown>>;

    rejects(
      {
        ...source,
        locales: {
          ...locales,
          en: { ...locales.en, body: [{ kind: "heading", level: 1, text: "Privacy" }] },
        },
      },
      /level must be 2 or 3/,
    );
  });
});

describe("the Lexical conversion", () => {
  test("maps each block to the node Payload stores, in order", () => {
    const document = toLexicalDocument([
      { kind: "heading", level: 3, text: "Retention" },
      { kind: "paragraph", text: "We keep enquiries for as long as stated." },
      { kind: "list", ordered: true, items: ["First", "Second"] },
    ]);

    const root = document.root as Record<string, unknown>;
    const [heading, paragraph, list] = root.children as Record<string, unknown>[];

    assert.equal(root.type, "root");
    assert.equal((root.children as unknown[]).length, 3);
    assert.equal(heading?.type, "heading");
    assert.equal(heading?.tag, "h3");
    assert.equal(paragraph?.type, "paragraph");
    assert.equal(list?.type, "list");
    assert.equal(list?.tag, "ol");
    assert.equal((list?.children as unknown[]).length, 2);
  });

  test("defaults a list to unordered", () => {
    const document = toLexicalDocument([{ kind: "list", items: ["Only"] }]);
    const [list] = (document.root as Record<string, unknown>).children as Record<string, unknown>[];

    assert.equal(list?.tag, "ul");
    assert.equal(list?.listType, "bullet");
  });

  test("carries the text through unchanged", () => {
    const document = toLexicalDocument([{ kind: "paragraph", text: "حریم خصوصی" }]);
    const [paragraph] = (document.root as Record<string, unknown>).children as Record<
      string,
      unknown
    >[];
    const [text] = paragraph?.children as Record<string, unknown>[];

    assert.equal(text?.text, "حریم خصوصی");
  });
});

describe("the example source file", () => {
  /**
   * The template is committed so the shape is discoverable, and it must stay unpublishable: every
   * text value in it is blank, and the validator rejects blanks. If someone ever fills it in and
   * commits it as the example, this fails rather than letting a template become content.
   */
  test("is a template and cannot be published", () => {
    const raw = readFileSync(
      new URL("../legal-content/privacy-policy.example.json", import.meta.url),
      "utf8",
    );

    rejects(JSON.parse(raw), /is empty/);
  });
});
