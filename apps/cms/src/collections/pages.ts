import { lexicalHTMLField } from "@payloadcms/richtext-lexical";

import { editorOnly, publishedForService } from "../access";

import type { CollectionConfig } from "payload";

/**
 * `Pages` — the Legal Pages collection, and **only** that.
 *
 * PAYLOAD_CONTENT_ARCHITECTURE.md §1 is precise about why this one collection is generic while
 * every bespoke page is a Global: Privacy Policy, Terms of Use, Cookie Notice and General Sales
 * Conditions are genuinely interchangeable in shape (title + rich text + last-updated date) and
 * open-ended in count. **This is not a page builder and must never become one** — no blocks, no
 * `pageType` discriminator, no layout fields. Layout is code, editorial content is CMS
 * (PROJECT_HANDOFF.md §6.7).
 *
 * ── Field set: the frozen four, and what is deliberately absent ─────────────
 *
 * §1 specifies `title`, `slug`, `body` (rich text), `lastUpdatedDate` and "standard `SeoFields`".
 * The first four are here. **`SeoFields` is deliberately NOT implemented in this gate** — the
 * contract in SEO_ARCHITECTURE.md §2 includes `socialImageId`, a reference to Payload's Media
 * collection, and no upload collection, storage adapter or media pipeline exists yet; a partial
 * group would put a contract on the wire that agrees with neither document. It is recorded as
 * outstanding, not dropped.
 *
 * ── No legal content ────────────────────────────────────────────────────────
 *
 * SITE_STRUCTURE.md §12 states these are drafting specifications, not finished legal text, and
 * that they need actual legal review before publication. Nothing in this repository seeds, drafts
 * or approximates any of them, and the demo entry the bootstrap script creates says so in its own
 * body.
 */
export const Pages: CollectionConfig = {
  slug: "pages",
  access: {
    create: editorOnly,
    delete: editorOnly,
    read: publishedForService,
    update: editorOnly,
  },
  admin: {
    defaultColumns: ["title", "slug", "lastUpdatedDate", "_status"],
    description:
      "Legal pages only. Bespoke company pages are Globals with their own schemas, not entries here.",
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      /*
       * NOT localized, and that is the frozen URL strategy rather than an omission: structural page
       * URLs stay fixed English across every locale, and localized slugs apply only to products,
       * categories and blog articles (PROJECT_HANDOFF.md §6.12). It is also what makes a page
       * findable by slug in a locale it has no translation for — the lookup and the fallback are
       * then independent of each other.
       */
      localized: false,
      admin: {
        description:
          "URL segment, identical in every locale. Lowercase letters, digits and single hyphens.",
        position: "sidebar",
      },
      validate: (value: unknown): string | true => {
        if (typeof value !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
          return "Must be lowercase letters, digits and single hyphens, with no leading or trailing hyphen.";
        }

        return true;
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      localized: true,
    },
    /*
     * A virtual, unstored HTML rendition of `body`, computed on read from whichever locale was
     * resolved.
     *
     * It exists because API_CONTRACT_FINAL.md §4 makes Payload's response shapes — "rich-text AST"
     * named explicitly — an internal detail that must never reach the frontend. Something has to
     * turn the Lexical document into a transport shape, and the three candidates are: this
     * (Payload's own official converter), a hand-written AST walker inside `apps/api` (a second
     * implementation of Lexical's node set, to be maintained against a library `apps/api` does not
     * depend on), or a new block vocabulary invented for the wire (a contract decision this gate
     * has no mandate to make). Only the first invents nothing.
     *
     * `storeInDB: false` keeps the database holding one representation of the content, so the HTML
     * can never drift from the document it came from.
     */
    lexicalHTMLField({ htmlFieldName: "bodyHtml", lexicalFieldName: "body", storeInDB: false }),
    {
      name: "lastUpdatedDate",
      type: "date",
      /*
       * A fact, not copy — the same reasoning §1's "Field Structure Summary" applies to certificate
       * numbers and dates. A legal page is not revised on different dates in different languages.
       */
      localized: false,
      admin: {
        date: { pickerAppearance: "dayOnly" },
        position: "sidebar",
      },
    },
  ],
  /*
   * Draft/publish, per §1's publishing workflow for this collection ("human review required, plus
   * actual legal review"). It is also what `publishedForService` constrains on and what makes
   * API_CONTRACT_FINAL.md §4's "public endpoints request published content only" enforceable rather
   * than merely intended.
   */
  versions: {
    drafts: true,
  },
};
