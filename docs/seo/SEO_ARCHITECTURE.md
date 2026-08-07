# SEO Architecture

This document is the SEO strategy and framework for the whole platform. It does not redefine field-level schema or API conventions already documented elsewhere — it links to them and focuses on the parts that didn't exist yet: the reusable SEO model, how Next.js consumes it, and the international/AI-readiness strategy layered on top. No frozen architecture decision (ADR-001/002/003, monorepo tooling, database topology, API gateway pattern, CMS boundaries) is changed by anything below.

---

## 0. The core design problem, and how it's resolved

SEO must be "a reusable feature, not isolated fields," attachable to any current or future content type. But two frozen decisions shape how that has to work here:

- **ADR-002**: Prisma-owned content (`Product`, `Category`, `BlogPost`) and Payload-owned content (`Pages`, `Menus`, `Footer`, `Settings`) live in **two physically separate databases** (`sam_platform`, `sam_cms`). There is no SQL-level way to share one literal table between them.
- **ADR-003**: NestJS is the only API surface `apps/web` talks to; it already normalizes Payload's shape into the platform's own response envelope.

So "one centralized reusable SEO architecture" cannot mean one shared database table — that would require merging the databases, which is off the table. It means **one shared SEO _contract_** (the same field names and shape), implemented twice, unified at the point ADR-003 already unifies everything else:

```
Prisma SeoMeta table  ──┐
 (Product, Category,    │
  BlogPost)              ├──▶  NestJS SEO module  ──▶  one normalized SEO shape  ──▶  apps/web
Payload seo field group ┘        (packages/types)
 (Pages, Settings, and
  any future collection)
```

- **`packages/types`** defines the canonical `SeoFields` TypeScript shape once (per [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)'s existing purpose for that package — no new package needed).
- **Prisma** implements it as the `SeoMeta` polymorphic table (already exists in [DATA_MODEL.md](../DATA_MODEL.md); expanded below) for every Prisma-owned content entity.
- **Payload** implements it as a single reusable field-group function (e.g. `seoFields()`) spread into every collection/global that needs it, so the fields are defined once and reused, not copy-pasted per collection.
- **NestJS's existing SEO module** (already named in [ARCHITECTURE.md](../ARCHITECTURE.md#modules-modular-monolith-boundaries)) is the seam that normalizes both sources into the one shape `apps/web` consumes — the frontend never knows or cares which database a given page's SEO data came from.

This is the answer to "design as a reusable feature, not isolated fields": reusable at the _contract_ level (one shape, one set of validation/fallback rules, defined once per runtime), correctly implemented twice at the _storage_ level because the frozen database split makes one implementation impossible.

---

## 1. SEO Strategy

### Technical SEO

- Server-rendered HTML for all indexable pages (Next.js App Router Server Components — already the frozen frontend choice, see [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md)).
- Clean, stable URLs: `Product.slug`, `Category.slug`, `BlogPost.slug` already exist in [DATA_MODEL.md](../DATA_MODEL.md); Payload `Pages` get their own slug field.
- `sitemap.xml`, `robots.txt`, canonical URLs, redirect management — see §3 and §7.
- No duplicate-content surfaces from filtering/pagination — see §7's canonical strategy.

### On-page SEO

- Every indexable entity carries the shared `SeoFields` contract (§0): meta title/description, canonical, OG, Twitter Card, robots directives.
- Fallback chain when a page-level value is missing (§8) — never ship an empty `<title>` or missing meta description.
- Semantic HTML structure (heading hierarchy, landmark regions) enforced as a coding standard, not a per-page decision — see [CODING_STANDARDS.md](../CODING_STANDARDS.md).

### International SEO

- Full strategy in §5. Summary: locale-prefixed routes via `next-intl`, `hreflang` alternates generated from whatever locale list is eventually confirmed, language-aware canonical URLs.
- **The target locale list itself is still an open decision** (tracked in [/AI_CONTEXT.md](../../AI_CONTEXT.md)) — this architecture is locale-count-agnostic by design so that decision doesn't block building it.

### Multilingual SEO

- Localized metadata, localized slugs (not just localized copy behind the same slug — a translated page needs its own crawlable, human-readable URL per locale), localized OG images where the image itself contains text, localized structured data (`inLanguage` property).

### Performance SEO

- Full detail in §6. Summary: Core Web Vitals budget, image optimization, font loading strategy, and a specific discipline around the animation/3D/map-heavy frontend direction (see [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md)) not being allowed to regress LCP/INP.

### Image SEO

- `next/image` for all rendered images (already implied by the Next.js choice).
- Every `Media` record ([DATA_MODEL.md](../DATA_MODEL.md)) needs descriptive alt text — add `altText` to the `Media` entity (§2).
- Social/OG images sized per platform convention (1200×630) — stored as their own field on `SeoFields`, not reused ad hoc from a content image, so OG previews don't break when a hero image changes.

### Product SEO

- `Product` schema.org markup (§8) sourced directly from `Product` + `Specification` — the existing key/value specification model ([DATA_MODEL.md](../DATA_MODEL.md)) maps cleanly onto `additionalProperty` in the Product schema without new fields.
- Category and product-detail pages get `BreadcrumbList` markup reflecting the category hierarchy (`Category.parentId` is already self-referencing).
- Canonical handling for filtered/sorted category views — see §7.

### Blog SEO

- `Article` schema.org markup per `BlogPost`. Category/tag pages act as topic hubs; internal linking between related posts and the products they mention is a content-authoring practice, not a schema requirement.

### Local SEO

- **Not applicable in the traditional sense.** Sam Group is a B2B manufacturer/exporter with no walk-in retail presence — `LocalBusiness` schema and "near me" local-pack optimization target a different business model and would send mismatched signals if applied here. The real analog for this business is **International/Export SEO** (§5), which is where the effort belongs instead. If Sam Group's factory/office has a genuine public-facing address worth surfacing (e.g. for Google Business Profile or the `Organization` schema's `address` property), that's a lightweight addition to `Organization` markup, not a `LocalBusiness` implementation.

### AI Search / LLM Readiness

- Full detail in §9.

### Future Scalability

- Every point above is designed to attach to "any current or future content type" via the shared contract in §0 — a future module (Customer Portal, CRM-facing content, etc.) that needs SEO just implements `SeoFields` on its own entity or Payload collection; nothing in the SEO module itself needs to change. See §4's extensibility rules.

---

## 2. Reusable SEO Model — Field Contract

The canonical shape (lives in `packages/types`, implemented by both Prisma's `SeoMeta` and Payload's `seoFields()`):

| Field                                                     | Type                                    | Notes                                                                                                                             |
| --------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `metaTitle`                                               | string                                  | Falls back per §8 if empty                                                                                                        |
| `metaDescription`                                         | string                                  | Falls back per §8 if empty                                                                                                        |
| `canonicalUrl`                                            | string                                  | Falls back to the entity's own resolved URL if empty                                                                              |
| `ogTitle` / `ogDescription` / `ogImageUrl`                | string                                  | Falls back to `metaTitle`/`metaDescription`/a default social image if empty                                                       |
| `twitterCardType`                                         | enum (`summary`, `summary_large_image`) | Default `summary_large_image`                                                                                                     |
| `twitterTitle` / `twitterDescription` / `twitterImageUrl` | string                                  | Falls back to the OG equivalents if empty                                                                                         |
| `robotsIndex` / `robotsFollow`                            | boolean                                 | Default `true`/`true`; set `false` to `noindex`/`nofollow` a specific entity                                                      |
| `keywords`                                                | string[]                                | Optional, low SEO weight in modern search — kept for internal content-planning use, not relied on for ranking                     |
| `structuredDataOverride`                                  | JSON (nullable)                         | Manual JSON-LD override for cases the automatic per-type generation (§8) doesn't cover; null means "use the automatic generation" |
| `socialImageId`                                           | reference to `Media`                    | Distinct from the content's hero image — see Image SEO above                                                                      |
| `locale`                                                  | string                                  | Which locale this SEO record belongs to — see §5                                                                                  |

This is additive to the `SeoMeta` entity already in [DATA_MODEL.md](../DATA_MODEL.md), not a replacement — see that document's own changelog for the exact diff.

### Redirect Management

A new `Redirect` entity (Prisma, `sam_platform`): `fromPath`, `toPath`, `statusCode` (301/302), `locale` (nullable — locale-specific or global), `isActive`, `createdAt`. Consumed by Next.js middleware (checked before rendering) so that a slug change (product renamed, blog post URL restructured) never produces a dead link or loses accumulated search equity. Detailed in [DATA_MODEL.md](../DATA_MODEL.md).

---

## 3. Payload CMS SEO Architecture

**Authoritative content model:** [docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md](../content/PAYLOAD_CONTENT_ARCHITECTURE.md). That document's page-ownership model is approved and supersedes an earlier assumption in this section (recorded below). This section covers only how SEO attaches to it.

### Page ownership model (approved)

- **Bespoke company/brand pages are Payload Globals** — Home, About Us, Products Landing, Customized Solutions, Export & Logistics, Quality & Certifications, Contact Us. One instance each, each with its own tailored field schema.
- **Legal pages use the `Pages` collection** — Privacy Policy, Terms of Use, Cookie Notice, General Sales Conditions. These are genuinely interchangeable in shape (title + rich text + last-updated date) and open-ended in count, which is what justifies a collection.
- **No generic page builder, no catch-all page collection.** This mirrors the frontend's own approved decision ([FRONTEND_ARCHITECTURE.md §1](../frontend/FRONTEND_ARCHITECTURE.md#1-next-js-app-router-structure) — no `[...slug]` route, no block-renderer): layout is code, editorial content is CMS.

_Superseded assumption, recorded for traceability:_ an earlier draft of this section proposed that "Company Pages" and "Landing Pages" be `Pages` collection entries distinguished by a `pageType`/template field. That was written before the full site structure existed and would have fought the frontend's bespoke-page decision. Globals-per-bespoke-page is the approved model.

### SEO metadata ownership follows the content owner

The rule, stated once and applied everywhere: **whichever system owns a piece of content owns its SEO record.** No SEO data is duplicated across the ADR-002 database split.

| Content                                                             | Owner                              | SEO mechanism                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bespoke company/brand pages (7 Globals)                             | Payload                            | `seoFields()` group on each Global                                                                                                                                                                                                     |
| Legal pages                                                         | Payload                            | `seoFields()` group on the `Pages` collection                                                                                                                                                                                          |
| Product category page editorial copy                                | Payload (`ProductCategoryContent`) | `seoFields()` group per entry — the SEO record for the category _page_                                                                                                                                                                 |
| Products, Categories, Specifications                                | Prisma                             | `SeoMeta` table (§0)                                                                                                                                                                                                                   |
| Blog posts / Insights                                               | Prisma                             | `SeoMeta` table (§0) — Payload holds no blog content and no blog SEO                                                                                                                                                                   |
| `Settings` (Payload Global)                                         | Payload                            | Site-wide _defaults_ only — the §11 fallback source (default OG image, meta description suffix, `Organization` schema data), never a per-page record                                                                                   |
| `Header`, `Footer` (Payload Globals)                                | Payload                            | None — site chrome, not independently indexable                                                                                                                                                                                        |
| `FaqEntries`, `Certifications`, `JobOpenings` (Payload collections) | Payload                            | None per-entry — referenced content, surfaced within a page that has its own SEO record. `JobOpenings` may take a basic `seoFields()` group if individual job listings ever need to be independently indexable; not required at launch |

Both halves — Payload's `seoFields()` group and Prisma's `SeoMeta` table — satisfy the identical `SeoFields` contract defined in §2, and NestJS normalizes them into one shape before `apps/web` sees either. That's §0's core design, applied to page ownership.

**On `Documents`/`Downloads`**: not pages, so no full `SeoFields` record individually. Product-specific technical documents (TDS/SDS/COA) are Prisma `Media`; company-wide assets (catalogue, company profile PDFs) are Payload uploads attached to the Global that offers them. Either way, the individual files need indexability control (§6) but not a meta title/description/OG set. If a "Downloads" _listing page_ is ever added, that's a new Global or `Pages` entry, inheriting SEO normally.

**Future collections**: because `seoFields()` is a shared function, not per-collection boilerplate, any future Payload collection or Global adopts the same SEO capability by spreading it into its field array — no redesign of the SEO system itself.

---

## 4. Next.js SEO Consumption

- **Metadata API**: every route uses Next.js's `generateMetadata` (dynamic) rather than static `export const metadata` for any route backed by data (products, categories, blog posts, CMS pages) — the metadata always comes from the normalized SEO shape (§0) returned by NestJS.
- **`sitemap.xml`**: implemented via Next.js's `sitemap.ts` convention, which calls a NestJS endpoint (§ below) that returns every indexable URL with `lastModified`, split by locale once locales exist.
- **`robots.txt`**: implemented via Next.js's `robots.ts` convention, explicitly disallowing non-indexable paths (auth-gated routes, internal admin paths). There is no staging environment to gate on — one VPS serves production only ([ADR-005](../ADR/ADR-005-vps-docker-deployment.md), approved implementation decision 6) — so the CMS admin is kept out of the index at the Nginx layer instead, via the `X-Robots-Tag` on `cms.samgp.com`.
- **Canonical URLs**: rendered from `SeoFields.canonicalUrl`, always an absolute URL, always pointing at the clean/unfiltered version of a list page (§7).
- **`hreflang`**: rendered as `<link rel="alternate" hreflang="...">` tags, one per locale the entity has a translation for, generated from whichever locales are confirmed (§5) — the templating logic doesn't hardcode a locale count.
- **Open Graph / Twitter Cards**: rendered via the Metadata API's `openGraph`/`twitter` fields, sourced from `SeoFields`.
- **JSON-LD**: rendered as a `<script type="application/ld+json">` in each page, generated per the type table in §8 (automatic) or from `structuredDataOverride` when set (§2).
- **Breadcrumbs**: rendered as real, crawlable HTML navigation (not JS-only) _and_ as `BreadcrumbList` JSON-LD — the visual component and the structured data are two views of the same breadcrumb data, never diverging.
- **Pagination**: list pages (product category, blog index) use `?page=` query params per [API_DESIGN.md](../API_DESIGN.md)'s existing convention; paginated pages beyond page 1 get a canonical pointing at themselves (not collapsed onto page 1, which would hide real content from search) but are excluded from `sitemap.xml` beyond a reasonable depth to avoid crawl-budget waste on deep pagination.
- **Dynamic routes**: `[slug]` routes for products/categories/blog posts resolve their SEO data server-side before render, so a 404/redirect (§2's `Redirect` entity) can be resolved before any HTML ships, not client-side after a flash of not-found content.

---

## 5. International & Multilingual SEO

**Superseded by [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md), which is now authoritative on this topic.** This section originally described the mechanism in locale-count-agnostic, still-to-be-designed terms; the full i18n strategy pass made it concrete. Summary (see that document for detail):

- **Routing**: locale-prefixed paths via `next-intl` (e.g. `/en/products/...`, `/ar/products/...`), with the active locale list sourced from a `Locale` table rather than hardcoded — [§1](../i18n/INTERNATIONALIZATION_STRATEGY.md#1-url-strategy).
- **`hreflang`**, **localized metadata**, **localized slugs**, **localized structured data**, and **language-aware canonical URLs** — all confirmed and detailed in [§4 of the i18n strategy](../i18n/INTERNATIONALIZATION_STRATEGY.md#4-seo-localization), which builds directly on `SeoFields`' existing `locale` scoping (§2 above).
- **RTL/LTR compatibility**: full direction/layout/typography strategy, including the Arabic/Persian typeface gap in `docs/design/FRONTEND_DESIGN_DIRECTION.md`, now lives in [§6 of the i18n strategy](../i18n/INTERNATIONALIZATION_STRATEGY.md#6-rtl-ltr-support).

**Decided**: default locale `en`; launch locales `en`/`fa`/`ar` together; translation workflow is hybrid (machine-draft + human review for business-critical content). **What's still open**: RTL typeface pairing only — see the i18n strategy's "Remaining Decisions" and [/AI_CONTEXT.md](../../AI_CONTEXT.md).

---

## 6. Performance SEO

- **Core Web Vitals budget** (none existed before this document): LCP < 2.5s, INP < 200ms, CLS < 0.1 on 4G/mid-tier-mobile simulated conditions — these are the actual Google ranking-relevant thresholds, and should be treated as a build gate, not an aspiration.
- **Image optimization**: `next/image` everywhere, real width/height to avoid layout shift, modern formats (AVIF/WebP with fallback).
- **Lazy loading**: below-the-fold sections (per [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md)'s 3D/map-heavy components) are dynamically imported and mounted only when scrolled into view — already recommended in [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md) for exactly this reason.
- **Font optimization**: `next/font` for self-hosted webfonts (no render-blocking third-party font requests), subset to the glyphs actually needed per locale (Latin subset for English-only pages; a separate Arabic-capable font load only on Arabic-locale pages, not bundled into every page's initial load).
- **Streaming**: React Server Components + Suspense boundaries so slow-to-fetch sections (CMS content requiring a NestJS→Payload round trip) don't block the whole page's first paint.
- **Caching**: NestJS's Content module (already responsible for proxying Payload per ADR-003) caches CMS-backed content aggressively since it changes infrequently; product/catalog data cached with shorter TTLs; cache invalidated on publish/update rather than relying purely on TTL expiry.
- **Static/ISR rendering at the origin**: marketing pages and published blog posts render statically or via ISR and are served by the `web` container behind Nginx; anything requiring per-request personalization (logged-in customer views) renders per request. The platform deploys entirely to one Linux VPS with no third-party edge/CDN tier (per [technology/FRONTEND_STACK.md §Deployment](../technology/FRONTEND_STACK.md#deployment) and [DEVOPS.md](../DEVOPS.md)), so the budget above is met through Nginx cache headers, image optimization, and VPS proximity to primary markets rather than through global edge distribution. If measurement shows the budget is hard to hit, adding a CDN in front of Nginx is available as a later, separate decision.

---

## 7. Canonical Strategy for Filtered & Paginated Views

A gap in [API_DESIGN.md](../API_DESIGN.md)'s existing filtering/pagination convention (`?category=...&sort=...&page=...`) that this document closes: every combination of filter/sort query params is technically a distinct URL, which without a rule creates duplicate-content risk (many URLs, near-identical content). Rule adopted:

- The canonical URL for any filtered/sorted list view always points at the clean, unfiltered, page-1 URL for that list.
- Query-parameter combinations are not individually submitted to `sitemap.xml` — only the canonical, unfiltered list URLs are.
- Deep pagination (beyond a reasonable page count) gets `noindex` via `robotsIndex: false` while remaining `follow`-able, so link equity still flows through without every deep page competing for index space.

---

## 8. Structured Data (Schema.org)

| Type             | Applied to                                                                                                                                                                                                                                                                                                                                               | Sourced from                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Organization`   | Global (root layout / every page via JSON-LD)                                                                                                                                                                                                                                                                                                            | Payload `Settings` global                                                                                                           |
| `WebSite`        | Global                                                                                                                                                                                                                                                                                                                                                   | Payload `Settings` global                                                                                                           |
| `WebPage`        | Base type for any page without a more specific type below                                                                                                                                                                                                                                                                                                | Generic — current page's `SeoFields`                                                                                                |
| `Product`        | Product detail pages                                                                                                                                                                                                                                                                                                                                     | `Product` + `Specification` (mapped to `additionalProperty`)                                                                        |
| `Article`        | Blog post detail pages                                                                                                                                                                                                                                                                                                                                   | `BlogPost`                                                                                                                          |
| `BreadcrumbList` | Every page with a real hierarchy (products, categories, blog)                                                                                                                                                                                                                                                                                            | Derived from route structure + `Category.parentId`                                                                                  |
| `ContactPage`    | Contact Us page                                                                                                                                                                                                                                                                                                                                          | Static + `Settings` contact info                                                                                                    |
| `FAQPage`        | **Now applicable** — the dedicated `/faq` page _and_ each of the six product category pages, per [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master). (An earlier draft of this table marked it not-applicable, correctly at the time — no FAQ content existed in the then-current site structure. The "Completed" structure document added it.) | `FaqEntries` Payload collection — one shared source, filtered per page, so a category page's FAQ block and `/faq` never drift apart |
| `LocalBusiness`  | **Recommended against** — see §1's Local SEO reasoning. `Organization` (with an `address` property if a real facility address should be public) covers the legitimate need without the mismatched local-business signal.                                                                                                                                 | —                                                                                                                                   |

`structuredDataOverride` (§2) exists for any case not covered by automatic generation above, so the system doesn't need a new schema type wired in for every one-off.

---

## 9. AI Search / LLM Readiness

Modern AI assistants and answer engines (and Google's own AI-driven results) favor content that's structurally extractable, not just keyword-optimized. This is about _external_ AI systems reading the public site — a related but distinct concern from [docs/ai/RAG_ARCHITECTURE.md](../ai/RAG_ARCHITECTURE.md), which is the platform's _own_ future AI/retrieval capability built on its own content. The same structural insight (favor structured facts over prose) benefits both.

- **Structured content over marketing prose where it counts**: `Specification`'s existing key/value model ([DATA_MODEL.md](../DATA_MODEL.md)) is already close to ideal for this — a fact like "Viscosity Index: 120" is directly machine-extractable in a way a sentence burying the same fact in marketing copy isn't. Favor structured fields over prose for anything genuinely factual (specs, certifications, capacity figures).
- **Semantic HTML**: real heading hierarchy, `<nav>`/`<main>`/`<article>` landmarks — already a coding-standard-level requirement (§1), reinforced here because AI crawlers rely on the same semantic signals search engines do, often with less tolerance for div-soup than a human reader has.
- **JSON-LD as the machine-readable source of truth**: every page's JSON-LD (§8) should be internally consistent with its visible content — AI systems increasingly cross-check structured data against rendered text, and a mismatch (common when JSON-LD is hand-maintained separately from content) is worse than having no structured data at all.
- **Entity-based content**: consistent naming of the same entity (Sam Group as `Organization`, each product by a stable name/slug) across every page it appears on, rather than varying phrasing — this is what lets an AI system build a coherent "entity" for Sam Group and its products rather than treating each mention as unrelated text.
- **AI-friendly metadata**: accurate, specific meta descriptions (not generic boilerplate repeated across pages) — AI summarization tools lean on this exactly as search snippets do.
- **Machine-readable organization**: the site's own information architecture ([SITE_STRUCTURE.md](../SITE_STRUCTURE.md)) — clear category → product hierarchy, consistent breadcrumbs — doubles as the structure an AI system uses to understand what the business actually offers, so keeping that hierarchy clean in the UI is itself an AI-readiness measure, not just a UX one.

---

## 10. Content Strategy — SEO Requirements by Content Type

| Content type                                                                                                          | Required SEO elements                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products                                                                                                              | `Product` JSON-LD, specification-rich body content, category breadcrumb, canonical (§7), locale-scoped metadata                                                                                                                                                           |
| Product Categories                                                                                                    | `BreadcrumbList`, canonical to clean URL (§7), paginated-listing rules (§7)                                                                                                                                                                                               |
| Blog Articles                                                                                                         | `Article` JSON-LD, category/tag internal linking, author attribution, `publishedAt`/`updatedAt` in structured data                                                                                                                                                        |
| Company/brand pages (About Us, Export & Logistics, Quality & Certifications, etc. — each a Payload **Global** per §3) | `WebPage`/`AboutPage`/`Service` as applicable per [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master), `Organization` reference, standard `SeoFields` on the Global itself                                                                                        |
| Legal pages (Payload `Pages` **collection** per §3)                                                                   | `WebPage`, standard `SeoFields`; typically `robotsIndex: true` but low-priority — no keyword targeting expected                                                                                                                                                           |
| Contact Pages                                                                                                         | `ContactPage` JSON-LD, `Organization` contact-point data                                                                                                                                                                                                                  |
| Documents/Downloads                                                                                                   | Indexability decision per file (§3) — technical spec sheets meant for gated/qualified leads should be `robotsIndex: false` even if the page listing them is indexable, consistent with [SECURITY.md](../SECURITY.md)'s existing access-control note on confidential media |
| Future modules                                                                                                        | Inherit `SeoFields` per §0/§4 — no bespoke SEO work required to onboard a new content type                                                                                                                                                                                |

---

## 11. Extensibility & Validation Rules

- **Inheritance**: any Prisma entity gets SEO by adding a `SeoMeta` relation (already the pattern for `Product`/`BlogPost`); any Payload collection gets SEO by spreading `seoFields()` into its field array. No other integration point exists, so there's exactly one way to do this, not several inconsistent ones.
- **Validation**: `metaTitle` and `metaDescription` have soft length warnings (title ~60 chars, description ~155 chars) enforced at the CMS-editing/admin-form layer as UX guidance, not hard database constraints — an intentionally long title for a specific SEO reason shouldn't be blocked outright.
- **Defaults & fallback behavior**: if a specific field is empty, fall back in this order — entity-specific value → derived value from the entity's own content (e.g. `metaTitle` falls back to `Product.name`) → site-wide default from Payload `Settings`. No page ever ships with a truly empty title/description/canonical.
- **Future-proofing**: because the contract lives in `packages/types` and both storage implementations satisfy the same shape, adding a new SEO field later (e.g. a future `videoObject` structured-data field) means updating the shared type once and both implementations follow — not redesigning the system.
