import type { Field } from "payload";

/**
 * `seoFields()` — the Payload half of the platform's one SEO contract.
 *
 * ── One contract, two implementations, by necessity ────────────────────────
 *
 * SEO_ARCHITECTURE.md §0 sets this out: ADR-002 splits content across two databases, so a single
 * shared SEO *table* is impossible. What is shared is the *shape* — declared once in
 * `packages/types/src/seo.ts`, implemented by Prisma's polymorphic `SeoMeta` table for
 * `sam_platform` content and by this function for `sam_cms` content, and normalised into one wire
 * shape by NestJS before `apps/web` sees either. §3 is explicit that it must be "a single reusable
 * field-group function ... spread into every collection/global that needs it, so the fields are
 * defined once and reused, not copy-pasted per collection". Hence a function returning a `Field[]`,
 * used today by `Pages` and unchanged when the seven company Globals arrive.
 *
 * ── The field list is transcribed, not designed ────────────────────────────
 *
 * Every field below is a row of SEO_ARCHITECTURE.md §2's contract table. Nothing is added because
 * an SEO plugin usually has it. Two rows of that table are deliberately **not** stored fields here,
 * and both omissions are structural rather than partial implementation:
 *
 * - **`locale`.** §2 lists it as "which locale this SEO record belongs to". In Payload that is not
 *   data — the group is localized, so the locale is the request's, and every value below is already
 *   scoped by it. Storing it too would create a second source of truth for the same fact, free to
 *   disagree with the first. NestJS puts the requested locale on the normalized record, which is
 *   where `SeoFields.locale` in `packages/types` actually comes from.
 * - **`alternates`.** Present on the normalized wire shape, absent from storage, because it is
 *   *derived*: which locales an entity is genuinely translated into is a fact about the documents,
 *   not something an editor types. INTERNATIONALIZATION_STRATEGY.md §4 requires untranslated locales
 *   be omitted rather than pointed at a fallback, which only a computed answer can guarantee.
 *
 * ── Which fields are localized, and why that is not uniform ────────────────
 *
 * Copy is localized; switches and structural choices are not. A `noindex` decision is about the
 * entity, not about a language — an editor who marks a page `noindex` in English has not asked for
 * it to stay indexed in Arabic, and per-locale robots flags would make that trap easy to fall into.
 * The same reasoning keeps `twitterCardType` and `canonicalUrl` unlocalized: a card type is a
 * rendering choice, and a canonical override that differed per locale would defeat the hreflang
 * cluster it belongs to.
 */
export function seoFields(): Field[] {
  return [
    {
      name: "seo",
      type: "group",
      label: "SEO",
      admin: {
        description:
          "Optional. Every field falls back to the page's own content when left empty — an empty title or description is never shipped.",
      },
      fields: [
        {
          name: "metaTitle",
          type: "text",
          localized: true,
          admin: {
            description: "Falls back to the page title.",
          },
        },
        {
          name: "metaDescription",
          type: "textarea",
          localized: true,
          admin: {
            description:
              "Falls back to the page's own content. Aim for roughly 150–160 characters.",
          },
        },
        {
          name: "canonicalUrl",
          type: "text",
          /*
           * Not localized: see the header. Also not defaulted — §2's "falls back to the entity's own
           * resolved URL" is a URL-composition step, and `packages/types/src/seo.ts` already records
           * that composing public URLs belongs to `apps/web`. Null here means "no override".
           */
          localized: false,
          admin: {
            description:
              "Override only. Leave empty unless this page deliberately points at another URL.",
          },
        },
        {
          name: "ogTitle",
          type: "text",
          localized: true,
          admin: { description: "Falls back to the meta title." },
        },
        {
          name: "ogDescription",
          type: "textarea",
          localized: true,
          admin: { description: "Falls back to the meta description." },
        },
        {
          name: "socialImage",
          type: "upload",
          relationTo: "media",
          /*
           * §2's `socialImageId`, and the reason this gate needed the Media collection first.
           *
           * Localized because §Multilingual SEO calls for "localized OG images where the image
           * itself contains text" — a social card carrying English words is the wrong card for an
           * Arabic share, and `fallback: true` means a single image still serves every locale until
           * someone supplies a translated one.
           *
           * Deliberately its own field rather than reusing a page's hero image: §Image SEO requires
           * exactly that separation, so an OG preview does not silently break the day a hero image
           * changes.
           */
          localized: true,
          admin: {
            description:
              "Shown when the page is shared. 1200×630 is the platform convention. Separate from any hero image on purpose.",
          },
        },
        {
          name: "twitterCardType",
          type: "select",
          /*
           * The closed set from §2, with §2's own default. `packages/types` cannot carry it — that
           * file is types-only by construction — so the default lives in each runtime that
           * normalizes the record, and this is Payload's.
           */
          options: [
            { label: "Summary", value: "summary" },
            { label: "Summary, large image", value: "summary_large_image" },
          ],
          defaultValue: "summary_large_image",
          localized: false,
        },
        {
          name: "twitterTitle",
          type: "text",
          localized: true,
          admin: { description: "Falls back to the Open Graph title." },
        },
        {
          name: "twitterDescription",
          type: "textarea",
          localized: true,
          admin: { description: "Falls back to the Open Graph description." },
        },
        {
          name: "twitterImage",
          type: "upload",
          relationTo: "media",
          localized: true,
          admin: { description: "Falls back to the social image above." },
        },
        {
          name: "robotsIndex",
          type: "checkbox",
          defaultValue: true,
          localized: false,
          label: "Allow indexing",
          admin: {
            description: "Uncheck to mark this page noindex.",
          },
        },
        {
          name: "robotsFollow",
          type: "checkbox",
          defaultValue: true,
          localized: false,
          label: "Allow following links",
          admin: {
            description: "Uncheck to mark this page nofollow.",
          },
        },
        {
          name: "keywords",
          type: "text",
          hasMany: true,
          /*
           * Localized: a keyword is a search term, and search terms do not survive translation. §2
           * is candid that these carry little ranking weight and are kept for internal content
           * planning, which is why the field exists at all rather than being quietly dropped.
           */
          localized: true,
          admin: {
            description: "Internal content planning. Not a ranking factor in modern search.",
          },
        },
        {
          name: "structuredDataOverride",
          type: "json",
          localized: true,
          admin: {
            description:
              "Advanced. Replaces the automatically generated JSON-LD for this page. Leave empty to use the automatic output.",
          },
        },
      ],
    },
  ];
}
