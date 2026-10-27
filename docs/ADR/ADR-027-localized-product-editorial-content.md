# ADR-027: Localized product editorial content and a guarded content import

## Status

**Accepted, 28 October 2026.** Proposed on 27 October 2026 at the owner's request, so that Persian
product content can be authored, stored, published and imported; approved by the owner on
28 October 2026, together with its implementation in English and Persian at once.

**Implementation notes (28 October 2026):**

- The audit trail has no metadata column, so the locale cannot be stored on `product.published`.
  A non-default locale is audited as `product.localization_published` /
  `product.localization_draft_saved` instead; the locale itself is not recorded. Recording it needs
  a column on `admin_audit_events` and its own decision.
- The import CLI has no signed-in user. Its audit rows carry no actor, and `--operator <label>` is
  required and printed in the run report, not stored.
- `hreflang`: the API's alternates still come only from translated slugs, which ADR-027 does not
  create, so no non-default locale is advertised yet — stricter than §4, never looser.
- The CLI lives at `apps/api/src/modules/catalog/import/content/` and runs as
  `pnpm catalog:content:import --file <path>`; `--locale <code>` limits a run to one locale.

**Amends:** ADR-024, which gains a locale dimension for product content. Nothing in
ADR-001 to ADR-026 is superseded. ADR-019 stays authoritative where an approved `product_copy` row
exists.

## Context

### What the live site shows (checked 27 October 2026 against `samgp.com`)

| Measure                                               |          Live value |
| ----------------------------------------------------- | ------------------: |
| Products served by `GET /products`                    |                 100 |
| Product–grade relationships                           |                 134 |
| Public specification rows                             | 1,397 (99 products) |
| Products with a description                           |                   0 |
| Products with published applications / features / FAQ |           0 / 0 / 0 |
| Products with SEO meta description                    |                   0 |

`/fa/products/{slug}` renders the default-locale record together with the notice that the product
has not been translated yet.

### Why Persian cannot be added today

| Content                       | Default locale (`en`)                                                          | Other locales                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`, `slug`, `description` | `products` columns                                                             | `content_translations` can hold them, and the public read already overlays them (`PRODUCT_TRANSLATED_FIELDS`). **No API or editor writes them.** |
| Applications, features, FAQ   | `product_editorial_drafts.published_sections` (one row per product, no locale) | **No storage at all**                                                                                                                            |
| SEO                           | `seo_meta` with `locale = 'en'`                                                | The table is already keyed on `(entity_type, entity_id, locale)`. **The editor only writes the default locale.**                                 |
| Public rendering              | Editorial sections render                                                      | `product-detail-template.tsx` renders editorial sections only when `locale === "en"`                                                             |

The product editor (ADR-024) therefore has no way to author Persian content, and nothing can import
it. Writing to the tables directly from a script would bypass the editor's validation, revision
check and audit trail, which is exactly what ADR-024 forbids.

## Decision

### 1. The default locale is unchanged

`products.name`, `products.description`, `product_editorial_drafts` and the default-locale
`seo_meta` row stay the published projection for the default locale (`Locale.isDefault`). Nothing
existing is migrated, renamed or rewritten.

### 2. Non-default locales get a parallel, additive store

- **Description:** `content_translations` (`entity_type = product`, `field = description`). This is
  the store the public read already consults, so no read path changes for this field.
- **Applications, features and FAQ:** a new table, `product_editorial_localizations`:

  | Column               | Type                                                              | Notes                                                          |
  | -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
  | `product_id`         | uuid, FK → `products.id`, `ON DELETE CASCADE`                     |                                                                |
  | `locale`             | text, FK → `locales.code`, `ON DELETE RESTRICT ON UPDATE CASCADE` | Same referential rule as `seo_meta` and `content_translations` |
  | `revision`           | int, default 0                                                    | Optimistic-concurrency token, as in `product_editorial_drafts` |
  | `content`            | jsonb                                                             | The working draft for that locale                              |
  | `published_sections` | jsonb, nullable                                                   | The published projection for that locale                       |
  | `translation_status` | `translation_status` enum                                         | `machine_draft` or `human_reviewed`                            |
  | `updated_at`         | timestamptz                                                       |                                                                |

  Primary key `(product_id, locale)`. A CHECK constraint, or a trigger if a CHECK cannot reach the
  `locales` table, refuses a row whose locale is the default locale, so the default locale can never
  be stored twice.

- **SEO:** `seo_meta` rows for the non-default locale, written through the existing SEO service.
- **Product names and slugs are not translated by this ADR.** Product names are the approved Latin
  catalogue names and stay identical in every locale. Translated slugs would interact with the
  ADR-011 slug-claim registry and need their own decision.

### 3. Editing and publishing

- The `/admin` product editor gains a locale selector listing the active locales. The default locale
  keeps today's behaviour. A non-default locale edits that locale's description, sections and SEO.
  The product name is shown read-only.
- **Save draft** writes only `product_editorial_localizations.content`. **Publish** writes the
  following in one SERIALIZABLE transaction, then advances the revision and writes the Admin audit
  event `product.published` with the locale in its bounded metadata:
  - the `content_translations` description row
  - `published_sections`
  - the locale's `seo_meta` row
- Permissions stay as ADR-024 set them: Admin and Content Manager may publish ordinary content, and
  technical approval stays Admin-only and untouched.
- **ADR-019 still wins.** Where an approved `product_copy` row exists for a locale, the public
  description is that approved row, exactly as `ProductsService` overlays it today.

### 4. Public read and rendering

- `GET /products/:slug` resolves `editorial` for the requested locale from
  `product_editorial_localizations.published_sections`. If that locale has none, it falls back to
  the default locale and sets `editorialLocale` to the locale actually served. The existing
  `localeFallback` rule is unchanged.
- `apps/web` drops the `locale === "en"` condition. It renders editorial sections whenever they
  exist, and marks fallback content with `lang`/`dir` of the locale served, the pattern already
  verified for Globals (WCAG 2.2 AA 3.1.2).
- `generateMetadata` reads the locale's `seo_meta`. `hreflang` alternates are emitted only for
  locales whose content is `human_reviewed`, as the `hreflang` strategy in `docs/i18n/INTERNATIONALIZATION_STRATEGY.md` requires;
  `machine_draft` content is served but never advertised as an alternate.

### 5. Guarded content import

A CLI, `pnpm catalog:content:import`, loads a reviewed content file in the same shape the editor
submits:

- **Input:** one JSON file. Per product it carries a `slug` and a `sourceRef`; both must match the
  same live row. It also carries one block per locale with `description`, `applications`, `features`,
  `faq`, `seo` and `translationStatus`. Every block is validated with the editor's own DTOs, and
  placeholder markers are refused, before any database connection opens.
- **Safety:**
  - Dry-run is the default.
  - `--apply` additionally requires `SAM_ALLOW_PRODUCT_CONTENT_IMPORT=true`,
    `--confirm-target sam_platform` (checked against `current_database()`) and `--expect-sha256`
    of the input file.
- **Write path:** each product's locale block publishes through the same service method the editor
  uses, in its own SERIALIZABLE transaction. The audit actor is recorded as the import operation
  with the operator label given on the command line. No raw SQL and no bypass of revision checks.
- **Idempotency and overwrite policy:**
  - Content identical to what is published is a no-op.
  - Published content that differs is **refused**, and the product is listed in the report.
  - Overwriting needs an explicit `--replace <slug>` per product, never a global flag.
- **No technical data:** the import never touches specifications, claims, grades, provenance or
  review state.

## Consequences

- Persian content becomes editable in `/admin` and importable in bulk through one audited path.
  Arabic, or any later locale, needs no further code: the locale list stays data (`PROJECT_HANDOFF.md` §6.9).
- One additive migration (a new table, its constraints, and a status column reusing the existing
  enum). No existing row is touched, and the rollback is dropping the new table.
- `content_translations` remains the single store for translated product columns. Editorial
  sections get their own table because they are structured lists, not one text value per field.
- An imported text is labelled `machine_draft` unless the file declares `human_reviewed`. The owner
  decides when a locale counts as reviewed, and `hreflang` follows that decision.

## Alternatives considered

- **Add `locale` to `product_editorial_drafts`.** Rejected: it changes the primary key of a live
  table and the meaning of every existing revision token, for no gain over an additive table.
- **Store sections in `content_translations` as JSON text.** Rejected: `value` is text by design.
  Structured lists in it would escape validation and break the search and overlay code that reads it
  as plain text.
- **Write the database directly from a one-off script.** Rejected: it bypasses ADR-024's validation,
  optimistic concurrency and audit trail.
- **Hold all Persian copy in `product_copy` (ADR-019).** Rejected for editorial sections and SEO:
  `product_copy` carries a summary and a selection note only, and its approval gate demands bound
  source evidence that ordinary editorial content does not have. It remains the path for reviewed
  technical descriptions.

## Implementation gates (each needs its own approval)

1. **Database:** migration for `product_editorial_localizations`.
2. **Backend:** locale-aware editor endpoints, publish transaction, public read and `editorialLocale`.
3. **Frontend:**
   - the `/admin` locale selector
   - public rendering without the `en` gate
   - `generateMetadata` and `hreflang`
4. **Backend:** the `catalog:content:import` CLI and its tests.
5. **Operations:** dry-run on the VPS, then `--apply` by the owner.
