# Payload CMS Content Architecture

> **Implementation status — 16 August 2026.** The sentence below ("no collections are created, no
> Payload config is written") described this document at the time it was written and is **no longer
> true of the repository**. The design in it is unchanged and still authoritative; what exists is a
> foundation covering a small part of it. See [§Implementation status](#implementation-status-16-august-2026)
> at the end of this document for exactly what is built and what is not.

Complete content model for `sam_cms` (Payload). No collections are created, no Payload config is written, no database schema changes here — this is the design that config will follow. No frozen decision (ADR-001/002/003, the Payload/Prisma database split, NestJS-as-only-API-surface, the bespoke-pages-not-a-block-renderer frontend decision) is changed by anything below; this document exists entirely inside those boundaries.

---

## 0. Core Organizing Principles

### Globals vs. Collections

Payload has two content shapes, and this document uses both deliberately, not just one by default:

- **Globals** — for content where there is exactly one instance, ever (Home, About Us, Settings). Editors edit it in place; there's no list to manage.
- **Collections** — for content that repeats as independent records (FAQ entries, certifications, job openings) or that mirrors a Prisma entity 1:1 (product category page content, one row per Prisma `Category`).

**Why this matters here specifically:** [FRONTEND_ARCHITECTURE.md §1](../frontend/FRONTEND_ARCHITECTURE.md#1-next-js-app-router-structure) already committed to bespoke, uniquely-structured pages instead of a generic block-renderer (`[NEW DECISION] No Payload-style catch-all [...slug] route`). The CMS model mirrors that choice: **each bespoke page is its own Global with a tailored field schema**, not a shared "flexible page" collection with generic content blocks. Forcing Home and About Us into one generic `Pages` collection would fight the same "not a page builder" decision the frontend already made. This superseded an earlier, provisional framing in [SEO_ARCHITECTURE.md §3](../seo/SEO_ARCHITECTURE.md#3-payload-cms-seo-architecture) ("Company Pages... are `Pages` with a template field") — reasonable before the full site structure existed. That document has since been updated to the approved model; see this document's Decisions Log.

The one place a shared, generic collection is still correct: **Legal Pages** (Privacy Policy, Terms of Use, Cookie Notice, General Sales Conditions) — these really are structurally interchangeable (title + rich text + last-updated date) and could grow in number, unlike the bespoke pages.

### The Payload/Prisma Boundary, Applied to This Task

The task brief's "Products" and "Insights" groups list several things that **already have a frozen, Prisma-owned home** and are not redefined here:

- **Products, Categories, Specifications** — Prisma (`sam_platform`), per [DATA_MODEL.md](../DATA_MODEL.md) and [ARCHITECTURE.md](../ARCHITECTURE.md#modules-modular-monolith-boundaries)'s Catalog module. Not touched.
- **Blog Posts, Blog Categories, Blog Tags** — Prisma (`sam_platform`), per the same document. Not touched.
- **Product Finder** — a query/filter interface over the Prisma data above. No content of its own.

What Payload _does_ own for these areas is the **editorial wrapper content** around that structured data — exactly the same "one capability, two storages, unified by NestJS" pattern already used twice (SEO: [SEO_ARCHITECTURE.md §0](../seo/SEO_ARCHITECTURE.md#0-the-core-design-problem-and-how-its-resolved); i18n: [INTERNATIONALIZATION_STRATEGY.md §0](../i18n/INTERNATIONALIZATION_STRATEGY.md#0-the-core-design-problem-and-how-its-resolved)). This is the third application of that pattern, not a new one.

### CMS Content Modeling Rules (restated, governs every entity below)

Per [FRONTEND_ARCHITECTURE.md §10](../frontend/FRONTEND_ARCHITECTURE.md#cms-content-modeling-rules) and [CODING_STANDARDS.md](../CODING_STANDARDS.md#cms-content): no hardcoded lists (every repeating section is a Payload array/relation field); Payload's own Media/upload collection handles images and video for Payload-owned content, never Prisma's `Media` table; every field — including inside array items — is localized per [i18n strategy §3](../i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization), `en`/`fa`/`ar`, `fallback: true`.

---

## 1. Pages

### Home — _Global_

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**             | The homepage — first impression, trust signals, portfolio overview, entry point to every other page                                                                                                                                                                                                                                                                                                                                                    |
| **Who manages**         | Content Manager, Admin (per [SECURITY.md](../SECURITY.md)'s RBAC matrix — Content Manager has full CMS Content access)                                                                                                                                                                                                                                                                                                                                 |
| **Localization**        | Fully localized (`en`/`fa`/`ar`), all fields                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Fields**              | `heroTitle`, `heroSupportingText`, `heroPrimaryCta`/`heroSecondaryCta` (text+link); `whoWeAreText` (rich text); `companyStatistics` (**array**: `value`, `label`, `description` — 6 entries today, not fixed in schema); `whyChooseUs` (**array**: `icon`, `title`, `description`); `industriesWeServe` (**array**: `title`, `description`); `customFormulationHighlight` (rich text + `processSteps` **array**: `stepNumber`, `title`, `description`) |
| **Rich text**           | `whoWeAreText`, highlight body copy — headings, bold/italic, links, lists                                                                                                                                                                                                                                                                                                                                                                              |
| **Media**               | Hero background image/video; one image per statistic icon (optional); Payload upload collection                                                                                                                                                                                                                                                                                                                                                        |
| **Relationships**       | None to Prisma directly — the Product Portfolio cards and Latest Insights cards are populated at request time by NestJS joining this Global's copy with live Prisma `Category`/`BlogPost` data, not stored here                                                                                                                                                                                                                                        |
| **SEO fields**          | Full `SeoFields` group per [SEO_ARCHITECTURE.md §3](../seo/SEO_ARCHITECTURE.md#3-payload-cms-seo-architecture) (this is a `Pages`-tier entity for SEO purposes even though it's a Global)                                                                                                                                                                                                                                                              |
| **Publishing workflow** | Draft/publish; **human review required** before publish (brand-critical, per the i18n Translation Workflow's "Company Information" bucket)                                                                                                                                                                                                                                                                                                             |

### About Us — _Global_

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | Company credibility, history, expertise, team                                                                                                                                                                                                                                                                                                                                                                           |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Localization**        | Fully localized, all fields — including array item sub-fields                                                                                                                                                                                                                                                                                                                                                           |
| **Fields**              | `heroTitle`/`heroSupportingText` (shared shape with Home's hero); `whoWeAreText` (rich text); `milestones` (**array**: `year`, `title`, `description` — open-ended, no fixed count); `expertise` (**array**: `icon`, `title`, `description`); `competitiveAdvantages` (**array**); `qualityStandardsText` (rich text); `team` (**array**: `photo`, `name`, `role`, `bio` — open-ended); `finalCtaText`/`finalCtaButton` |
| **Rich text**           | `whoWeAreText`, `qualityStandardsText`                                                                                                                                                                                                                                                                                                                                                                                  |
| **Media**               | Hero image, one photo per `milestones` entry (optional), one photo per `team` entry                                                                                                                                                                                                                                                                                                                                     |
| **Relationships**       | None to Prisma                                                                                                                                                                                                                                                                                                                                                                                                          |
| **SEO fields**          | Full `SeoFields` group                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Publishing workflow** | Draft/publish; **human review required** (Company Information bucket)                                                                                                                                                                                                                                                                                                                                                   |

### Products Landing — _Global_

|                         |                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | The `/products` hub — hero, six category cards, Product Finder teaser, Documentation block                                                                                                                                                                                                                       |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                           |
| **Localization**        | Fully localized                                                                                                                                                                                                                                                                                                  |
| **Fields**              | `heroTitle`/`heroSupportingText`; `productFinderIntro` (short rich text — the Finder itself is a Prisma-backed query tool, not content, see §2); `documentationBlockText` (rich text); `documentationGatingFormNote` (text — the actual gating form is a future `Inquiry`-adjacent submission, not modeled here) |
| **Rich text**           | All body fields                                                                                                                                                                                                                                                                                                  |
| **Media**               | Hero image                                                                                                                                                                                                                                                                                                       |
| **Relationships**       | **None stored** — the six category cards render from live Prisma `Category` data (name/description) joined with this Global's hero copy at request time, same non-duplication principle as Home's product cards                                                                                                  |
| **SEO fields**          | Full `SeoFields` group                                                                                                                                                                                                                                                                                           |
| **Publishing workflow** | Draft/publish; human review recommended, not required (lower brand-risk than Home/About)                                                                                                                                                                                                                         |

### Customized Solutions — _Global_

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | Custom formulation positioning, process, private label programme, case studies                                                                                                                                                                                                                                                                                                                                       |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                                                                                                                               |
| **Localization**        | Fully localized                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Fields**              | **BUILT SHAPE:** `hero`; `introduction`; `whatCanWeCustomize` (**localized array**: `title`, `description`); `process` (`heading`, `lead`, `steps` **array**: `name`, `description`; numbering is array position, never duplicated as a field); `seoFields()`. `privateLabelProgramme` and `caseExamples` remain deliberately unbuilt until approved commercial programme details and customer-approved cases exist. |
| **Rich text**           | Intro, private label programme body                                                                                                                                                                                                                                                                                                                                                                                  |
| **Media**               | None required beyond a hero image; case examples are text-only                                                                                                                                                                                                                                                                                                                                                       |
| **Relationships**       | None. The `CustomFormulationRequest` **form itself** is a separate Prisma submission (per [DATA_MODEL.md](../DATA_MODEL.md)) — this Global is the surrounding page copy only, never the form data                                                                                                                                                                                                                    |
| **SEO fields**          | Full `SeoFields` group                                                                                                                                                                                                                                                                                                                                                                                               |
| **Publishing workflow** | Draft/publish; **human review required** (product-adjacent technical/commercial claims)                                                                                                                                                                                                                                                                                                                              |

### Export & Logistics — _Global_

|                   |                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**       | Global reach, supply chain, packaging/shipping, Incoterms                                                                                                                                                                                                                                                                                                                                                  |
| **Who manages**   | Content Manager, Admin                                                                                                                                                                                                                                                                                                                                                                                     |
| **Localization**  | Fully localized                                                                                                                                                                                                                                                                                                                                                                                            |
| **Fields**        | `heroTitle`/`heroSupportingText`; `regionalCards` (**array**: `regionName`, `description`, `latitude`, `longitude` — real geographic coordinates, see note below); `supplyChainSteps` (**array**: `stepNumber`, `title`, `description` — feeds `ManufacturingJourney`'s GSAP sequence, 8 entries today); `packagingFormats` (**array**: `formatName`, `description`, `image`); `incotermsText` (rich text) |
| **Rich text**     | Incoterms explanation, reliable-partnerships closing statement                                                                                                                                                                                                                                                                                                                                             |
| **Media**         | Hero image, one image per packaging format                                                                                                                                                                                                                                                                                                                                                                 |
| **Relationships** | None to Prisma. Coordinates are fields on the `regionalCards` array, not a separate entity                                                                                                                                                                                                                                                                                                                 |

**On `regionalCards` coordinates (approved):** the content model carries **real geographic data** (`latitude`/`longitude` per region), deliberately decoupled from how the frontend chooses to render it. An interactive Mapbox map, an illustrative SVG world map, or plain cards with no map at all are all satisfiable from the same content — that visualization choice belongs to design implementation, not the content model. Modeling coordinates now costs one field pair per region and avoids a content-migration if the design lands on a real map; modeling them later would mean re-entering data for every region. Coordinates are non-localized (a latitude doesn't change by language); `regionName`/`description` are localized.
| **SEO fields** | Full `SeoFields` group |
| **Publishing workflow** | Draft/publish; **human review required** (commercial terms — Incoterms, market claims) |

### Quality & Certifications — _Global_

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**             | QC process, lab capability, certifications, sampling policy — also the proposed home for `ResearchLaboratory` (per [FRONTEND_ARCHITECTURE.md §3](../frontend/FRONTEND_ARCHITECTURE.md#3-page-architecture), still unconfirmed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Who manages**         | Content Manager, Admin — certifications specifically should be Admin-gated given the source document's explicit warning against publishing placeholder certifications ([SITE_STRUCTURE.md §7](../SITE_STRUCTURE.md#7-quality--certifications--new-page))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Localization**        | Fully localized                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Fields**              | **BUILT, and the built shape supersedes the proposal in this row.** `hero` (`eyebrow`, `title` required, `supportingText`, `indexLabel`, two `ctaField`s); `approach` (`eyebrow`, `heading`, `lead`, `stages` **array**: `name`, `when`, `footnote`); `laboratory` (`eyebrow`, `heading`, `lead`, `registerLabel`, `orderNote`, `properties` **array**: `name` only, `unpublishedHeading`, `unpublished` **array**: `name`, `why`, `image`, `imageCaption`); `certifications` (`eyebrow`, `heading`, `status`, `statement`, `note` — **five strings, NO relation and no array**, see below); `documentation` (`eyebrow`, `heading`, `lead`, `registerLabel`, `documents` **array**: `name`, `scope`, `note`); `sampling` (`eyebrow`, `statement` required, `familiesLabel`, `families` — **non-localized multi-select over the six frozen ADR-009 Product Family keys, minimum one**, `limit`); `closing`; `seoFields()` |
| **Eyebrows**            | **Every one of the seven sections owns its own, localized.** Three of them — `approach`, `laboratory`, `documentation` — rendered hardcoded English until the eyebrow correction, so a Persian or Arabic reader met an English label above translated content. An eyebrow is a visible line of page copy, not layout: layout is code, editorial content is CMS. They are optional, and **the frontend supplies no English fallback** — an unwritten eyebrow renders nothing at all                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Rich text**           | **None. Superseded.** The lab intro and the sampling policy are single sentences in a fixed composition — the sampling statement is rendered as the section's own `<h2>` — so both ship as plain `textarea`. A Lexical editor plus an HTML rendition plus sanitization would be three mechanisms carrying markup the layout does not accept                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Media**               | **Lab/testing photography only** — one optional `upload` into `Media`, with its caption; alt text lives on the Media record. **No hero image, superseding this row's earlier "Hero image":** the hero's right column is the verification chain read off `approach.stages`, so a hero image field would have no slot to render into                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Relationships**       | **None. Deferred by decision (Q3).** No relation to `Certifications` exists, and no field in this Global can name, number, date, file or link a certificate. This Global is writable by a Content Manager under the ordinary company-page rule, while decision 7 below forbids a Content Manager from publishing a certification — the two are compatible only while the schema cannot hold one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **SEO fields**          | Full `SeoFields` group, `AboutPage` schema type per [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Publishing workflow** | Draft/publish; **human review required** — explicitly the highest-stakes page for accuracy (real certifications, real test methods)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Contact Us — _Global_

|                         |                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**             | Contact information, contact-option routing cards, page copy around the Inquiry form                                                                                                                                                                                                                                                                                                       |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                                                                                                     |
| **Localization**        | Fully localized (contact _copy_; raw addresses/phone numbers are locale-independent facts — see Fields)                                                                                                                                                                                                                                                                                    |
| **Fields**              | **Built first factual slice:** independent optional `mainPhone`, `salesPhone`, `generalEmail`, `salesEmail`, HTTPS URLs for WhatsApp/LinkedIn/Instagram/Telegram, and localized `address`. Empty fields are omitted publicly; no placeholder channel is published. Hero/page copy remains code-owned in this slice. The planned routing-card copy and FAQ relationship remain later gates. |
| **Rich text**           | Global inquiries closing statement                                                                                                                                                                                                                                                                                                                                                         |
| **Media**               | None beyond hero                                                                                                                                                                                                                                                                                                                                                                           |
| **Relationships**       | **→ `FaqEntries` collection.** The **Inquiry form itself** (First Name, Email, Inquiry Type, etc.) is Prisma — this Global never stores form fields or submissions, only the page copy around the form                                                                                                                                                                                     |
| **SEO fields**          | Full `SeoFields` group, `ContactPage` schema                                                                                                                                                                                                                                                                                                                                               |
| **Publishing workflow** | Draft/publish; **human review required** (contact details are a factual commitment)                                                                                                                                                                                                                                                                                                        |

### FAQ Page — _Global_

|                         |                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | The page wrapper around the shared `FaqEntries` collection (§4) — hero copy plus which categories appear, in what order. Deliberately thin: it holds **no FAQ content of its own**, only presentation of the shared collection                      |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                              |
| **Localization**        | Fully localized (hero/intro copy; the entries themselves are localized on `FaqEntries`)                                                                                                                                                             |
| **Fields**              | `heroTitle`, `introText`; `categoryOrder` (**array**: `category` select + `sortOrder` — controls which of the five FAQ categories render and in what sequence, so reordering is a content edit, not a code change); `finalCtaText`/`finalCtaButton` |
| **Rich text**           | `introText`                                                                                                                                                                                                                                         |
| **Media**               | Hero image only                                                                                                                                                                                                                                     |
| **Relationships**       | **→ `FaqEntries`** (queried by category, not stored here — one source of truth, per confirmed decision 3)                                                                                                                                           |
| **SEO fields**          | Full `SeoFields` group; `FAQPage` schema type per [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master), assembled from the `FaqEntries` this page renders                                                                                    |
| **Publishing workflow** | Draft/publish; human review recommended — the entries themselves carry the stricter review requirement (§4), not this wrapper                                                                                                                       |

### Site-Wide & Structural Globals

| Global       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                              | Fields (summary)                                                                      | Localization                                              | Publishing               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| **Header**   | Main navigation, mega-menu                                                                                                                                                                                                                                                                                                                                                                                           | `logo`, `navItems` (**array**, supports nested mega-menu columns), `primaryCtaButton` | Nav labels localized; structure isn't                     | Human review recommended |
| **Footer**   | 5-column footer + legal bar                                                                                                                                                                                                                                                                                                                                                                                          | `columns` (**array of arrays**: column title + links), `socialLinks`, `legalBarText`  | Localized                                                 | Human review recommended |
| **Settings** | Site-wide defaults, grouped by tab: **General** (address/phone/WhatsApp/social — feeds `Organization` schema per [SEO_ARCHITECTURE.md §8](../seo/SEO_ARCHITECTURE.md#8-structured-data-schemaorg)), **SEO Defaults** (default OG image, meta description suffix), **404 Page** (title/body/links), **Thank You Page** (confirmation message/next steps), **Cookie Banner** (copy + which analytics tools are active) | Localized per group                                                                   | **Human review required** (source-of-truth contact facts) |

`Pages` (Collection) — Legal Pages only: `title`, `slug`, `body` (rich text), `lastUpdatedDate`, standard `SeoFields`. Localized. **Human review required, plus actual legal review** — [SITE_STRUCTURE.md §12](../SITE_STRUCTURE.md#12-legal-pages) is explicit these are drafting specifications, not finished legal text.

---

## 2. Products

**Product categories, product content (structured data), and product finder data are Prisma, not Payload** — `Product`, `Category`, `Specification` in [DATA_MODEL.md](../DATA_MODEL.md), owned by the Catalog module. This document does not redefine them. What Payload owns instead:

### ProductCategoryContent — _Collection_

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | The editorial wrapper around each of the six Prisma `Category` rows — hero copy, overview, applications, industries served, packaging narrative, customization CTA, per-category FAQ. **One entry per Prisma Category** (6 today; grows only if a 7th category is ever added, never per-SKU)                                                                                                                                                                      |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Localization**        | Fully localized, including array items                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Fields**              | `categoryKey` (matches the Prisma `Category.slug` — the join key NestJS uses to merge Payload copy with Prisma catalog data, same pattern as `SeoMeta.entityId`); `heroTitle`/`heroSupportingText`; `overviewText` (rich text); `applications` (**array**: `text`); `industriesServed` (**array**: `title`, `description`); `packagingSupplyText` (rich text); `customizationCtaText`; `faqEntries` — **relation to `FaqEntries`** filtered by this category (§4) |
| **Rich text**           | Overview, packaging & supply                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Media**               | Category hero image; per-format packaging photos where distinct from Export & Logistics' shared set                                                                                                                                                                                                                                                                                                                                                               |
| **Relationships**       | **`categoryKey` ↔ Prisma `Category.slug`** (a soft key, not a database foreign key — cross-database, per ADR-002, resolved by NestJS, not a real FK). **→ `FaqEntries`**                                                                                                                                                                                                                                                                                          |
| **SEO fields**          | Full `SeoFields` group per entry — matches [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master)'s per-category `Product` + `FAQPage` schema types                                                                                                                                                                                                                                                                                                          |
| **Publishing workflow** | Draft/publish; **human review required** (product specifications/technical accuracy bucket — the strictest tier in the i18n Translation Workflow table)                                                                                                                                                                                                                                                                                                           |

**Product Range, Key Specifications, and every grade/SKU (SN 150, SN 350, Bright Stock, etc.)** shown within a category page are **Prisma `Product` + `Specification` rows**, not Payload content, rendered by `apps/web` alongside this collection's editorial copy. Not redefined here.

**Product Finder** has no content model at all — it's a filter UI over live Prisma `Product`/`Category`/`Specification` data (per [FRONTEND_ARCHITECTURE.md §3](../frontend/FRONTEND_ARCHITECTURE.md#3-page-architecture)). Its short intro copy lives on the Products Landing Global (§1), not its own entity.

---

## 3. Insights

**Blog/Articles and Categories are Prisma, not Payload** — `BlogPost`, `BlogCategory`, `BlogTag` in [DATA_MODEL.md](../DATA_MODEL.md), owned by the Blog module, already localized via `ContentTranslation` per the i18n strategy. This document does not redefine them, and **no Payload collection is proposed for Insights content** — doing so would duplicate an already-frozen Prisma entity and reopen a boundary this project has deliberately kept closed twice already (SEO, i18n).

**Authors — decided: internal-only.** `BlogPost.authorId` already references Prisma `User`, and that's the complete authorship model. **No public-facing author profiles, no `AuthorProfiles` collection.** Articles may display an author name from the `User` record where editorially useful, but there is no public bio, photo, or author archive page. If public author profiles are ever wanted, that's a new decision requiring its own design pass — the natural options (a small Payload collection keyed to a `User`, or reusing an `AboutUs.team` entry) are recorded here so the reasoning isn't lost, but neither is being built.

Article images/featured images are **Prisma `Media`** (`ownerType: 'BlogPost'`), consistent with Product images — never Payload's upload collection, since `BlogPost` is Prisma-owned.

---

## 4. Company Content

### Certifications — _Collection_

> **NOT BUILT, and deferred by decision — Q3, 20 August 2026.** The Quality & Certifications Global
> shipped without this collection and without any relation to it. The reasons are that no real
> certificate exists to put in one (the list is still an open confirmation in
> [SITE_STRUCTURE.md](../SITE_STRUCTURE.md#outstanding-confirmations-needed)), that a collection
> built now would ship its Admin-only publish gate with nothing to gate and no way to validate it
> against real content, and that two of the fields below are blocked on other unbuilt work —
> `certificateFile` needs the image-only `Media` collection widened to accept PDFs, and
> `relatedCategories` points at `ProductCategoryContent`, which does not exist.
>
> **Nothing already shipped needs migrating when this is built.** The Quality Global's
> `certifications` group holds five localized strings describing the withheld state, with no array
> to reconcile; the relation joins that group and the withheld statement becomes its empty state.
> The publish gate below remains **owed and unimplemented** — it is not satisfied anywhere today,
> and the only thing standing in for it is that no schema on the platform can express a
> certification claim.

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | ISO/API/OEM/lab-accreditation certificates — referenced from Quality & Certifications and, optionally, specific product category pages                                                                                                                                                                                                                                                                              |
| **Who manages**         | **Content Manager may create and edit drafts; only Admin may publish.** Approved carve-out from the general "Content Manager has full CMS Content access" rule in [SECURITY.md](../SECURITY.md)'s RBAC matrix — the only content type on the platform with a stricter publish gate, justified by the source document's warning that a buyer who checks a claimed certification and finds nothing will not come back |
| **Localization**        | `certificateName`/notes localized; `certificateNumber`, `validUntil`, `issuingBody` are facts, not localized                                                                                                                                                                                                                                                                                                        |
| **Fields**              | `certificateName`, `issuingBody`, `certificateNumber`, `validUntil` (date), `certificateFile` (upload — PDF), `relatedCategories` (optional relation to `ProductCategoryContent`, for certs that apply to specific product lines rather than the company as a whole)                                                                                                                                                |
| **Rich text**           | None — factual fields only                                                                                                                                                                                                                                                                                                                                                                                          |
| **Media**               | The certificate PDF/image itself (Payload upload)                                                                                                                                                                                                                                                                                                                                                                   |
| **Relationships**       | **← referenced by** Quality & Certifications Global; **↔ optionally** `ProductCategoryContent`                                                                                                                                                                                                                                                                                                                      |
| **SEO fields**          | None — not an independently indexed page, referenced content only                                                                                                                                                                                                                                                                                                                                                   |
| **Publishing workflow** | **Draft → Admin approval → published.** A Content Manager saving a certificate leaves it in draft; it becomes publicly visible only once an Admin publishes it. This is the collection the source document is most emphatic about: nothing public here until real, verifiable certificates exist                                                                                                                    |

### Milestones and Team

**Not separate collections** — both are array/repeater fields embedded directly in the **About Us Global** (§1). Confirmed decision 3. The one hypothetical reuse case (a public author bio sharing a team member's record) is now moot: authorship is internal-only per §3, so no reuse case exists at all. Revisit only if that changes.

### JobOpenings — _Collection_

|                         |                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | Career listings for the Careers page. **Maintained manually in Payload — no external ATS integration** (confirmed decision 10). No sync mechanism, no import/export, no third-party job-board API                                                                                                                                              |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                                                         |
| **Localization**        | Fully localized                                                                                                                                                                                                                                                                                                                                |
| **Fields**              | `title`, `department`, `location`, `employmentType` (select), `description` (rich text), `requirements` (**array**), `status` (open/closed), `applyLink` or relation to a future `JobApplication` Prisma entity (not yet modeled — see [SITE_STRUCTURE.md's Data Model Gaps](../SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure)) |
| **Rich text**           | Description                                                                                                                                                                                                                                                                                                                                    |
| **Media**               | None required                                                                                                                                                                                                                                                                                                                                  |
| **Relationships**       | **→ future `JobApplication`** (Prisma, not yet built)                                                                                                                                                                                                                                                                                          |
| **SEO fields**          | Basic `SeoFields` — job listings are low-priority SEO surface per [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master) (Careers isn't in the SEO Master table at all)                                                                                                                                                                   |
| **Publishing workflow** | Draft/publish; human review recommended, not required                                                                                                                                                                                                                                                                                          |

The **Speculative Application** (CV upload, no listed role) and the **Distributor Application** form on the same page are Prisma submissions (future entities, not modeled here) — this collection is job _listings_ only, never applications. Since listings are maintained by hand, an editor closing a role is a `status` change or a delete in Payload, not an automated sync — worth stating because it means listing hygiene is an editorial responsibility, with no external system to fall back on.

### FaqEntries — _Collection_

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**             | Single source of truth for every FAQ answer on the site — the dedicated `/faq` page **and** each product category page's FAQ section **and** Contact Us's FAQ section all query this same collection, filtered differently. This is why it has to be a collection, not an array embedded per page — [SITE_STRUCTURE.md §9](../SITE_STRUCTURE.md#9-faq-new) is explicit that `/faq` "consolidates the per-page FAQs already embedded" elsewhere; a shared collection is what makes that consolidation real instead of copy-pasted |
| **Who manages**         | Content Manager, Admin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Localization**        | Fully localized (question + answer)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Fields**              | `question`, `answer` (rich text), `category` (select: About the Company / Products & Specifications / Ordering & Samples / Export & Logistics / Customization & Private Label — per [SITE_STRUCTURE.md §9](../SITE_STRUCTURE.md#9-faq-new)), `relatedCategory` (optional relation to `ProductCategoryContent`, for category-page-scoped FAQ sections), `showOnContactPage` (boolean), `sortOrder`                                                                                                                                |
| **Rich text**           | `answer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Media**               | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Relationships**       | **← referenced by** `/faq`, `ProductCategoryContent` (via `relatedCategory`), Contact Us Global (via `showOnContactPage`)                                                                                                                                                                                                                                                                                                                                                                                                        |
| **SEO fields**          | None per entry — the `/faq` page's own `SeoFields`/`FAQPage` schema lives on the `FaqPage` Global (§1), assembled from the entries it renders                                                                                                                                                                                                                                                                                                                                                                                    |
| **Publishing workflow** | Draft/publish; **human review required** — several answers touch commercial facts (MOQ, lead time, response time) per the i18n Translation Workflow's lead-generating-content bucket                                                                                                                                                                                                                                                                                                                                             |

### Downloads

**Split by ownership, not a single collection:**

- **Product-specific technical documents** (TDS, SDS, COA templates per grade) — **Prisma `Media`** (`ownerType: 'Product'`), since they belong to a specific Prisma `Product`/`Category`, exactly like product images. Not Payload.
- **Company-wide downloadable assets** (full catalogue PDF, company profile PDF) — **Payload's upload collection**, referenced from the relevant Global (Products Landing for the catalogue, About Us for the company profile) via a simple upload field, not a dedicated "Downloads" collection — there's no independent list-management need beyond "attach a file to the page that offers it."

---

## Proposed Payload Collections (summary)

| Name                            | Type                | Entries                     |
| ------------------------------- | ------------------- | --------------------------- |
| `Home`                          | Global              | 1                           |
| `AboutUs`                       | Global              | 1                           |
| `ProductsLanding`               | Global              | 1                           |
| `CustomizedSolutions`           | Global              | 1                           |
| `ExportLogistics`               | Global              | 1                           |
| `QualityCertifications`         | Global              | 1                           |
| `ContactUs`                     | Global              | 1                           |
| `FaqPage`                       | Global              | 1                           |
| `Header`                        | Global              | 1                           |
| `Footer`                        | Global              | 1                           |
| `Settings`                      | Global              | 1                           |
| `Pages`                         | Collection          | 4 (Legal Pages)             |
| `ProductCategoryContent`        | Collection          | 6 (one per Prisma Category) |
| `Certifications`                | Collection          | Open-ended                  |
| `JobOpenings`                   | Collection          | Open-ended                  |
| `FaqEntries`                    | Collection          | Open-ended                  |
| Payload's built-in Media/upload | Collection (native) | Open-ended                  |

**Explicitly not proposed**: separate collections for Milestones, Team, Blog/Articles, Blog Categories, Author profiles (authorship is internal-only, confirmed decision 6), or a generic Downloads collection — each has a stated reason above.

## Field Structure Summary

Every entity above follows the same four field-shape primitives, never inventing a fifth:

1. **Simple localized fields** (text/rich text) — page copy.
2. **Arrays/repeaters** — for open-ended lists (milestones, team, statistics, FAQ-adjacent bullets) — the mechanism that makes "no hardcoded lists" real.
3. **Relations** — where the same content is genuinely queried from more than one place (`FaqEntries`, `Certifications`) or bridges to Prisma via a soft key (`ProductCategoryContent.categoryKey`).
4. **Non-localized fact fields** — dates, certificate numbers, raw addresses — deliberately excluded from localization where the value doesn't change by language.

## Relationship Map

```
Prisma (sam_platform)                    Payload (sam_cms)
─────────────────────                    ─────────────────
Category ──── categoryKey (soft) ────────▶ ProductCategoryContent ──▶ FaqEntries (relation)
Product, Specification                      (no direct link — rendered
  (rendered alongside Payload copy           alongside by NestJS)
  by NestJS, never joined in-database)

BlogPost ──── authorId ──▶ User            (no Payload involvement at all)

Inquiry, CustomFormulationRequest        ContactUs Global, CustomizedSolutions Global
  (form DATA — Prisma)                     (form SURROUNDING COPY — Payload)
  — same page, two databases, joined
    only in the NestJS response, never
    in a query

(future) JobApplication                  JobOpenings ──▶ (future) JobApplication (relation, once built)
(future) DistributorApplication           Careers-adjacent page copy — Global, not yet named/built here

                                          QualityCertifications Global ──▶ Certifications (relation)
                                          ContactUs Global ──▶ FaqEntries (relation, filtered)
```

Every cross-database link above is a **soft key resolved by NestJS**, never a real foreign key — consistent with ADR-002's two physically separate databases.

## Decisions Log

Confirmed and approved after this document's initial draft:

1. **Payload page ownership model — approved.** Bespoke company/brand pages are Payload **Globals** (Home, About Us, Products Landing, Customized Solutions, Export & Logistics, Quality & Certifications, Contact Us, plus Header/Footer/Settings). Legal pages remain a generic **`Pages` collection**. **No generic page builder and no catch-all page collection** — layout stays code, editorial content stays CMS. Now also reflected in [SEO_ARCHITECTURE.md §3](../seo/SEO_ARCHITECTURE.md#3-payload-cms-seo-architecture), which previously carried the superseded "Company Pages are `Pages` with a template field" assumption.
2. **Content management rule — approved.** Layout and components are controlled by frontend code; editorial content is managed in Payload. Repeating content (cards, grids, timelines, lists, FAQs) is never hardcoded — always a CMS array/repeater or relation. Enforced as a reviewable standard in [CODING_STANDARDS.md](../CODING_STANDARDS.md#cms-content) and [FRONTEND_ARCHITECTURE.md §10](../frontend/FRONTEND_ARCHITECTURE.md#cms-content-modeling-rules).
3. **Content boundaries — approved.** Blog/Insights stays Prisma-owned; Payload must never duplicate blog entities. `FaqEntries` is a shared Payload collection precisely because it's reused across `/faq`, product category pages, and Contact Us. About Us milestones and team stay embedded repeater fields on the About Us Global, not separate collections.
4. **Media ownership boundary — approved.** Payload's Media/upload collection handles Payload-owned editorial media; Prisma's `Media` table stays exclusively for Prisma-owned entities (Products, BlogPosts). Follows directly from ADR-002.
5. **Localization rules — approved and unchanged.** All editorial fields support localization where required, including sub-fields inside repeater/array items, per [i18n strategy §3](../i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization).
6. **Authorship is internal-only.** No public author profiles, no `AuthorProfiles` collection, no author archive pages. `BlogPost.authorId` → Prisma `User` is the complete model (§3).
7. **Certification publishing requires Admin approval.** Content Manager creates and edits drafts; only Admin publishes. The one deliberate carve-out from Content Manager's otherwise-full CMS Content access — now reflected in [SECURITY.md](../SECURITY.md)'s RBAC matrix (§4).
8. **`/faq` gets a dedicated thin Global** (`FaqPage`) — hero copy plus category ordering, holding no FAQ content of its own; entries stay in the shared `FaqEntries` collection (§1).
9. **Regional map data carries real coordinates.** `ExportLogistics.regionalCards` includes `latitude`/`longitude`, non-localized. The visualization choice (interactive Mapbox map, illustrative SVG, or cards only) is deliberately left to design implementation — the content model supports all three without a migration (§1).
10. **Careers is manually managed in Payload.** No external ATS integration, no sync mechanism (§4).

## Open Business Decisions

**None.** Every business decision this document raised is now resolved — decisions 6–10 above closed the last five.

Two items previously listed here were closed without needing a decision: _Downloads' company-wide assets_ (settled by decision 4's media boundary — any future gated-download lead tracking is a Prisma data-model question, tracked with the other Prisma gaps in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure)), and the _`SEO_ARCHITECTURE.md` follow-up edit_, which has since been applied.

Remaining blockers for building these collections are **content and technical**, not decisions: the `[TO CONFIRM]` items in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md#outstanding-confirmations-needed) (real certifications, photography, contact details, commercial terms) and the unmodeled Prisma-side entities (Distributor Application, Job Application) that two Payload collections reference.

---

## Implementation status (16 August 2026)

The Payload foundation exists. **Nothing in the model above is changed by it** — this section records
which parts of it are built, and states plainly that most are not.

### Built

- **`apps/cms`** — Payload 3.88.0 on **Next.js 16.2.12**, TypeScript, `@payloadcms/db-postgres`
  against `sam_cms`. GraphQL is disabled in the config; Payload's REST API and admin UI are the only
  surfaces. CORS is left at Payload's default (`[]` — no allowed origin, wildcard or otherwise).
  **`apps/cms` runs a different Next version from `apps/web` on purpose** — Payload supports a narrow
  set of Next releases that excludes `apps/web`'s line, and pnpm's package isolation is the boundary.
  `apps/web` must not be moved to match. Full reasoning: [TECH_STACK.md](../TECH_STACK.md) §CMS.
- **`Users`** — Payload's own admin collection ([ADR-006](../ADR/ADR-006-payload-admin-authentication.md)),
  with a `roles` field. ADR-006's minimum of `admin` and `content-manager` is met; a third role,
  `service`, exists solely as the identity behind the NestJS service credential
  ([API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §4) and is refused access to the admin panel.
  Bootstrap is Payload's own create-first-user flow — no credential is seeded or committed.
- **`Pages`** — the Legal Pages collection of §1, with the four frozen fields: `title` (localized),
  `slug` (**not** localized — structural page URLs stay fixed English,
  [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) §6.12), `body` (rich text, localized) and
  `lastUpdatedDate` (a fact, not localized). Draft/publish versioning is on.
- **Localization** — `en`/`fa`/`ar`, default `en`, `fallback: true`, **frozen in code and not
  readable from the environment** (see below).
- **Access control** — unauthenticated requests are refused entirely; the `service` identity is
  constrained by a `_status` query constraint to **published** documents only; editors may read
  drafts and write.

### Not built — and each is its own gate

- **Eight of the eleven Globals.** Home, Products Landing, Export & Logistics, Contact Us, FAQ Page,
  Header, Footer and Settings do not exist. **`AboutUs`, `CustomizedSolutions` and
  `QualityCertifications` do** — see the sections at the end of this document.
- **`ProductCategoryContent`, `Certifications`, `JobOpenings`, `FaqEntries`** — none exists, so the
  `categoryKey` soft key to Prisma `Category`, the Admin-only certification publish gate and the
  shared FAQ collection are all still design only.

  **`Certifications` is deferred by decision, not merely unbuilt (Q3).** The Quality &
  Certifications Global shipped without it and without any relation to it, because no real
  certificate exists to put in one and because a collection built now would ship its Admin-only
  publish gate with nothing to gate. What that Global publishes instead is the page's current
  truthful state — that the list is unconfirmed and nothing stands in its place — as five localized
  strings with **no array, relation, issuer, number, date, file or link anywhere in the schema**.
  Adding the collection later is additive: the relation joins the group that already exists, and the
  withheld statement becomes its empty state. **Nothing shipped needs migrating.**

- **A production object store.** Media storage is implemented and MinIO serves it in development, but
  which S3-compatible store runs in production is still the open decision
  ([DEVOPS.md](../DEVOPS.md) §Object storage). Nothing in the codebase names one, and because public
  URLs are origin-relative, choosing one later requires no data migration.
- **Legal page content.** No Privacy Policy, Terms of Use, Cookie Notice or General Sales
  Conditions row exists, in any locale. [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §12 is explicit
  that these are drafting specifications requiring legal review, and none has been performed.
  **The consuming end is now built and waiting:** as of 17 August 2026 `apps/web` serves a canonical
  `/{locale}/privacy-policy` route that reads this collection through NestJS and 404s because the
  row is absent ([ROADMAP.md](../ROADMAP.md)). Creating that row is an **editorial act performed in
  the admin UI after legal review** — not a bootstrap script, not a seed, and not something this
  repository may generate. The demo bootstrap deliberately does not create it, and adding it there
  would be the exact failure the script's own guard rails exist to prevent.

### The only content that exists

One `Pages` entry, `cms-demo-page`, created by the opt-in bootstrap script
`apps/cms/src/seed/seed-cms-demo.ts` (`pnpm --filter @sam-group/cms seed:demo`, armed only by
`SAM_ALLOW_DEMO_CMS_SEED=true`). It exists in `en` only, so that `fa` and `ar` demonstrate the
fallback path.

**It is DEMO / PLACEHOLDER / NON-AUTHORITATIVE content.** It is not SAM Group copy, it makes no
legal, commercial, technical, certification, availability or contact claim, and its own body says so.
A production deployment must never treat it as approved content. The script creates nothing else,
edits nothing that already exists, and deletes nothing.

### Locales are frozen in code — `en`/`fa`/`ar`, default `en`, fallback on

**Decided and implemented**, in `apps/cms/src/localization.ts`. The Phase 1 locale set is already a
frozen decision, so Payload's configuration states it directly rather than reading it from anywhere.

An earlier revision of this scaffold read it from `CMS_LOCALES`/`CMS_DEFAULT_LOCALE`. **That was
removed**: an environment variable that can override a frozen decision means the decision is not
frozen, and one deployment could have served a locale set the platform does not have with nothing
reporting the divergence. Those two variables no longer exist anywhere, including in
`apps/cms/.env.example`.

Three mechanisms were available and two are **rejected outright**: Payload must not open
`sam_platform` ([ADR-002](../ADR/ADR-002-two-databases.md)), and there is to be **no boot-time
`cms` → `api` dependency** (today `api` calls `cms` and never the reverse) and **no reconciliation
service**. The frozen set is the third, and it is what the platform already committed to.

Drift is guarded twice: compile-time assertions in `localization.ts` fail `pnpm type-check` if the
tuple, the default or the fallback flag changes, and a runtime assertion runs before the Payload
config is built. Both are covered by tests, including one that sets the old environment variables and
proves they change nothing.

**Adding a locale is deliberately an intentional architecture step, not a configuration edit** — a
change in `localization.ts`, a `Locale` row in `sam_platform`, a `sam_cms` schema change (Payload's
Postgres adapter stores localized values per locale), and translated content.

Locale **direction** is still not carried in Payload's config. `rtl: true` per locale would improve
Payload's own admin editing surface, but direction is a `Locale` column and restating it here would
be a second vocabulary for it. The public site is unaffected — it reads direction from the `Locale`
table through NestJS.

### Rich text is sanitized before it is served

Payload's rich text reaches consumers as HTML (`bodyHtml`), and **NestJS sanitizes it** — an
allow-list rebuild in `apps/api`'s Content module, applied in the one function every Content response
is assembled by. Editorial markup for legal and corporate prose survives (headings, emphasis, lists,
links, quotes, tables); script hosts, event-handler attributes, `style`, embeds, form controls and
any URL scheme outside `http`/`https`/`mailto`/`tel` do not.

The boundary is in the API rather than the frontend deliberately: NestJS is the only public contract
([ADR-003](../ADR/ADR-003-api-gateway.md)), so every present and future consumer gets the same safe
HTML and none of them can forget to sanitize. Full detail:
[API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.4a.

### Media and `SeoFields` — implemented

Both deferred dependencies are closed. `Pages` now carries all five fields §1 specifies: `title`,
`slug`, `body`, `lastUpdatedDate` and the standard `SeoFields` group.

**`Media` — Payload's upload collection, editorial media only.** One declared field, `alt`
(required, localized) — the single field the frozen documents specify for it
([SEO_ARCHITECTURE.md](../seo/SEO_ARCHITECTURE.md) §Image SEO, [DATABASE.md](../DATABASE.md)).
**No caption, credit, attribution or tag field**, because none is specified anywhere and Payload's
examples shipping them is not a specification. Width, height, filesize, MIME type and URL come from
Payload's own upload handling. Images only (`image/jpeg|png|webp|avif|svg+xml`); widening it is a
content-model decision for the day a Global actually needs a PDF. No `imageSizes` — §6 already
commits to `next/image` doing derivative generation, and a second resizer would duplicate it.

The ownership boundary of approved decision 4 is enforced, not merely stated: product imagery,
product technical documents (TDS/SDS/COA), blog featured images and every application upload remain
Prisma's. The two `Media` tables live in different databases and neither can reference the other.

**Storage — S3-compatible object storage, never a container disk.** `@payloadcms/storage-s3` writes
to the **`sam-public`** bucket under a `cms/` key prefix, with `disableLocalStorage: true`.
[DEVOPS.md](../DEVOPS.md) §Object storage is categorical that media "never lives in a database or on
a container volume belonging to an app", and Payload's default `staticDir` behaviour is exactly what
that forbids. `sam-public` rather than a third bucket: DEVOPS defines two buckets split by
**sensitivity**, not by owner, and editorial images on public pages are public content. A value
containing `private` is **refused at config-build time** — `sam-private` holds CVs and confidential
documents, is never proxied, and an upload collection writing there would produce objects that look
published to an editor and are unreachable in fact.

Every storage value is process-scoped configuration. The development store is MinIO; the production
store remains the open decision DEVOPS.md records, and **no production host is named anywhere**.

**Public media URLs are origin-relative — `/media/cms/<file>`.** This is not a new decision: nginx
already implements it (`docker/nginx/templates/default.conf.template`), proxying `/media/<key>` to
the public bucket from the site's own origin. So no absolute URL, no object-store endpoint and no
bucket name ever reaches a database row, a response body or a browser, and swapping object stores
needs no data migration. `apps/web` needs no `next/image` `remotePatterns` entry, because the images
are same-origin. Payload's access-controlled file route (`/api/media/file/...`) is **disabled** for
this collection: it would put the CMS origin into the browser's request path, which ADR-003 forbids,
while gating objects that are anonymously readable by design.

**`SeoFields` — one shared `seoFields()` function**, as §3 requires, spread into `Pages` and
unchanged when the seven company Globals adopt it. It is a transcription of
[SEO_ARCHITECTURE.md](../seo/SEO_ARCHITECTURE.md) §2's contract table, with two rows deliberately not
stored — `locale`, which Payload's localization already provides, and `alternates`, which is derived
from which documents are genuinely translated. Copy is localized; switches (`robotsIndex`,
`robotsFollow`, `twitterCardType`, `canonicalUrl`) are not, because a `noindex` decision is about the
entity rather than about a language.

**Still not implemented:** the seven company Globals, `ProductCategoryContent`, `Certifications`,
`JobOpenings`, `FaqEntries`, and every canonical legal or Contact Us page. Those remain blocked on
approved, legally reviewed content in three locales.

## The About Us Global — built 20 August 2026 (CMS-1)

The first company Global, and the first page on the platform whose editorial content is managed in
Payload. The path it proves is the one every later Global will reuse: **Payload Global → NestJS
Content module → `apps/web` page**, with the browser making no request to the CMS and `apps/web`
holding no awareness that Payload exists ([ADR-003](../ADR/ADR-003-api-gateway.md)).

### The schema is the page, and nothing more

`apps/cms/src/globals/about-us.ts` models `hero`, `whoWeAre`, `expertise`, `team`,
`qualityStandards`, `closing` and the shared `seoFields()` group. Every field is one the About page
renders today.

**`milestones` and `competitiveAdvantages` remain deliberately absent.** Their factual content is
still unapproved. `team` was added on 27 August 2026 after explicit editorial approval and models
four accountable functions plus one Payload-owned photograph. It deliberately has no person name,
biography, tenure, title, or customer claim; a real roster remains a later editorial gate.

Two things the page shows are **not** editorial content and stay in code:

- **The six Product Families.** `Category` data in `sam_platform`, navigated from
  `features/site/site-routes.ts`. Payload may never mirror a Prisma-owned entity
  ([ADR-002](../ADR/ADR-002-two-databases.md)).
- **Structural URLs.** A call to action carries a `label` and a **route key** — one of `products`,
  `customized-solutions`, `quality-certifications`, `contact-us`, `request-a-quote` — never an href.
  `apps/web` resolves the key and applies the locale prefix, so the URL of a structural page stays
  owned by code in all three locales ([PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) §6.12).

Section photographs are optional `upload` fields into the existing `Media` collection, with alt text
read from the Media record rather than duplicated per usage. **`Media` remains image-only**;
certificates, catalogues and other documents are a later, explicit media decision.

### Published-only, established by measurement rather than by analogy

The `Pages` collection's `publishedForService` rule was known to work for a collection. Globals were
not assumed to behave the same way, and one difference turned out to matter:

**Payload gives a Global no default `readVersions` access rule** (`globals/config/sanitize.js`), and
`executeAccess` returns `true` for _any authenticated identity_ when an access function is absent. So
a Global with drafts enabled and no explicit rule would have let the NestJS service credential read
every draft through `/api/globals/about-us/versions` — the published-only contract leaking through the
door beside the one it guards. `AboutUs` declares `readVersions: editorOnly`, and a test fails if the
line is ever removed.

The rest holds as it does for collections, for reasons read out of Payload 3.88 rather than inferred:
a draft save skips `updateGlobal` entirely and writes only a version row, so the Global's own row
always holds the last published state; `db.findGlobal` applies the access `Where` and answers `{}`
when it does not match; and `?draft=true` cannot bypass it, because the same constraint is appended to
the version query as `version._status equals published`, which no draft row can satisfy.

Measured against a running CMS with a draft saved and nothing published: service read `{}`, service
read with `?draft=true` `{}`, service `GET …/versions` **403**, anonymous read **403**, editor read
returns the draft.

### Draft/publish is on; preview is deferred

`versions.drafts: true`, per §About Us's "human review required". **No preview mechanism exists** —
no Next.js draft mode, no preview token, no `draft=true` browser path, no editor preview link. That
is a Phase 1 decision, recorded in [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) Remaining
Blockers 2. An editor reviews unpublished work in Payload's own admin UI and confirms it on the live
site after publishing.

Note the wording that matters for an editor: **saving a draft does not unpublish a page.** Payload
writes drafts to the versions table only, so the last published state stays live until the page is
explicitly unpublished (a non-draft save with `_status: draft`), at which point the service read
returns `{}` and the page falls to its "not published yet" state.

### An empty CMS is a page state, never a 404

`GET /content/globals/about-us` answers **200 with `{ available: false, content: null }`** when the
Global is unpublished, empty or has no heading, and **503 `UPSTREAM_UNAVAILABLE`** when the CMS is
unconfigured, unreachable or answers badly. `NOT_FOUND` is reserved for a Global _name_ the API does
not serve, decided before any CMS call.

The three are kept apart because they are three different facts: the platform serves no such
resource; an editor has not published one yet; the CMS did not answer. Only the first is about the
URL. Payload's raw `{}` never reaches a consumer — `available: false` is the API's own statement.

`apps/web` renders a deliberate state for each — "not published yet" for the second, "unavailable"
for the third and for a 404 (which, for a name the frontend hardcodes, can only mean a broken
deployment) — and **HTTP 200 for all of them**. A canonical 404 on `/about-us` would state that the
company has no About page, to a visitor and to a crawler that will act on it. This is
[ADR-010](../ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7's rule held for a
corporate route.

Optional sections behave the same way one level down: a section the editor has written nothing for is
`null` on the wire and is not rendered, so the page can be published a section at a time and never
shows a heading over an empty band.

### The fixture is gone; published copy stays in Payload

`apps/web/src/features/about/about-data.ts` — the typed fixture the page rendered until this gate —
**was deleted, not kept as a fallback.** Two sources of truth for one published page is precisely
what the cutover policy exists to prevent, and a page that silently falls back to code would hide
from everyone that the CMS is empty. `/design-proof/about-us` reads the same endpoint, so it shows
what a visitor would see.

**No frontend fixture is a fallback.** On 27 August 2026 the user explicitly approved the English
editorial master and its publication. `apps/cms/src/editorial/publish-company-pages.ts` performs the
same Payload update as an editor, behind an explicit arming variable, and leaves the Global under
normal draft/publish control. It also registers the approved generated team photograph in Payload
Media; it performs no direct SQL write.

### Still not implemented

The ten remaining Globals, `ProductCategoryContent`, `Certifications`, `JobOpenings`, `FaqEntries`,
and every canonical legal or Contact Us page. **Header, Footer, Settings and site navigation remain
code-owned by decision**, not merely unbuilt: reading them from the CMS would put a content call in
the root layout of every page on the site, and that is its own gate with its own caching and
failure-mode questions.

### A fallback changes the content's language, never the page's

Payload's `fallback: true` serves the **default locale** — `en` — for a field nobody has translated.
That is a fact about the content, and it must not be allowed to become a fact about the URL:
`/ar/about-us` is an Arabic address whose document language is `ar` whether or not an editor has
finished translating the page.

So the two are separated, and each has a test that fails if they are ever conflated:

- **`<html lang>`/`<html dir>` come from the route's `Locale` row and from nothing else** — not from
  the content, not from the API response, not from the fallback flag (`app/[locale]/layout.tsx`,
  asserted by `layout.spec.tsx`).
- **The content that actually fell back is annotated where it sits.** `<main>` carries `lang` and
  `dir` for the locale the CMS served, which is WCAG 2.2 AA 3.1.2 Language of Parts, and keeps a
  left-to-right fallback readable inside a right-to-left document. A short `role="note"` says the
  page has not been translated — the same thing the legal and blog templates already say.

Note that the fallback target is **always the default locale**: an untranslated `ar` page is served
in English, never in Persian. There is no locale chain, and none is to be invented.

## The CustomizedSolutions Global — built 20 August 2026 (CMS-2A)

The second company Global, and a deliberately smaller one: three sections of copy around a form that
is not this Global's business at all. It reuses the CMS-1 path unchanged —
Payload Global → NestJS Content module → `apps/web` — and adds no architecture.

### The schema is the page, and nothing more

`apps/cms/src/globals/customized-solutions.ts` models `hero`, `introduction` and `process`, plus the
shared `seoFields()` group.

**`whatCanWeCustomize`, `privateLabelProgramme` and `caseExamples` are deliberately absent** — the
five entries are named in no approved document, neither private-label list is written and the minimum
order quantity is unconfirmed, and the case examples are marked at source as placeholders pending
real, customer-approved cases. Step _descriptions_ are absent for the same reason: the six step names
are transcribed from the documentation and no description exists for any of them. **No media field**
exists, because the page reserves no photograph.

### The form is Prisma's and the API's, and the CMS cannot reach it

The Custom Product Request form under this page's request anchor stays entirely code-owned:
`apps/web/src/features/customized-solutions/solutions-form.ts` holds its fourteen fields, their
labels, the Incoterm options and the consent text, beside the DTO and the
`custom_formulation_requests` columns they mirror. An editor renaming a label in a CMS text input
could otherwise produce a form the database refuses.

Two consequences are worth stating because they are load-bearing:

- **The form renders in every state**, including "not published yet" and "unavailable". An editorial
  outage must never take a working lead-capture path off the site. This is the one deliberate
  difference from the About Us unavailable state, which has nothing to offer when its Global is
  empty.
- **A CMS test asserts the boundary**, failing if any request-form field name appears in the Global's
  schema, and an API test asserts it again on the response.

### Two kinds of action, and only one has a destination in the CMS

The hero offers a **route action** (`{ label, route }`, the shared `ContentRouteKey` vocabulary) and a
**request action** that jumps to the form on this same page. The request action carries **a label and
nothing else**: its target is `ANCHORS.request` in `apps/web`, and the API's projection discards any
`route`, `href`, `target` or `anchor` found in the document.

The route-key vocabulary was **not** widened with page anchors. An anchor id is part of a URL people
share and part of the markup that declares it; mixing the two vocabularies would let an edit break a
fragment, and would put page structure into a list that describes pages.

### Everything else is the CMS-1 contract, unchanged

Draft/publish with **`readVersions: editorOnly`** — explicit, because Payload defaults it for no
Global and `executeAccess` grants any authenticated identity when it is absent. Preview remains
deferred. Unpublished answers `200 { available: false, content: null }`, never `NOT_FOUND`; an
unrecognised Global name is a 404 before any CMS call; a CMS failure is 503; and `apps/web` renders
HTTP 200 with a deliberate state for each, never `notFound()`.

The route/document locale stays the route's under a fallback, and the fallback content is annotated
with the locale actually served — the same split `layout.spec.tsx` and the page specs hold for
About Us.

**The behaviour that must not vary between Globals is now one implementation**, not one per page:
`apps/api/src/modules/content/content-global.reader.ts` performs every Global read — never asking for
a draft, turning Payload's empty document into `available: false`, and measuring the locale fallback
with a second cheap read. A third Global is a projection, a service and a line in the controller's
dispatch table.

### The fixture is gone, and no approved copy exists

`solutions-data.ts` was deleted. Its **form** half survives as `solutions-form.ts` and its anchors as
`solutions-anchors.ts`, because neither was ever editorial. No fixture copy was seeded into
`sam_cms`, and none may be: publishing this page is an editorial act performed in the admin UI.
`/design-proof/customized-solutions` reads the same endpoint, so there is one source of truth.

### Remaining CMS slices

Home, Products Landing, Export & Logistics, Quality & Certifications, Contact Us and FAQ Page
Globals; `ProductCategoryContent`, `Certifications` (with its Admin-only publish gate),
`JobOpenings` and `FaqEntries`. **Header, Footer, Settings and site navigation remain code-owned by
decision**, not merely unbuilt: reading them from the CMS would put a content call in the root layout
of every page on the site.
