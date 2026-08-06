# Internationalization (i18n) Strategy

Complete i18n architecture for unlimited-language support. This document does not change any frozen decision (ADR-001/002/003, monorepo tooling, database topology, API gateway pattern, CMS boundaries) — it fills in a gap those decisions deliberately left open (see [/AI_CONTEXT.md](../../AI_CONTEXT.md)'s "known open threads"): `next-intl` was already chosen, but no locale strategy existed behind it. This is that strategy.

---

## 0. The core design problem, and how it's resolved

The request to localize "Pages, Products, Product categories, Blog articles, Company information, Documents, Landing pages" spans **both sides of the ADR-002 database split**:

- **Payload-owned** (`sam_cms`): Pages, Company information, Landing Pages (all just `Pages` with a template field — see [DATABASE.md](../DATABASE.md#cms)), Documents (metadata only). These get **Payload's native field-level localization** — no new mechanism needed, Payload already does this.
- **Prisma-owned** (`sam_platform`): Products, Product Categories, Blog Articles. Prisma has **no built-in localization feature** — this document introduces one, in a shape consistent with patterns already established in [DATA_MODEL.md](../DATA_MODEL.md) (the same polymorphic, key/value approach already used by `Specification`, `SeoMeta`, and `StatusHistory`).

Same principle as [docs/seo/SEO_ARCHITECTURE.md §0](../seo/SEO_ARCHITECTURE.md#0-the-core-design-problem-and-how-its-resolved): one consistent *capability* ("this content is localizable"), implemented twice because storage is split, unified at the NestJS layer before `apps/web` ever sees it. `apps/web` never needs to know whether a given piece of localized content came from Payload or Prisma.

---

## 1. URL Strategy

Locale-prefixed routing: `/en/...`, `/fa/...`, `/ar/...`, and any future locale, using `next-intl`'s built-in routing support (this is exactly what it's designed for — no custom routing layer needed).

**Decided** (Architecture approval): default locale is **`en`**; initial supported locales at launch are **`en`, `fa`, `ar`**. All three ship together — see the M3 note in [ROADMAP.md](../ROADMAP.md).

**The locale list is data, not code.** A new `Locale` table (Prisma, `sam_platform` — added in [DATA_MODEL.md](../DATA_MODEL.md)) is the single source of truth: `code`, `name`, `nativeName`, `direction` (`ltr`/`rtl`), `isActive`, `isDefault`, `sortOrder`. Seeded at bootstrap with exactly three rows — `en` (`isDefault: true`, `ltr`), `fa` (`rtl`), `ar` (`rtl`) — Persian and Arabic are both RTL, consistent with §6. **Any locale beyond these three is added through configuration and content only** — a new `Locale` row plus translated content — never a route, middleware, or component change. This is what makes "unlimited future languages" true in practice, not just in principle.

Mechanically: `apps/web`'s `next-intl` routing config is generated from this table at build time (via a NestJS `GET /api/v1/locales` call during the build step — see [API_DESIGN.md](../API_DESIGN.md)). A new locale requires a rebuild (to regenerate static routes and pull in the new translated content) but genuinely **zero code changes** — this satisfies "no major code refactoring" honestly: content and a database row are configuration; nothing in `apps/web`, `apps/api`, or `apps/cms` source changes.

This is also why the architecture is "allow adding new languages without changing the application structure": every mechanism below (routing, Payload localization, Prisma translation table, hreflang generation, sitemap) reads the active locale list dynamically — none of them hardcode `en`/`fa`/`ar` as a fixed set.

---

## 2. Frontend Internationalization (next-intl)

### Locale routing
`next-intl`'s middleware-based routing, locale segment as the first URL path part. Unprefixed paths (`/`) redirect to the resolved locale (§ Language detection).

### Language detection
Priority order, standard and predictable:
1. Explicit locale already in the URL (source of truth once present).
2. `NEXT_LOCALE` cookie (a returning visitor's last explicit choice).
3. `Accept-Language` header, matched against the active locale list from the `Locale` table.
4. Fall back to the default locale, **`en`**.

### Language switching
A switcher component changes the locale segment **and** resolves to that locale's own translated slug for the current entity — not a naive string-replace of the locale prefix. Because slugs are localized (§3), `/en/products/base-oil` switching to Arabic must resolve to `/ar/products/<arabic-slug>`, which requires looking up the equivalent translation via the entity's shared `entityId`, not assuming the slug string carries over. If a translation doesn't exist yet for the target locale, fall back to that locale's home page (or the nearest translated ancestor page) rather than 404ing.

### Translation management
Two separate systems, deliberately not merged (see §5's Content Rules):
- **UI chrome / static system text** (button labels, form field labels, validation messages, navigation labels) — `next-intl` JSON message catalogs, one file per locale, colocated with the components that use them per [CODING_STANDARDS.md](../CODING_STANDARDS.md).
- **Business content** (page copy, product names/descriptions, blog posts) — Payload's localized fields or Prisma's `ContentTranslation` table (§3), edited through the CMS/admin UI, not through message catalog files. A translator or content editor should never need to touch `apps/web`'s source code to translate business content.

### LTR/RTL support
See §7 for the full direction/layout/typography strategy. At the routing level: `Locale.direction` drives the `<html dir="...">` attribute per locale, set at the root layout based on the active locale segment.

### Middleware strategy
`next-intl`'s middleware handles locale detection/redirection (§ above) and runs before the `Redirect` lookup already defined in [docs/seo/SEO_ARCHITECTURE.md §2](../seo/SEO_ARCHITECTURE.md#redirect-management) — so a locale-aware redirect and a slug-changed redirect can both apply to the same request without conflicting. Order: resolve locale first, then check redirects within that locale.

### SEO integration
See §4 — this is where `hreflang`, localized sitemaps, and localized metadata actually get generated from everything above.

---

## 3. Content Localization

### Payload CMS (Pages, Company Information, Landing Pages, Documents metadata)

Payload's native localization feature handles this directly:
- The active locale list (from the `Locale` table, §1) feeds Payload's `localization` config (`locales`, `defaultLocale`, `fallback: true`).
- Individual fields on the `Pages` collection (title, body content, SEO fields per [docs/seo/SEO_ARCHITECTURE.md §3](../seo/SEO_ARCHITECTURE.md#3-payload-cms-seo-architecture)) are marked `localized: true`.
- **One content model, localized fields — no per-language collections**, exactly as required. Adding a locale to Payload means adding it to the `locales` array (driven by the `Locale` table) — the collection schema itself doesn't change.
- Fallback behavior (`fallback: true`) means an untranslated field in a given locale shows the default locale's value rather than rendering empty — consistent with the fallback philosophy already established in [docs/seo/SEO_ARCHITECTURE.md §11](../seo/SEO_ARCHITECTURE.md#11-extensibility--validation-rules).

### Prisma (Products, Product Categories, Blog Articles)

These are **not** Payload content — per [ARCHITECTURE.md](../ARCHITECTURE.md#modules-modular-monolith-boundaries) the Catalog and Blog modules own this data in `sam_platform`. Prisma has no built-in localization, so this document introduces `ContentTranslation`:

```
CONTENT_TRANSLATION {
  string id
  string entityType       // "Product" | "Category" | "BlogPost"
  string entityId
  string locale
  string field             // "name" | "slug" | "description" | "title" | "content"
  text   value
  string translationStatus // "machine_draft" | "human_reviewed" — see Translation Workflow below
}
```

- The base entity's own field (`Product.name`, `Product.slug`, `Product.description`, etc.) holds the **default locale's** value directly — no special-casing, no empty default row.
- Every other locale's value for that field is a row in `ContentTranslation`, keyed by `entityType` + `entityId` + `locale` + `field`.
- This mirrors the key/value shape `Specification` already uses ([DATA_MODEL.md](../DATA_MODEL.md)) and the polymorphic `entityType`/`entityId` shape `SeoMeta` and `StatusHistory` already use — no new architectural *pattern*, just one more application of a pattern this project already relies on.
- **Localized slugs**: a translated product needs its own human-readable, translated URL, not the default locale's slug reused — `field: "slug"` rows in `ContentTranslation` carry this per locale, resolved by the NestJS Catalog/Blog modules before `apps/web` ever sees a URL.
- Adding a locale here means inserting `ContentTranslation` rows (content translation work) — again, no schema change, no code change.

### Why not one shared mechanism for both

Because ADR-002 already made Prisma and Payload physically separate databases — the same reason [docs/seo/SEO_ARCHITECTURE.md §0](../seo/SEO_ARCHITECTURE.md#0-the-core-design-problem-and-how-its-resolved) gives for SEO. Fighting that split to force one storage mechanism would mean re-opening ADR-002, which is out of scope here and unnecessary — both mechanisms achieve the same *capability* (field-level localization, one content model, no per-language duplication) independently.

### Translation Workflow

**Decided: hybrid.** Machine-assisted drafts are allowed everywhere, but human review is required before publish for content where an inaccurate translation carries real business or safety risk.

| Content | Machine-assisted draft OK? | Human review required before publish? |
|---|---|---|
| Product specifications & technical data | Yes, as a starting draft | **Yes** — technical/safety accuracy matters (viscosity, compatibility, certifications) |
| Company Information, About Us, legal/compliance content, Contact Us | Yes, as a starting draft | **Yes** — brand voice and factual commitments |
| Custom Product Request / Inquiry form labels & CMS UI copy on those pages | Yes, as a starting draft | **Yes** — these drive real sales leads; a mistranslated form field can lose a lead |
| Blog articles, general marketing copy | Yes | Recommended, not required — may publish machine-assisted and get reviewed opportunistically |
| UI chrome (buttons, nav, system messages) | Yes | Recommended, not required — low individual risk, high volume |

Mechanically:
- **Prisma-owned content**: `ContentTranslation.translationStatus` (`machine_draft` | `human_reviewed`) tracks this per field, per locale. A status change is logged via `StatusHistory` (already the generic, polymorphic status-audit entity in [DATA_MODEL.md](../DATA_MODEL.md) — no new audit mechanism needed) so there's a record of who reviewed what and when.
- **Payload-owned content**: Payload's existing draft/publish versioning is the natural home for this — a machine-assisted translation is saved as a draft in that locale and stays unpublished until a human reviews and publishes it. No new field needed; this reuses a Payload feature already implied by using Payload at all.
- The table above is a starting policy, not a hard schema constraint — an editor can still choose to human-review low-risk content or (with the `machine_draft` status visibly flagged in the CMS/admin UI) leave the two required-review categories unpublished until reviewed. The system tracks status; it doesn't block publishing on its own, since that's an editorial workflow decision, not an architectural one.

---

## 4. SEO Localization

Concretizes [docs/seo/SEO_ARCHITECTURE.md §5](../seo/SEO_ARCHITECTURE.md#5-international--multilingual-seo), which was written locale-count-agnostic before this strategy existed:

- **Every language has independent SEO data** — `SeoMeta.locale` (Prisma side) and Payload's localized SEO field group already carry meta title/description/slug/OG/structured data/canonical per locale (no change needed there; that mechanism was already built for this in the SEO Architecture pass).
- **`hreflang` strategy**: for a given entity, collect every locale it has a real translation for (a `ContentTranslation`/Payload-localized-field row exists, not just a stub), emit one `<link rel="alternate" hreflang>` per locale plus `x-default` pointing at the default locale's URL. Locales without a translation are omitted, not linked to an empty/fallback page — a broken or thin `hreflang` target is worse than no alternate at all.
- **Localized sitemap**: `GET /api/v1/seo/sitemap-entries` (already defined in [API_DESIGN.md](../API_DESIGN.md)) returns one entry per entity **per locale it's actually translated into**, each with its own localized path — not one URL per entity with a locale switcher bolted on.
- **Localized metadata**: flows automatically from §3 — `apps/web`'s `generateMetadata` requests content in the current route's locale, and the normalized `SeoFields` shape it gets back is already that locale's data.

---

## 5. Content Rules

**Do not hardcode user-facing text inside components.** Two correct destinations for text, never a third (inline strings):

| Kind of text | Lives in | Example |
|---|---|---|
| UI chrome (buttons, labels, validation/error messages, nav) | `next-intl` message catalogs | "Submit Inquiry", "Required field" |
| Business content (page copy, product info, blog posts) | Payload localized fields / Prisma `ContentTranslation` | Product descriptions, page body copy |

This is added as an explicit rule in [CODING_STANDARDS.md](../CODING_STANDARDS.md). A code reviewer should treat any literal user-facing string in a component as a defect, not a style nitpick — once i18n is adopted, an un-keyed string is a string that silently never gets translated.

---

## 6. RTL/LTR Support

Required now: **Persian, Arabic** (RTL) alongside **English** (LTR), plus unlimited future languages in either direction (`Locale.direction` per §1 makes this a data property, not a hardcoded LTR/RTL branch per language).

### Direction handling
- `<html dir="rtl">`/`dir="ltr"` set at the root layout from the active locale's `Locale.direction`.
- Tailwind's logical properties (`ms-`/`me-`/`ps-`/`pe-` instead of `ml-`/`mr-`/`pl-`/`pr-`) throughout — this is the mechanism that makes a component correct in both directions without a separate RTL stylesheet or per-component direction branching, consistent with [CODING_STANDARDS.md](../CODING_STANDARDS.md)'s existing Tailwind conventions.

### Layout compatibility
- Icons/illustrations that are inherently directional (arrows, the step-sequence chevrons already used in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)'s process sections) need an RTL-mirrored variant, not just a flipped container.
- Animation: GSAP/Framer Motion transforms (`translateX`, rotation) do not auto-mirror for RTL — every directional animation (per [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md)'s Animation section) needs explicit direction-aware sign-flipping. This was already flagged as a risk during the frontend design-direction review; this document is where it gets a concrete owner (the animation implementation, gated by `Locale.direction`, not a guess at implementation time).
- Maps (Mapbox, per [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md)) don't mirror — that's expected and correct; only surrounding UI chrome mirrors, not the map itself.

### Typography considerations
`docs/design/FRONTEND_DESIGN_DIRECTION.md`'s chosen typefaces (Inter, Neue Haas Grotesk style, Helvetica Neue style) **have no Arabic or Persian glyph coverage** — already flagged during the design-direction review, restated here because it's now a hard blocker for the RTL requirement, not a hypothetical one. A distinct, genuinely Arabic/Persian-capable typeface pairing is needed for RTL locales (e.g. a geometric-grotesque Arabic/Persian face that reads as the same brand register as the Latin typefaces — candidates like Vazirmatn for Persian or IBM Plex Sans Arabic for Arabic are reasonable starting points to evaluate, not a final pick). **This needs design-team confirmation** — see remaining decisions.

---

## 7. Scalability — Adding a New Language

The complete checklist for adding a language, by design containing zero source-code changes:

1. Insert a row in the `Locale` table (code, name, nativeName, direction, `isActive: true`).
2. Add the locale to Payload's `locales` config (driven by the same table — see §3).
3. Translate business content: Payload localized fields for Pages/Company Info/Landing Pages; `ContentTranslation` rows for Products/Categories/Blog Articles — machine-assisted drafts allowed, human review required for the categories listed in Translation Workflow above before publish.
4. Translate UI chrome: add the new locale's message catalog file for `next-intl`.
5. Populate `SeoMeta`/Payload SEO fields for the new locale (per [docs/seo/SEO_ARCHITECTURE.md](../seo/SEO_ARCHITECTURE.md)).
6. Rebuild/redeploy `apps/web` so the new locale's static routes and message catalog are included.

Steps 1–5 are content and configuration. Step 6 is a routine deploy, not a refactor — no component, route, or business-logic file changes for any of this.

---

## Decisions Log

Resolved at Architecture approval:

1. **Default locale: `en`.**
2. **Initial locale rollout: `en`, `fa`, `ar`, all three at Phase 1 launch** (not a phased rollout).
3. **Future locales: configuration + content only** — a `Locale` row plus translated content, never a code change (§1, §7).
4. **Translation workflow: hybrid** — machine-assisted drafts allowed everywhere; human review required before publish for product specifications, company/legal/contact content, and lead-generating form copy (see Translation Workflow above for the full policy and `translationStatus` tracking).

## Remaining Decisions

Only one item is still open — tracked in [/AI_CONTEXT.md](../../AI_CONTEXT.md):

1. **RTL typeface pairing.** Needs design-team sign-off against `docs/design/FRONTEND_DESIGN_DIRECTION.md` — this document only flags the gap (chosen Latin typefaces have no Arabic/Persian glyph coverage) and proposes candidates (§6), not a final pick.
