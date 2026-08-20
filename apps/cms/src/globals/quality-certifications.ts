import { editorOnly, publishedForService } from "../access";
import { ROUTE_OPTIONS, ctaField } from "../fields/cta";
import { seoFields } from "../fields/seo";

import type { Field, GlobalConfig, SelectFieldManyValidation } from "payload";

/**
 * `QualityCertifications` — the Quality & Certifications page's editorial content.
 *
 * The third company Global, and the one the source document calls the platform's highest-stakes
 * page for accuracy. Everything unusual about this schema follows from that single sentence.
 *
 * ── The certifications decision, frozen: Q3 ────────────────────────────────
 *
 * There is **no `Certifications` collection in this gate, and no relation to one.** The
 * `certifications` group below models the page's *current truthful state* — that the list is
 * unconfirmed and nothing stands in its place — and it is structurally incapable of modelling
 * anything else. No array, no repeater, no issuer, no certificate number, no validity date, no
 * upload, no logo, no external link, no lifecycle field, no count.
 *
 * That is not conservatism for its own sake. SECURITY.md's RBAC matrix carves certifications out of
 * Content Manager's otherwise-full CMS access — drafting yes, publishing no — and enforces that in
 * Payload, because a buyer who checks a claimed certification and finds nothing is a lost buyer.
 * **This Global carries the ordinary company-page rule (`update: editorOnly`), so a Content Manager
 * can publish it.** The two facts are only compatible while this schema cannot hold a certification
 * claim. A single `certificationName` text field, or a repeater of them, would let a Content Manager
 * publish "ISO 9001" through a Global that has no Admin gate — the carve-out defeated by the back
 * door. `quality-certifications.test.ts` fails if any such field appears.
 *
 * The collection, its Admin-only publish gate and its relation into this Global are **owed to
 * CMS-4**, with nothing in this slice to migrate when they arrive: the relation joins the group that
 * already exists, and the withheld statement becomes its empty state.
 *
 * ── No `heroImage`, and that is a decision rather than an omission ──────────
 *
 * `PAYLOAD_CONTENT_ARCHITECTURE.md` §Quality & Certifications lists this Global's media as "Hero
 * image; lab/testing photography". Only the second is modelled. The hero's right column on this
 * page is the verification chain — the index device every hero on this platform carries — so a hero
 * image field would have no slot to render into, and a CMS field that nothing consumes is a field an
 * editor will eventually fill and then wonder why nothing changed.
 *
 * ── Plain text, not rich text, for the two prose fields ────────────────────
 *
 * The same document specifies rich text for `laboratoryCapability` and `samplingPolicyText`. Both
 * are single sentences in a fixed composition here — the sampling statement is rendered as the
 * section's own `<h2>` — so a Lexical editor plus an HTML rendition plus server-side sanitization
 * would be three mechanisms carrying markup the layout does not accept. `AboutUs` and
 * `CustomizedSolutions` keep `richText` exactly where their pages render prose blocks; this page
 * renders none.
 *
 * ── Every section that shows an eyebrow owns it ────────────────────────────
 *
 * All seven do. Three of them — `approach`, `laboratory`, `documentation` — rendered theirs as
 * hardcoded English until this correction, on a page served in `en`, `fa` and `ar`. An eyebrow is
 * not chrome: it is a visible line of page copy naming the band a reader is in, and leaving it in
 * code meant a Persian or Arabic reader met an English label above translated content. Layout is
 * code and editorial content is CMS (PROJECT_HANDOFF §6.7); this is editorial content.
 *
 * They are optional, like every other eyebrow here, and **the frontend supplies no fallback string**
 * — an unwritten eyebrow renders nothing at all rather than reverting to English. That is the whole
 * point of moving them.
 *
 * ── Product taxonomy is not moving here ────────────────────────────────────
 *
 * `sampling.families` stores **keys and only keys** — the six frozen ADR-009 canonical `Category`
 * slugs. No label, no href, no description, no ordering, no Product row. `apps/web` resolves a key
 * against its own canonical table, exactly as it resolves a `ContentRouteKey`. Payload may never
 * mirror a Prisma-owned entity (ADR-002), and a select whose values are identifiers is the same
 * bargain `fields/cta.ts` already struck for routes.
 */

/**
 * The six Product Families, as identifiers.
 *
 * Each `value` is the canonical ADR-009 identifier: simultaneously the default-locale
 * `Category.slug` in `sam_platform`, the `/{locale}/products/{slug}` route segment, and the
 * frontend's `ProductFamily` key. The `label` is admin-panel chrome — what an editor picks from in
 * this one dropdown — and is **never served**: the projection in `apps/api` reads the value and
 * discards everything else, and `apps/web` renders the family's name from its own table.
 */
export const PRODUCT_FAMILY_OPTIONS = [
  { label: "Base Oils", value: "base-oils" },
  { label: "Lubricant Additives & Components", value: "lubricant-additives" },
  { label: "Engine Oils & Automotive Lubricants", value: "engine-oils-automotive-lubricants" },
  { label: "Industrial Oils & Lubricants", value: "industrial-oils-lubricants" },
  { label: "Marine Oils & Lubricants", value: "marine-oils-lubricants" },
  { label: "Antifreeze & Coolants", value: "antifreeze-coolants" },
];

/**
 * At least one family, or the section does not describe a policy.
 *
 * "Samples are issued before commitment" published with no scope beside it is a broader promise than
 * any approved document makes — the source confirms the policy for two families and declines to
 * extend it to the other four. An empty selection would render the promise and drop the limit, so it
 * is refused at save time here and the section is additionally not rendered at all when no key
 * resolves (`apps/web`). Two independent guards, because only one of them is in this database.
 */
const requireOneFamily: SelectFieldManyValidation = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return "Select at least one product family. The sampling policy is published with its scope or not at all.";
  }

  return true;
};

/**
 * The laboratory photograph, and its caption.
 *
 * Deliberately the same two-field shape `AboutUs` uses, restated rather than imported: `AboutUs`
 * declares `imageFields()` as a private helper inside its own module, and reaching into another
 * Global for it would make one company page a dependency of another for two field definitions.
 *
 * **Alt text is not here.** It lives on the `Media` record itself, required and localized, which is
 * the platform's single place for describing an image (SEO_ARCHITECTURE.md §Image SEO).
 *
 * Absent is a supported state: with no upload the page renders no `<figure>` at all — not an empty
 * frame, not a placeholder, not a pending marker.
 */
function laboratoryImageFields(): Field[] {
  return [
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      /*
       * Not localized. A photograph of the bench is the same photograph in every language, and the
       * only text a reader reads about it — its alt — is localized on the Media record.
       */
      localized: false,
      admin: {
        description:
          "Optional. Instruments and bench, not portraits. The section renders with no figure at all when this is empty.",
      },
    },
    {
      name: "imageCaption",
      type: "text",
      localized: true,
      admin: { description: "Optional caption shown under the image." },
    },
  ];
}

export const QualityCertifications: GlobalConfig = {
  slug: "quality-certifications",
  /*
   * ── Why this Global names its tables `quality_*` rather than after its slug ─
   *
   * **Postgres refuses identifiers longer than 63 characters, and this schema crossed it.** Payload
   * derives a table name per array field, per locale table and per version table by concatenating
   * the entity name with the field path, so the drafts copy of the laboratory's withheld-attributes
   * repeater came out as
   * `_quality_certifications_v_version_laboratory_unpublished_locales` — 64 characters. Payload
   * detects this and refuses to initialise at all: `APIError: Exceeded max identifier length for
   * table or enum name of 63 characters`, with the config's own suggestion to set `dbName`.
   *
   * TESTED: without this line the CMS answers 500 on every request and never reaches the database;
   * with it, the schema pushes and the Global serves.
   *
   * Shortening a field name instead was the alternative and is worse: `unpublished` and
   * `laboratory` are the vocabulary this page's own documentation uses, and renaming published
   * concepts to fit a table name would put the constraint in the wrong place. `dbName` moves it to
   * the one layer that actually has the limit.
   *
   * **FROZEN.** `dbName: "quality"` is intentionally frozen because the default Payload-generated
   * identifier exceeds PostgreSQL's identifier-length limit. **Changing this `dbName` after data
   * exists requires an explicit CMS migration** — Payload would look for tables under new names and
   * find none. No migration exists or is owed today: `sam_cms` holds no Quality row.
   *
   * **This is a storage name, not a public one, and nothing public moved with it.** The Global's
   * slug stays `quality-certifications`, its REST path stays `/api/globals/quality-certifications`,
   * the NestJS content name stays `quality-certifications`, and the route stays
   * `/{locale}/quality-certifications`.
   */
  dbName: "quality",
  access: {
    read: publishedForService,
    update: editorOnly,
    /*
     * **Explicit, exactly as the two Globals before it.** Payload gives a Global no default
     * `readVersions` rule, and `executeAccess` returns `true` for any authenticated identity when
     * one is absent — so without this line the `service` credential could read every draft through
     * `/api/globals/quality-certifications/versions`, straight past the published-only contract.
     */
    readVersions: editorOnly,
  },
  admin: {
    description:
      "The Quality & Certifications page. No certificate, standard, licence, accreditation, issuing body, number or validity date is modelled anywhere in this Global — the certifications section states that the list is unconfirmed, and that is all it can state.",
    group: "Company pages",
  },
  /*
   * Draft/publish, per §Quality & Certifications ("human review required — explicitly the
   * highest-stakes page for accuracy"). The mechanics are the ones measured for `AboutUs`: a draft
   * save writes only a version row, `db.findGlobal` applies the service identity's `_status`
   * constraint and answers `{}` when it does not match, and `?draft=true` cannot bypass it because
   * the same constraint is appended to the version query.
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
        {
          name: "indexLabel",
          type: "text",
          localized: true,
          admin: {
            description:
              "Heading for the stage chain beside the hero. The chain itself is read from the testing stages below — it is not a second list.",
          },
        },
        ctaField("primaryCta", "Primary action"),
        ctaField("secondaryCta", "Secondary action"),
      ],
    },
    {
      name: "approach",
      type: "group",
      label: "Our quality approach",
      admin: {
        description:
          "The stages at which testing happens. Their order is their position in the list — a batch meets them in sequence.",
      },
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        {
          name: "stages",
          type: "array",
          label: "Testing stages",
          fields: [
            { name: "name", type: "text", required: true, localized: true },
            {
              name: "when",
              type: "text",
              required: true,
              localized: true,
              admin: {
                description:
                  "Where the stage sits in the material's passage — not what is done inside it. No approved document describes the contents of any stage, so describing one here would be writing a procedure.",
              },
            },
          ],
        },
        {
          name: "footnote",
          type: "textarea",
          localized: true,
          admin: {
            description:
              "States what this section does not publish. A reader shown three stage names fills in their contents unless told the page is not saying.",
          },
        },
      ],
    },
    {
      name: "laboratory",
      type: "group",
      label: "Laboratory capability",
      /*
       * The truthfulness guard, stated where an editor will actually read it.
       *
       * SITE_STRUCTURE §7 introduces the fourteen as an "in-house test list" and then marks
       * `[TO CONFIRM]` which are in-house versus outsourced — the source contradicts itself in one
       * sentence. The page resolves that more conservatively than the source: it claims neither, and
       * says on the page that it claims neither.
       *
       * That resolution is only as durable as the person editing the copy, so the warning is
       * attached to the fields rather than left in a document nobody opens. It is a description, not
       * a validation rule: refusing to save prose containing the word "in-house" would be
       * hard-coding marketing vocabulary into a schema, and would be trivially worked around.
       */
      admin: {
        description:
          "Property names only. A property name does NOT establish that Sam Group performs that test, performs it in-house, owns the equipment, holds an accreditation for it, or can meet any numeric value. No approved document names a single test standard. Do not add a method designation, a test condition or a result to any wording here.",
      },
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        { name: "registerLabel", type: "text", localized: true },
        {
          name: "orderNote",
          type: "text",
          localized: true,
          admin: { description: "How the register is ordered — e.g. the source's own order." },
        },
        {
          name: "properties",
          type: "array",
          label: "Properties tested",
          admin: {
            description:
              "A name, and nothing else. There is deliberately no field here for a test method, a condition, a unit, a value, a result, an accreditation, an instrument or an in-house marker — a wrong method number cited against a real property is a technical error a buyer would specify against.",
          },
          fields: [{ name: "name", type: "text", required: true, localized: true }],
        },
        { name: "unpublishedHeading", type: "text", localized: true },
        {
          name: "unpublished",
          type: "array",
          label: "What this register does not carry",
          admin: {
            description:
              "Each attribute the register withholds, with the reason, shown to the reader. Removing the in-house/external entry would let a 'Laboratory Capability' heading be read as claiming all of them in-house.",
          },
          fields: [
            { name: "name", type: "text", required: true, localized: true },
            { name: "why", type: "textarea", required: true, localized: true },
          ],
        },
        ...laboratoryImageFields(),
      ],
    },
    {
      /*
       * The withheld section — five strings, and structurally nothing else. See this module's header
       * for why the absence is load-bearing rather than provisional.
       */
      name: "certifications",
      type: "group",
      label: "Certifications",
      admin: {
        description:
          "This section publishes ONE statement and no list. There is no field here for a certificate, standard, licence, accreditation, issuing body, certificate number, validity date, mark, logo or link, and none may be added — the real list is unconfirmed, and a placeholder is the one claim on this page a reader has no way to check. The Certifications collection with its Admin-only publish gate is a later gate.",
      },
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        { name: "heading", type: "text", localized: true },
        {
          name: "status",
          type: "text",
          localized: true,
          admin: {
            description:
              "The state, as words. It is rendered as text beside a decorative mark, never as a colour alone.",
          },
        },
        { name: "statement", type: "textarea", localized: true },
        { name: "note", type: "textarea", localized: true },
      ],
    },
    {
      name: "documentation",
      type: "group",
      label: "Documentation we provide",
      admin: {
        description:
          "An informational register of the paperwork a shipment carries. Nothing here is a download: there is no file field and no link field, and the note below must keep saying so — six document names under a heading are read as six files otherwise.",
      },
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        { name: "heading", type: "text", localized: true },
        { name: "lead", type: "textarea", localized: true },
        { name: "registerLabel", type: "text", localized: true },
        {
          name: "documents",
          type: "array",
          label: "Documents provided",
          fields: [
            { name: "name", type: "text", required: true, localized: true },
            {
              name: "scope",
              type: "text",
              localized: true,
              admin: {
                description:
                  "Optional. What the document is issued against — only where an approved document states it.",
              },
            },
          ],
        },
        {
          name: "note",
          type: "textarea",
          localized: true,
          admin: {
            description:
              "The line that keeps this register from reading as a download list. Do not remove it while none of these can be obtained from this site.",
          },
        },
      ],
    },
    {
      name: "sampling",
      type: "group",
      label: "Sampling policy",
      /*
       * No `heading` field, and that is not an omission: the statement is rendered as the section's
       * own `<h2>`. A separate heading would sit between the eyebrow and the sentence doing the work
       * neither of them needs done.
       */
      fields: [
        { name: "eyebrow", type: "text", localized: true },
        {
          name: "statement",
          type: "textarea",
          required: true,
          localized: true,
          admin: {
            description:
              "The policy itself, in one sentence. It is the section's heading — there is no separate heading field.",
          },
        },
        { name: "familiesLabel", type: "text", localized: true },
        {
          name: "families",
          type: "select",
          hasMany: true,
          options: PRODUCT_FAMILY_OPTIONS,
          /*
           * A destination is not copy, and neither is an identifier. The same family is the same
           * family in every language; only its published name changes, and that name lives in
           * `sam_platform`, not here.
           */
          localized: false,
          required: true,
          validate: requireOneFamily,
          admin: {
            description:
              "Which product families the policy is confirmed for. Payload stores identifiers only — the family's name and its page address come from the product catalogue, never from here. Select at least one: the policy is published with its scope or not at all.",
          },
        },
        {
          name: "limit",
          type: "textarea",
          localized: true,
          admin: {
            description:
              "States that the policy is not extended beyond the families selected above. Publishing the policy without its limit is a broader promise than the documentation makes.",
          },
        },
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
    /* The identical shared group `Pages`, `AboutUs` and `CustomizedSolutions` spread. */
    ...seoFields(),
  ],
};
