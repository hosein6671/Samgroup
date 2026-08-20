import { lexicalHTMLField } from "@payloadcms/richtext-lexical";

import { editorOnly, publishedForService } from "../access";
import { ROUTE_OPTIONS, ctaField } from "../fields/cta";
import { seoFields } from "../fields/seo";

import type { Field, GlobalConfig } from "payload";

/**
 * `AboutUs` — the About Us page's editorial content, and the platform's first company Global.
 *
 * ── Why a Global and not a `Pages` entry ────────────────────────────────────
 *
 * PAYLOAD_CONTENT_ARCHITECTURE.md decision 1: bespoke company pages are Globals with tailored
 * schemas; `Pages` is the generic collection for legal pages *only*. Forcing About Us into `Pages`
 * would be the page builder this project rejected outright (PROJECT_HANDOFF.md §6.7).
 *
 * ── The schema is the page, and nothing more ───────────────────────────────
 *
 * §About Us specifies eleven fields. **Three are deliberately absent**: `milestones`,
 * `competitiveAdvantages` and `team` have no approved content — SITE_STRUCTURE.md marks the
 * timeline an estimate end to end, names the six advantages nowhere, and blocks the roster on
 * photography. Modelling a field for content that cannot be written is how an empty repeater
 * becomes a placeholder somebody eventually fills with a guess. Each is one field plus one section
 * component on the day its copy is approved.
 *
 * Every field below is rendered by the About page today. Nothing here is speculative.
 *
 * ── What is NOT editorial, and stays in code ───────────────────────────────
 *
 * - **Structural URLs.** A call to action carries a `label` and a `route` *key*, never an href —
 *   `fields/cta.ts` holds that vocabulary, shared with every other Global so a route list cannot
 *   exist twice. Structural page URLs stay fixed English across locales and are locale-prefixed at
 *   render time (PROJECT_HANDOFF.md §6.12); an editable href would hand that contract to a text
 *   input.
 * - **The six Product Families.** The published range is `Category` data in `sam_platform` and its
 *   navigation is code (`features/site/site-routes.ts`). Restating it here would put a second copy
 *   of a frozen taxonomy in the one database that must never mirror the other (ADR-002).
 */

/**
 * An optional photograph for a section, plus its caption.
 *
 * **Alt text is not here.** It lives on the `Media` record itself, required and localized, which is
 * the single place the platform describes an image (SEO_ARCHITECTURE.md §Image SEO). A second alt
 * field per usage would be two answers to one question.
 *
 * Absent is a supported state rather than a broken one: the section renders without its figure and
 * the layout collapses to a single column.
 */
function imageFields(): Field[] {
  return [
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      /*
       * Not localized. A photograph of the plant is the same photograph in every language, and the
       * only text a reader reads about it — its alt — is localized on the Media record.
       */
      localized: false,
      admin: { description: "Optional. The section renders without a figure when this is empty." },
    },
    {
      name: "imageCaption",
      type: "text",
      localized: true,
      admin: { description: "Optional caption shown under the image." },
    },
  ];
}

export const AboutUs: GlobalConfig = {
  slug: "about-us",
  access: {
    read: publishedForService,
    update: editorOnly,
    /*
     * **Explicit, and it has to be.** Verified in `payload/dist/globals/config/sanitize.js`: unlike
     * `read` and `update`, `readVersions` is given no default. `executeAccess` then takes its
     * `if (req.user) return true` branch, so with this line removed **any authenticated identity —
     * the `service` credential included — could read every draft** through
     * `/api/globals/about-us/versions`.
     *
     * The published-only contract would leak through the door beside the one it guards.
     */
    readVersions: editorOnly,
  },
  admin: {
    description:
      "The About Us page. Milestones, competitive advantages and team are deliberately not modelled — they have no approved content yet.",
    group: "Company pages",
  },
  /*
   * Draft/publish, per §About Us ("human review required").
   *
   * Verified in `payload/dist/globals/operations/update.js`: a draft save skips `updateGlobal`
   * entirely and writes only a version row, so the Global's own row always holds the last published
   * state. That is what makes `publishedForService`'s `_status` constraint meaningful here —
   * `db.findGlobal` applies the access `Where` and returns `{}` when it does not match
   * (`@payloadcms/drizzle/dist/findGlobal.js`), so an unpublished page is an empty document to the
   * service identity rather than a draft.
   *
   * `?draft=true` cannot bypass it either: `replaceWithDraftIfAvailable` appends the same access
   * constraint to the version query as `version._status equals published`, which can never match a
   * row whose `version._status` is `draft`.
   */
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: "hero",
      type: "group",
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        {
          name: "title",
          type: "text",
          required: true,
          localized: true,
          admin: {
            description:
              "The page's H1. Required — a document with no heading is treated as unconfigured and is not served.",
          },
        },
        { name: "supportingText", type: "textarea", localized: true },
        ctaField("primaryCta", "Primary action"),
        ctaField("secondaryCta", "Secondary action"),
        ...imageFields(),
      ],
    },
    {
      name: "whoWeAre",
      type: "group",
      fields: [
        { name: "heading", type: "text", localized: true },
        { name: "body", type: "richText", localized: true },
        /*
         * The same virtual HTML rendition `Pages` uses, for the same reason: API_CONTRACT_FINAL.md
         * §4 makes Payload's rich-text AST an internal detail that must never reach the frontend,
         * and this is Payload's own converter rather than a second implementation of Lexical's node
         * set inside `apps/api`. `storeInDB: false` keeps one representation in the database.
         *
         * NestJS sanitizes the result before serving it — the boundary is the API, never the
         * consumer.
         */
        lexicalHTMLField({
          htmlFieldName: "bodyHtml",
          lexicalFieldName: "body",
          storeInDB: false,
        }),
        {
          name: "positions",
          type: "array",
          label: "Positioning statements",
          fields: [
            { name: "term", type: "text", required: true, localized: true },
            { name: "note", type: "textarea", required: true, localized: true },
          ],
        },
        ...imageFields(),
      ],
    },
    {
      name: "expertise",
      type: "group",
      fields: [
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        {
          name: "items",
          type: "array",
          label: "Named areas",
          fields: [{ name: "name", type: "text", required: true, localized: true }],
        },
      ],
    },
    {
      name: "qualityStandards",
      type: "group",
      fields: [
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        {
          name: "items",
          type: "array",
          label: "Commitments",
          fields: [
            { name: "name", type: "text", required: true, localized: true },
            {
              name: "note",
              type: "textarea",
              localized: true,
              admin: { description: "Optional second line." },
            },
          ],
        },
        { name: "footnote", type: "textarea", localized: true },
        ctaField("footnoteCta", "Footnote link"),
        ...imageFields(),
      ],
    },
    {
      name: "closing",
      type: "group",
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        ctaField("primaryCta", "Primary action"),
        {
          name: "routes",
          type: "array",
          label: "Other routes",
          fields: [
            { name: "label", type: "text", required: true, localized: true },
            { name: "route", type: "select", options: ROUTE_OPTIONS, localized: false },
          ],
        },
      ],
    },
    /*
     * The identical shared group `Pages` spreads — SEO_ARCHITECTURE.md §3's "Future collections"
     * adopting one contract rather than each restating it.
     */
    ...seoFields(),
  ],
};
