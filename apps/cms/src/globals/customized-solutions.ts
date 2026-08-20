import { lexicalHTMLField } from "@payloadcms/richtext-lexical";

import { editorOnly, publishedForService } from "../access";
import { anchorCtaField, ctaField } from "../fields/cta";
import { seoFields } from "../fields/seo";

import type { GlobalConfig } from "payload";

/**
 * `CustomizedSolutions` — the Customized Solutions page's editorial content.
 *
 * The second company Global, and deliberately a smaller one than `AboutUs`: three sections of copy
 * around a form that is not this Global's business at all.
 *
 * ── What this Global does NOT own: the form ────────────────────────────────
 *
 * The Custom Product Request form under the page's request anchor is **Prisma's and the API's**.
 * PAYLOAD_CONTENT_ARCHITECTURE.md §Customized Solutions states it directly — the
 * `CustomFormulationRequest` submission is a separate Prisma entity and "this Global is the
 * surrounding page copy only, never the form data".
 *
 * So nothing here describes a field, a label, an option list, a validation rule, a consent string
 * or a submission target. The form's fourteen fields follow the `custom_formulation_requests`
 * columns and the DTO that writes them; moving any of that into a CMS text input would let an edit
 * produce a form the database refuses.
 *
 * ── The schema is the page, and nothing more ───────────────────────────────
 *
 * §Customized Solutions specifies six field groups. **Three are deliberately absent**:
 * `whatCanWeCustomize` (five entries named in no approved document), `privateLabelProgramme` (two
 * lists, neither written, minimum order quantity unconfirmed) and `caseExamples` (marked at source
 * as placeholders pending real, customer-approved cases). Modelling a field for content that cannot
 * be written is how an empty repeater becomes a placeholder somebody eventually fills with a guess.
 *
 * Step *descriptions* are absent for the same reason: the six step names are transcribed from the
 * documentation, and no description exists for any of them.
 *
 * ── Two kinds of action, and only one of them has a destination here ───────
 *
 * The hero offers a route action (the published range) and an action that jumps to the request form
 * further down this same page. The first carries a route key; the second carries **a label and
 * nothing else** — the anchor it points at is part of the page's structure, declared in code, and
 * an editor renames the button rather than redirecting it. See `fields/cta.ts`.
 */
export const CustomizedSolutions: GlobalConfig = {
  slug: "customized-solutions",
  access: {
    read: publishedForService,
    update: editorOnly,
    /*
     * **Explicit, exactly as `AboutUs` is, and for the same measured reason.** Payload gives a
     * Global no default `readVersions` rule (`payload/dist/globals/config/sanitize.js`), and
     * `executeAccess` returns `true` for *any* authenticated identity when an access function is
     * absent — so without this line the `service` credential could read every draft through
     * `/api/globals/customized-solutions/versions`, straight past the published-only contract.
     */
    readVersions: editorOnly,
  },
  admin: {
    description:
      "The Customized Solutions page copy. The request form itself is not CMS content — its fields, validation and consent text belong to the API.",
    group: "Company pages",
  },
  /*
   * Draft/publish, per §Customized Solutions ("human review required — product-adjacent technical
   * and commercial claims").
   *
   * The mechanics are the ones established and measured for `AboutUs`: a draft save writes only a
   * version row, so the Global's own row always holds the last published state; `db.findGlobal`
   * applies the service identity's `_status` constraint and answers `{}` when it does not match;
   * and `?draft=true` cannot bypass it, because the same constraint is appended to the version
   * query as `version._status equals published`.
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
        anchorCtaField(
          "requestCta",
          "Request action",
          "This button always jumps to the request form on this page; its target is fixed in code.",
        ),
        ctaField("routeCta", "Route action"),
      ],
    },
    {
      name: "introduction",
      type: "group",
      fields: [
        { name: "heading", type: "text", localized: true },
        { name: "body", type: "richText", localized: true },
        /*
         * The same virtual HTML rendition `Pages` and `AboutUs` use: Payload's own converter, not a
         * second implementation of Lexical's node set inside `apps/api`, and `storeInDB: false` so
         * the database holds one representation of the content. NestJS sanitizes it before serving.
         */
        lexicalHTMLField({
          htmlFieldName: "bodyHtml",
          lexicalFieldName: "body",
          storeInDB: false,
        }),
      ],
    },
    {
      name: "process",
      type: "group",
      fields: [
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        {
          name: "steps",
          type: "array",
          label: "Process steps",
          admin: {
            description:
              "The stages in order. Their numbering is their position — it is not stored, and there is no description field: none is written for any step.",
          },
          fields: [{ name: "name", type: "text", required: true, localized: true }],
        },
      ],
    },
    /* The identical shared group `Pages` and `AboutUs` spread — one SEO contract, never restated. */
    ...seoFields(),
  ],
};
