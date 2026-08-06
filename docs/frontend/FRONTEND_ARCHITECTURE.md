# Frontend Architecture Plan (`apps/web`)

Written before `apps/web` is scaffolded — this is the plan the scaffold will follow, not a description of code that exists yet. It synthesizes decisions already made in [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md), [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md), [CODING_STANDARDS.md](../CODING_STANDARDS.md), [API_DESIGN.md](../API_DESIGN.md), and [i18n/INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md) into one concrete frontend structure. Where this document makes a genuinely new call not already settled elsewhere, it's marked **[NEW DECISION]** so it's easy to find and revisit. No frozen architecture (ADR-001/002/003) is touched — `apps/web` still only ever calls NestJS (ADR-003), and everything below operates inside that boundary.

---

## 1. Next.js App Router Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── [locale]/                        # every user-facing route lives under the locale segment
│   │   │   ├── layout.tsx                   # <html lang dir>, message catalog, providers (see §7)
│   │   │   ├── page.tsx                     # Home
│   │   │   ├── about-us/page.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx                 # landing: 6 category cards + Product Finder + Documentation
│   │   │   │   ├── finder/page.tsx
│   │   │   │   └── [categorySlug]/page.tsx  # ONE of the 6 category pages — see §3 note
│   │   │   ├── customized-solutions/page.tsx
│   │   │   ├── export-logistics/page.tsx
│   │   │   ├── quality-certifications/page.tsx
│   │   │   ├── insights/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [postSlug]/page.tsx
│   │   │   ├── contact-us/
│   │   │   │   ├── page.tsx
│   │   │   │   └── request-a-quote/page.tsx      # pre-filtered Inquiry form
│   │   │   ├── become-a-distributor/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── careers/page.tsx
│   │   │   ├── privacy-policy/page.tsx
│   │   │   ├── terms-of-use/page.tsx
│   │   │   ├── cookie-notice/page.tsx
│   │   │   ├── general-sales-conditions/page.tsx
│   │   │   ├── sitemap/page.tsx              # the HTML sitemap page — distinct from sitemap.ts below
│   │   │   ├── thank-you/page.tsx
│   │   │   └── not-found.tsx
│   │   ├── (admin)/                          # ADMIN AREA — route group, outside [locale] (see below)
│   │   │   ├── layout.tsx                   # admin shell; auth-gated, no public chrome
│   │   │   ├── login/page.tsx
│   │   │   └── admin/
│   │   │       ├── page.tsx                 # dashboard overview
│   │   │       ├── products/                # catalog CRUD
│   │   │       ├── blog/
│   │   │       ├── leads/                   # inquiries, formulation requests, distributor apps, downloads
│   │   │       ├── job-applications/        # Admin role only
│   │   │       ├── newsletter/
│   │   │       ├── users/
│   │   │       ├── locales/
│   │   │       ├── redirects/
│   │   │       └── translations/
│   │   ├── sitemap.ts                       # global, outside [locale] — produces sitemap.xml, aggregates every locale
│   │   └── robots.ts                        # global, outside [locale] — disallows /admin
│   ├── components/                          # cross-page, non-page-specific building blocks (§4)
│   ├── features/                            # page/domain-specific composed sections (§5)
│   ├── lib/
│   │   ├── api-client.ts                    # §11
│   │   └── seo.ts                           # SeoFields → Next.js Metadata mapping (§12)
│   └── messages/                            # next-intl catalogs: en.json, fa.json, ar.json
├── middleware.ts                            # locale detection + Redirect lookup (§2)
├── next.config.ts
└── package.json
```

Route tree updated to match [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)'s full 27-page sitemap (the "Completed" structure document superseded the earlier 6-page version this tree originally followed). Legal pages (`privacy-policy`, `terms-of-use`, `cookie-notice`, `general-sales-conditions`) render Payload `Pages` content directly with minimal bespoke layout — no dedicated `features/` folder needed for them, unlike the content-heavy pages.

**[NEW DECISION]** No Payload-style catch-all `[...slug]` route. Every page above gets its own explicit route file, because per [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md) every bespoke page is a composition of named components (`LuxuryHero`, `ManufacturingJourney`, etc.), not a generic block-renderer reading arbitrary Payload content. Payload/Prisma still supply every piece of *content* (text, images, SEO data) into these fixed layouts — only the layout shape is code, not CMS-configured. If a genuinely flexible landing-page builder is ever needed, that's a new route pattern added later, not a retrofit of these.

**[NEW DECISION] The Admin Dashboard sits outside the `[locale]` segment**, in an `(admin)` route group — so its URLs are `/admin/...`, never `/en/admin/...`. Approved as an area inside `apps/web` rather than a fourth app ([ARCHITECTURE.md](../ARCHITECTURE.md#admin-dashboard)); this settles where it goes in the tree.

Putting it under `[locale]` would produce three URLs for one internal tool (`/en/admin`, `/fa/admin`, `/ar/admin`), pull it into `generateStaticParams`' per-locale route generation, and drag SEO machinery — canonical URLs, `hreflang`, sitemap inclusion — onto a surface that must never be indexed at all. Outside `[locale]`, non-indexability is structural rather than a set of exclusions someone has to remember.

**Admin UI language is a user preference, not a route.** The distinction is worth stating plainly: on the public site, locale is *routing* (it's in the URL, it's an SEO surface, each locale is independently indexable); in the admin area, locale is *preference* (which language the tool's chrome renders in). `next-intl`'s non-routing API covers the latter without a URL segment. Content being edited still carries its own locale — an editor works on `fa` product translations through an English-chrome admin UI, and the two are unrelated concerns.

**[CONFIRMED by SITE_STRUCTURE.md]** Product category pages are **single-level** — `/products/[categorySlug]/page.tsx` only, no `[productSlug]` detail route. The site structure source of truth settles this directly: its Sitemap sheet lists exactly six Level-2 product URLs (`base-oils`, `lubricant-additives`, ..., `antifreeze-coolants`) with no Level-3 per-SKU pages, and each `P1`–`P6` sheet confirms individual grades/SKUs (SN 150, SN 350, Bright Stock, etc.) are sections *within* one category page, not separately routed. This replaces the two-level `[categorySlug]/[productSlug]` structure in the original draft of this document — that was a reasonable guess at the time, made before the full structure existed; it's now superseded, not just revised.

---

## 2. Locale Routing Structure

- **`middleware.ts` handles three concerns, in this order:**
  1. **Admin paths short-circuit first.** `/admin/*` and `/login` skip locale resolution entirely (they aren't locale-routed) and go straight to the session check — unauthenticated requests redirect to login before any page renders, never serving a shell that fetches and fails ([SECURITY.md](../SECURITY.md#admin-dashboard-access)).
  2. `next-intl` locale detection/redirect for everything else (per [i18n strategy §2](../i18n/INTERNATIONALIZATION_STRATEGY.md#2-frontend-internationalization-next-intl)).
  3. `Redirect` table lookup (via `GET /api/v1/seo/redirects`) within the resolved locale.

  Order matters: running locale resolution on an admin path would rewrite `/admin` to `/en/admin` before the auth check ever sees it.
- `generateStaticParams` for the `[locale]` segment calls `GET /api/v1/locales` at build time — the route tree is generated from the `Locale` table, not a hardcoded `['en','fa','ar']` array, so a new locale needs no route code change (per [i18n strategy §1](../i18n/INTERNATIONALIZATION_STRATEGY.md#1-url-strategy)).
- `app/[locale]/layout.tsx` sets `<html lang={locale} dir={direction}>` from that same locale data — `direction` travels with the locale record, never inferred client-side.

**[CONFIRMED]** URL segments for the structural brand pages (`about-us`, `products`, `customized-solutions`, `export-logistics`, `quality-certifications`, `insights`, `contact-us`, `become-a-distributor`, `faq`, `careers`, `privacy-policy`, `terms-of-use`, `cookie-notice`, `general-sales-conditions`, `sitemap`, `thank-you` — the full structural page set per [SITE_STRUCTURE.md §0](../SITE_STRUCTURE.md#0-full-sitemap), not just the original six) are **fixed English strings, identical across every locale** — e.g. `/en/about-us`, `/fa/about-us`, `/ar/about-us` all share the same `about-us` segment, never a translated one. **Localized slugs are reserved for SEO-driven content only — Products, Categories, and Blog articles** — resolved server-side against `ContentTranslation` (per [i18n strategy §3](../i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization)). This was flagged as a new, revisit-if-wrong call in the original draft of this document; it's now a confirmed decision, not an open one — the reasoning stands as written: the structural pages are few, fixed, and primarily navigational, so keeping their URLs identical across locales keeps the site's IA legible and avoids three parallel route trees for pages that are otherwise structurally identical, while the actual localized-slug SEO value is concentrated exactly where it's kept — Products, Categories, and Blog articles.

---

## 3. Page Architecture

Per-page composition, cross-referencing [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)'s sections against [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md)'s named components:

| Page | Route | Primary feature components | Data source |
|---|---|---|---|
| Home | `/[locale]` | `LuxuryHero`, `ProductEcosystemPreview`, `WhyChooseSamGroup`, `IndustriesWeServe`, `CustomFormulationHighlight`, `EditorialInsights` | Payload (Pages) + Prisma (Products, BlogPost) via NestJS |
| About Us | `/[locale]/about-us` | `LuxuryHero` (shared), `CompanyMilestones`, `OurExpertise`, `QualitySnapshot`, `OurTeam`, `PartnershipCTA` — `CompanyMilestones`/`OurTeam` are repeater-driven, zero hardcoded items (§10) | Payload (Pages) |
| Products (landing) | `/[locale]/products` | `ProductEcosystem` (category cards), `ProductFinderTeaser` | Prisma (Category) |
| Product Finder | `/[locale]/products/finder` | `ProductFinder` (filter/search UI) | Prisma (Product, Category) — client-side filtering over a server-fetched list |
| Product category page (×6) | `/[locale]/products/[categorySlug]` | `ProductEcosystem` (category mode: range accordion, `SpecificationTable`, applications, industries, packaging) | Prisma (Product, Specification, Media) — **one page renders every product/grade in its category; see §1's routing note** |
| Customized Solutions | `/[locale]/customized-solutions` | `CustomizationProcess` (GSAP, §8), `PrivateLabelProgramme`, `CaseExamples`, `CustomFormulationRequestForm` | Payload (Pages) + Prisma (`CustomFormulationRequest` on submit) |
| Export & Logistics | `/[locale]/export-logistics` | `GlobalExportMap`, `ManufacturingJourney` (GSAP, §8), `IncotermsBlock` | Payload (Pages) + Mapbox (client) |
| Quality & Certifications | `/[locale]/quality-certifications` | `ResearchLaboratory` (proposed home — see below), `CertificationsGrid`, `SamplingPolicy` | Payload (Pages) |
| Insights (Blog index + article) | `/[locale]/insights`, `/[locale]/insights/[postSlug]` | `EditorialInsights` | Prisma (BlogPost, BlogCategory, BlogTag) |
| Contact Us | `/[locale]/contact-us`, `/[locale]/contact-us/request-a-quote` | `InquiryForm`, `PartnershipCTA` | Payload (Pages) + Prisma (`Inquiry` on submit) |
| Become a Distributor | `/[locale]/become-a-distributor` | `DistributorApplicationForm` | Payload (Pages) + **new entity needed, not yet in `DATA_MODEL.md`** — see [SITE_STRUCTURE.md](../SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure) |
| FAQ | `/[locale]/faq` | `FaqAccordion` | Payload content (likely a new collection — not yet modeled) |
| Careers | `/[locale]/careers` | `JobListings`, `SpeculativeApplicationForm` | Payload (Pages) + **new entity needed** — see `SITE_STRUCTURE.md` |
| Legal pages (×4) | `/[locale]/privacy-policy`, `/terms-of-use`, `/cookie-notice`, `/general-sales-conditions` | None bespoke — rendered directly from Payload `Pages` content | Payload (Pages) |
| Thank You | `/[locale]/thank-you` | Minimal — confirmation message + next-step links, fires analytics conversion event | Static/CMS text |

**`ResearchLaboratory` now has a proposed home**: Quality & Certifications' "Laboratory Capability" section ([SITE_STRUCTURE.md §7](../SITE_STRUCTURE.md#7-quality--certifications--new-page)) is the first concrete content anchor this component has had — it didn't map to anything in the previous site structure. Still a proposal, not a confirmed design/content decision — see Open Items.

---

## 4. Component Hierarchy

Three layers, each with a distinct rule about what it's allowed to know:

1. **`packages/ui`** — brand primitives with zero business/CMS/data-fetching logic: `Button`, `Container`, `Section`, `Typography`, `IndustrialGlassPanel`. Pure props in, JSX out. Reusable by any future app (Customer Portal, etc.), not just `apps/web`.
2. **`apps/web/src/components`** — composed but still page-agnostic: `Header`, `Footer`, `LocaleSwitcher`, `Breadcrumbs`, `JsonLd`, `WhatsAppCta`. Cross-cutting, used on every page, still no single-page-specific content.
3. **`apps/web/src/features/<domain>`** — the named, bespoke components from the design direction: `LuxuryHero`, `ProductEcosystem`, `GlobalExportMap`, `ManufacturingJourney`, `EditorialInsights`, `PartnershipCTA`, plus `CustomizationProcess`, `ResearchLaboratory` (proposed home: Quality & Certifications, §3), and the plainer form/list components the expanded site structure now requires: `ProductFinder`, `CertificationsGrid`, `FaqAccordion`, `DistributorApplicationForm`, `JobListings`. These own their section's specific content shape and any client-side behavior (animation, 3D, map, filtering).

Route files (`app/[locale]/**/page.tsx`) are the thinnest layer: server-side data fetch, then compose `features/*` components in the order `SITE_STRUCTURE.md` specifies. A page file with real layout logic in it is a sign something belongs in `features/` instead.

`IndustrialGlassPanel` lives in `packages/ui`, not `features/`, despite being named alongside the page-specific components in the design brief — it reads as a reusable visual primitive (a styled surface treatment), not a page section, consistent with how it was already categorized during the design-direction review.

---

## 5. Feature Organization

`features/` is organized by **domain, not technical type** — mirrors the backend's "one module = one business capability" rule ([CODING_STANDARDS.md](../CODING_STANDARDS.md#folder-structure)) applied to the frontend:

```
features/
├── home/
├── about/
│   └── company-milestones.tsx
├── products/
│   ├── product-ecosystem.tsx
│   ├── product-finder.tsx
│   └── specification-table.tsx
├── customized-solutions/
│   ├── customization-process.tsx
│   ├── private-label-programme.tsx
│   └── case-examples.tsx
├── export-logistics/
│   ├── global-export-map.tsx
│   ├── manufacturing-journey.tsx
│   └── incoterms-block.tsx
├── quality-certifications/
│   ├── research-laboratory.tsx        # proposed — see §3
│   └── certifications-grid.tsx
├── blog/                               # folder name kept as "blog" internally even though the route/nav label is "Insights" — avoids churn if the public label changes again
│   └── editorial-insights.tsx
├── faq/
│   └── faq-accordion.tsx
├── careers-partners/
│   ├── distributor-application-form.tsx
│   └── job-listings.tsx
└── forms/                              # shared across pages — see below
    ├── custom-formulation-request-form.tsx
    ├── inquiry-form.tsx
    └── use-form-submit.ts
```

`forms/` is the one feature folder organized by capability rather than page, because every submission form shares submission/validation/error-display logic regardless of which page embeds it — duplicating that per-page would violate [CODING_STANDARDS.md](../CODING_STANDARDS.md)'s "never generate duplicated code" rule ([AI_RULES.md](../AI_RULES.md)) more than it would violate the domain-organization convention. All backing entities now exist in [DATA_MODEL.md](../DATA_MODEL.md), so `distributor-application-form.tsx` and the job-application/CV form should move here alongside the others rather than staying in `careers-partners/` — the reason they were kept separate (no backing entity to share logic against) no longer applies. **There is no separate sample-request form**: "Request Sample" CTAs open the Inquiry form pre-filled with the product, per the approved merge.

---

## 6. Design System Architecture

- **Tokens as data, not just Tailwind config**: colors, spacing, and type scale are defined once as plain TypeScript constants in `packages/ui` (e.g. `tokens.ts`), and both Tailwind's theme (via the future `packages/config` Tailwind config) *and* non-CSS consumers — Three.js materials, Mapbox style JSON, neither of which can read a Tailwind class — import from that same source. One value, three consumers, never redefined per-consumer.
- **`packages/ui` is a systems library, not a themed component kit.** Given the design direction explicitly rejects "generic SaaS layouts," heavily pre-skinned components (an opinionated `Card`, a fully-styled `Hero`) would push every page toward the same templated look the brief is trying to avoid. Primitives stay minimal (layout, spacing, base typography); visual personality lives in `features/`, composed per page.
- **Typography**: Latin faces (Inter, Neue Haas Grotesk style, Helvetica Neue style) load via `next/font`, subset to Latin only. The RTL-capable pairing for Persian/Arabic is **still an open decision** (candidates proposed in the i18n strategy, not confirmed) — the design system's font-loading mechanism must key off `Locale.direction`/`code` so swapping in the confirmed RTL faces later is a token change, not a component rewrite.

---

## 7. Server Component vs. Client Component Rules

Default is Server Component — that's the App Router default and the right one for a content-heavy, SEO-critical site. `"use client"` is added only where one of these is true, and always at the smallest component that needs it, never at a page or layout root (already stated as a best practice in [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md); this is where it becomes a hard rule with named cases):

| Needs client | Because |
|---|---|
| `LuxuryHero`, `EditorialInsights` card reveals, etc. (Framer Motion) | Animation hooks require the client runtime |
| `ManufacturingJourney`, `CustomizationProcess` (GSAP/ScrollTrigger) | DOM refs + scroll listeners |
| `GlobalExportMap` (Mapbox), any Three.js/R3F canvas | Browser-only WebGL/map APIs |
| `CustomFormulationRequestForm`, `InquiryForm` | Form state, client-side validation feedback |
| `LocaleSwitcher` | Client-side navigation on click |

Data fetching happens server-side (in the page or a server-side feature wrapper) and is passed down as props — a Client Component leaf does not call the API client directly to *read* data. The one exception is form **submission**, which goes through a Next.js Server Action (§11), not a client-side `fetch` — the component is a Client Component for interactivity, but the mutation itself still runs server-side.

---

## 8. Animation Architecture (Framer Motion / GSAP)

Two libraries, two non-overlapping jobs (already decided in [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md); restated here as the enforced boundary):

- **Framer Motion** — default for everything: enter/exit, hover/focus micro-interactions, page/route transitions, card reveals. Variants co-located with the component they animate.
- **GSAP + ScrollTrigger** — reserved for exactly two scroll-choreographed sequences: `ManufacturingJourney` (Export & Logistics' production pipeline) and `CustomizationProcess` (Customized Solutions' 6-step process). Both content-driven, both already identified as the concrete use case, not decorative motion.
- Every GSAP timeline is set up in a `useEffect`, torn down with `.kill()` on unmount (route changes are client-side; a leaked timeline from a previous page is a real bug class here).
- Both libraries gate through `prefers-reduced-motion` (Framer Motion's `useReducedMotion()`, GSAP's `matchMedia`) — not optional, checked in code review.
- RTL: directional transforms (`translateX`, rotation) in either library must branch on `Locale.direction` and sign-flip — flagged as a concrete risk in the i18n strategy; this is where that risk gets an implementation owner (the two GSAP sequences above, plus any Framer Motion slide-direction animation).
- Governance: if a component reaches for GSAP for something Framer Motion already covers, that's a review flag, not a style preference — prevents the "two libraries doing the same job in different places" drift named in `FRONTEND_STACK.md`.

---

## 9. Three.js Integration Strategy

- React Three Fiber + Drei only, never raw Three.js in component code (per [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md)).
- **Placement is still a proposal, not confirmed** — packaging visualization (Bulk/Drums/IBC Tanks, per Export & Logistics and Customized Solutions content) is the content-grounded candidate, but this is an open thread ([/AI_CONTEXT.md](../../AI_CONTEXT.md)), not a decision this document is making.
- Wherever it lands: `next/dynamic` with `ssr: false`, mounted only when its section scrolls into view (`IntersectionObserver`), one `<Canvas>` maximum per page.
- Every 3D visual ships with a real text/image fallback — both for the pre-mount state and for browsers without WebGL (feature-detected) — never 3D-only content, matching the accessibility rule already set in `FRONTEND_STACK.md`.
- Assets: glTF/GLB only (from Blender, per `FRONTEND_STACK.md`), loaded via Drei's `useGLTF` inside a `Suspense` boundary.

---

## 10. Payload CMS Data Fetching Strategy

`apps/web` never calls Payload — this is ADR-003, not a new rule, but here is exactly how it plays out in code: every Payload-backed page (Pages, Menus, Footer, Settings) is fetched through NestJS's `/api/v1/content/*` endpoints (per [API_DESIGN.md](../API_DESIGN.md)), server-side, in the route's `page.tsx`/`layout.tsx`. There is no code path in `apps/web` that constructs a Payload URL or imports a Payload client — if one ever appears, that's a violation of a frozen decision, not a style choice.

- **Caching**: NestJS's Content module already caches CMS content aggressively ([SEO_ARCHITECTURE.md §6](../seo/SEO_ARCHITECTURE.md#6-performance-seo)). `apps/web` layers Next.js's own fetch cache / tag-based revalidation on top for CMS-backed routes.
- **Open follow-up, not built here**: cache invalidation currently relies on TTL expiry; a publish-triggered revalidation path (Payload publish → NestJS → an `apps/web` revalidation call) would close the gap between "content published" and "site updated" but isn't specified anywhere yet. Worth adding to `API_DESIGN.md` in a future pass — flagged here, not designed here, since it's a backend contract change and out of scope for a frontend-only document.

### CMS Content Modeling Rules

Every Payload-backed page — About Us is the clearest example, but this applies to every `[CMS]`-tagged section in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md), not just that page — must be edited to completion **without a code change**. Three concrete rules that make that actually true, not just aspirational:

1. **No hardcoded lists.** Any component rendering a grid or list of cards — `CompanyMilestones`, `OurTeam`, `WhyChooseSamGroup`, `OurExpertise`, `CertificationsGrid`, `FaqAccordion`, and every other repeating-card section named throughout `SITE_STRUCTURE.md` — takes its items as a prop **array sourced entirely from a Payload repeater/array field**. Zero items hardcoded in component source, ever. Adding, removing, or reordering an item (a new milestone, a new team member, a new certification) is a CMS-only content edit. A component with a fixed number of rendered items (`<Card1 /><Card2 />...`) instead of `.map()`-ing over a prop is a defect, same severity as a hardcoded i18n string ([CODING_STANDARDS.md](../CODING_STANDARDS.md#internationalization)).
2. **Payload's own Media/upload collection handles images and video for Payload-owned pages — not Prisma's `Media` table.** The polymorphic `Media` entity in [DATA_MODEL.md](../DATA_MODEL.md) backs Prisma-owned content (Products, BlogPosts) in `sam_platform`; it has no reach into `sam_cms` and shouldn't be queried for About-Us-style content. Payload's built-in upload/media collection (native video support included) is the correct and only place Payload-owned pages' images/videos live — this follows directly from ADR-002's database split, just stated explicitly here since it hasn't been before.
3. **Every field — including array/repeater items' own sub-fields — is localized per [i18n strategy §3](../i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization).** A `CompanyMilestones` entry's `title`/`description` need their own `en`/`fa`/`ar` values the same way a simple text field would; Payload supports localizing fields inside an array, but this has to be turned on deliberately per field when the collection is built — it isn't automatic just because the parent page is localized.

---

## 11. API Communication Layer

A single typed client, `src/lib/api-client.ts`:

- One function per resource (`getProducts()`, `getProductBySlug()`, `getPage()`, ...), typed against `@sam-group/types` (per [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)), matching the `{ data, meta }` / `{ error }` envelope in [API_DESIGN.md](../API_DESIGN.md) exactly — the client is a thin wrapper, not a place where response shape gets reinvented per call site.
- Every call carries the current route's `locale` (per [API_DESIGN.md §Locale-Aware Requests](../API_DESIGN.md#locale-aware-requests)) and, when a session exists, the `Authorization: Bearer` header.
- **Reads**: Server Components call the client directly, server-side, so responses can participate in Next.js's fetch cache.
- **Writes** (form submissions — `Inquiry` including "Request Sample" CTAs, `CustomFormulationRequest`, `DistributorApplication`, `JobApplication`, `DownloadRequest`, `NewsletterSubscription` — all now modeled in [DATA_MODEL.md](../DATA_MODEL.md)): Next.js **Server Actions**, not client-side `fetch`. A form is a Client Component for interactive validation feedback, but the actual POST to NestJS runs in a Server Action, keeping the mutation server-side and taking advantage of React 19's Actions model already noted as a reason for choosing React 19 in [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md). **[NEW DECISION]** — not previously specified anywhere; Server Actions over client-side POSTs because it keeps API error handling and auth-header attachment in one server-side place rather than duplicated across every form component.
- Errors from NestJS's `{ error: { code, message, details } }` shape are normalized into a small typed error the UI branches on (validation vs. auth vs. server) — never rendering a raw message or stack trace, consistent with the backend-side rule already in `API_DESIGN.md`.

---

## 12. SEO Integration

- Every route exports `generateMetadata`, calling the API client server-side and mapping the normalized `SeoFields` shape ([SEO_ARCHITECTURE.md §2](../seo/SEO_ARCHITECTURE.md#2-reusable-seo-model--field-contract)) onto Next.js's Metadata API (`title`, `description`, `alternates.canonical`, `openGraph`, `twitter`, `robots`).
- `alternates.languages` (hreflang) is populated from the per-locale translation-existence check already specified in [i18n strategy §4](../i18n/INTERNATIONALIZATION_STRATEGY.md#4-seo-localization) — omitted, not stubbed, for locales without a real translation.
- `app/sitemap.ts` and `app/robots.ts` (outside `[locale]`, per §1) call `GET /api/v1/seo/sitemap-entries` / the environment-aware robots rule from [API_DESIGN.md](../API_DESIGN.md).
- **JSON-LD** renders through one shared `<JsonLd>` component (§4) taking a typed schema object per the SEO Master table in [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master) — never hand-written inline per page, so the structured data can't drift from a shared shape. `FAQPage` applies to every product category page plus `/faq` itself, sourced from the shared `FaqEntries` collection ([SEO_ARCHITECTURE.md §8](../seo/SEO_ARCHITECTURE.md#8-structured-data-schemaorg)).
- **Breadcrumbs**: one component renders both the visible nav *and* feeds the `BreadcrumbList` JSON-LD from the same data object — per [SEO_ARCHITECTURE.md §4](../seo/SEO_ARCHITECTURE.md#4-next-js-seo-consumption)'s rule that the two must never diverge.

---

## 13. Performance Rules

Concrete, not aspirational — extends the Core Web Vitals budget already set in [SEO_ARCHITECTURE.md §6](../seo/SEO_ARCHITECTURE.md#6-performance-seo) (LCP < 2.5s, INP < 200ms, CLS < 0.1) with frontend-specific rules:

- **[NEW DECISION]** First-load JS budget: **≤ 200KB gzipped** per route, excluding lazy-loaded chunks (3D, Mapbox). Not previously stated anywhere; set here as a concrete, checkable number rather than leaving "performance focused" (the design brief's own phrase) unmeasurable.
- Images: `next/image` everywhere, explicit width/height (no layout shift), AVIF/WebP.
- Fonts: `next/font`, Latin subset for `en`; the RTL font pairing (once confirmed) loads only on `fa`/`ar` routes, never bundled into every locale's initial load.
- Heavy client libraries (Three.js/R3F, Mapbox) are always `next/dynamic`, never in a page's initial bundle — this is a build-time enforceable rule, not just a convention.
- One `<Canvas>` per page, maximum, per §9.
- Server Components by default (§7) — the less that needs `"use client"`, the smaller the shipped JS, directly.
- Turborepo's build cache (already configured at the monorepo level) applies to `apps/web`'s build automatically once its `package.json` declares matching task names — no additional configuration needed here.

---

## Decisions Log

Confirmed after this document's initial draft:

1. **Structural brand pages keep fixed English URL segments across all locales** (`/en/about-us`, `/fa/about-us`, `/ar/about-us`); **localized slugs are reserved for SEO-driven content only — Products, Categories, and Blog articles.** See §2.
2. **Product category pages are single-level, no per-SKU detail route** — confirmed directly by the site structure source of truth's Sitemap sheet, not an inference. See §1.
3. **Mapbox's placement (`GlobalExportMap`, Export & Logistics) is now confirmed**, not just proposed — the site structure source of truth explicitly calls for "interactive or illustrated map plus regional cards" on that page's Global Reach section.

## Open Items (not resolved by this document)

1. `ResearchLaboratory`'s page placement — a proposal (Quality & Certifications' Laboratory Capability, §3), still not signed off by content/design.
2. Three.js's exact placement (packaging visualization) — still proposed, not confirmed (§9; tracked in `/AI_CONTEXT.md`). Unlike Mapbox, the site structure source of truth doesn't call for 3D anywhere.
3. RTL typeface pairing (§6; tracked in the i18n strategy's Remaining Decisions).
4. CMS publish → ISR revalidation path (§10) — a future `API_DESIGN.md` addition, not designed here.
5. `DistributorApplicationForm`, `JobListings`, `FaqAccordion`, and `CertificationsGrid` (§4/§5) have no backing `DATA_MODEL.md` entity yet — component shells can be planned, but their data contracts can't be finalized until [SITE_STRUCTURE.md's Data Model Gaps](../SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure) are addressed.
