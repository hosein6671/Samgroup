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
│   │   │   │   └── [slug]/page.tsx          # SHARED: Product Family or Product Detail — ADR-010, see §3 note
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
│   ├── messages/                            # next-intl catalogs: en.json, fa.json, ar.json
│   └── middleware.ts                        # locale detection + Redirect lookup (§2)
├── next.config.ts
└── package.json
```

Route tree updated to match [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)'s full 27-page sitemap (the "Completed" structure document superseded the earlier 6-page version this tree originally followed). Legal pages (`privacy-policy`, `terms-of-use`, `cookie-notice`, `general-sales-conditions`) render Payload `Pages` content directly with minimal bespoke layout — no dedicated `features/` folder needed for them, unlike the content-heavy pages.

**[NEW DECISION]** No Payload-style catch-all `[...slug]` route. Every page above gets its own explicit route file, because per [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md) every bespoke page is a composition of named components (`LuxuryHero`, `ManufacturingJourney`, etc.), not a generic block-renderer reading arbitrary Payload content. Payload/Prisma still supply every piece of _content_ (text, images, SEO data) into these fixed layouts — only the layout shape is code, not CMS-configured. If a genuinely flexible landing-page builder is ever needed, that's a new route pattern added later, not a retrofit of these.

**[NEW DECISION] The Admin Dashboard sits outside the `[locale]` segment**, in an `(admin)` route group — so its URLs are `/admin/...`, never `/en/admin/...`. Approved as an area inside `apps/web` rather than a fourth app ([ARCHITECTURE.md](../ARCHITECTURE.md#admin-dashboard)); this settles where it goes in the tree.

Putting it under `[locale]` would produce three URLs for one internal tool (`/en/admin`, `/fa/admin`, `/ar/admin`), pull it into `generateStaticParams`' per-locale route generation, and drag SEO machinery — canonical URLs, `hreflang`, sitemap inclusion — onto a surface that must never be indexed at all. Outside `[locale]`, non-indexability is structural rather than a set of exclusions someone has to remember.

**Admin UI language is a user preference, not a route.** The distinction is worth stating plainly: on the public site, locale is _routing_ (it's in the URL, it's an SEO surface, each locale is independently indexable); in the admin area, locale is _preference_ (which language the tool's chrome renders in). `next-intl`'s non-routing API covers the latter without a URL segment. Content being edited still carries its own locale — an editor works on `fa` product translations through an English-chrome admin UI, and the two are unrelated concerns.

**[SUPERSEDED BY ADR-007]** — the paragraph below is kept as the record of the decision that stood before [ADR-007](../ADR/ADR-007-product-taxonomy-v2.md) (accepted 12 August 2026) reversed its no-detail-route half. What now applies: the **six Product Family pages remain valid** and are not replaced; **Product Detail routes are approved architecturally**, canonically at `/{locale}/products/{product-slug}`; and **the Product Detail implementation does not yet exist** — no route, no template, no component. The route tree and route tables in this document are therefore unchanged, and describe the frontend as it is planned today rather than as ADR-007 will eventually require.

**[CONFIRMED by SITE_STRUCTURE.md]** Product category pages are **single-level** — `/products/[categorySlug]/page.tsx` only, no `[productSlug]` detail route. The site structure source of truth settles this directly: its Sitemap sheet lists exactly six Level-2 product URLs (`base-oils`, `lubricant-additives`, ..., `antifreeze-coolants`) with no Level-3 per-SKU pages, and each `P1`–`P6` sheet confirms individual grades/SKUs (SN 150, SN 350, Bright Stock, etc.) are sections _within_ one category page, not separately routed. This replaces the two-level `[categorySlug]/[productSlug]` structure in the original draft of this document — that was a reasonable guess at the time, made before the full structure existed; it's now superseded, not just revised.

**[UPDATED BY ADR-010]** — the dynamic segment under `products/` is **`[slug]`, not `[categorySlug]`**, and it is **shared**. [ADR-010](../ADR/ADR-010-products-slug-namespace-and-collision-policy.md) freezes Product Family (`/{locale}/products/{category-slug}`, ADR-009 §1) and Product Detail (`/{locale}/products/{product-slug}`, ADR-007 §2) as one namespace served by one route, `app/[locale]/products/[slug]/page.tsx`, with **one** discriminator resolving which entity a slug names. Sibling `[categorySlug]` and `[productSlug]` routes are not authorized and are not expressible — the App Router rejects two differently-named dynamic segments at one path position, which is why the shared route is a constraint rather than a preference. **Product Family wins** where a slug could be both, and colliding data is invalid rather than merely deprioritised; `finder`, `segments` and `types` are reserved slugs. **Nothing here is implemented**: there is no `[locale]` segment, no products route of any kind, and **no Product Detail route, template, component or fetching** — the six Product Family pages still live on the `/design-proof` routes. ADR-010 authorizes no implementation.

---

## 2. Locale Routing Structure

- **`middleware.ts` handles three concerns, in this order:**
  1. **Admin paths short-circuit first.** `/admin/*` and `/login` skip locale resolution entirely (they aren't locale-routed) and go straight to the session check — unauthenticated requests redirect to login before any page renders, never serving a shell that fetches and fails ([SECURITY.md](../SECURITY.md#admin-dashboard-access)).
  2. `next-intl` locale detection/redirect for everything else (per [i18n strategy §2](../i18n/INTERNATIONALIZATION_STRATEGY.md#2-frontend-internationalization-next-intl)).
  3. `Redirect` table lookup (via `GET /api/v1/seo/redirects`) within the resolved locale.

  Order matters: running locale resolution on an admin path would rewrite `/admin` to `/en/admin` before the auth check ever sees it.

  **[SHIPPED] Concern 1 is implemented.** `src/middleware.ts` short-circuits `/admin/*` and `/login` before locale resolution, `/login` and `/admin` exist, and the cookies this tier owns are fixed. See §2a below for the session model. Concern 3 (`Redirect` table) remains deferred to the gate that creates the first row.

  _Superseded status, kept as the record of what was open: "Concern 1 is still deferred, and its backend blocker is now gone. No admin route, login page or middleware session check exists in `apps/web`… **The HttpOnly refresh cookie is this tier's to own**: NestJS sets and reads none, so the cookie's name, `SameSite`, `Secure` behaviour, `Path` and `Max-Age` are decided by the gate that builds this middleware, and the raw token is forwarded to NestJS as a request value."_

### 2a. Admin Browser Session — [SHIPPED]

**Routes, both outside `[locale]`.** `/login` (the sign-in page — **not** `/admin/login`) and `/admin` (the shell), plus one narrow Route Handler at `/admin/session/end`. All three live in the `(admin)` group and are non-localized: Admin UI language is a preference, not a route. The group carries its own root layout with `robots: { index: false, follow: false, nocache, noarchive }`, so both pages are non-indexable from one declaration. **No global `robots.ts` was added** — that is a public-site file with its own gate.

**Two cookies, both owned by `apps/web`, both `HttpOnly`.**

| Cookie              | Carries                      | `Max-Age` | Attributes                                                                               |
| ------------------- | ---------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `sam_admin_refresh` | the 7-day refresh credential | `604800`  | `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain` (host-only), `Secure` in production |
| `sam_admin_access`  | the 15-minute access token   | `900`     | identical                                                                                |

`Secure` is dropped **only** when `NODE_ENV` is not `production`, so a local non-HTTPS dev server can hold a session; it is never derived from a request header. Both are cleared with the identical name/`Path`/`Domain` triple and `Max-Age: 0`, so a clear cannot leave a shadowing cookie behind. **Nothing is stored in `localStorage` or `sessionStorage`, and neither token is readable by browser JavaScript.**

**Why two cookies rather than one.** Next 15 rejects `cookies().set()` outside the action phase, so a Server Component cannot persist a rotated refresh token — and `POST /auth/refresh` revokes the presented session in the same transaction that mints its replacement. Refreshing during a render would therefore destroy the browser's only credential and be unable to store what replaced it. The access cookie is what lets middleware refresh **only when it is absent** (≈ every 15 minutes) instead of on every navigation. This is the model [SECURITY.md](../SECURITY.md#admin-dashboard-access) already described: "both tokens live in httpOnly cookies, read server-side per request and attached to the outbound NestJS call".

**The access cookie is a credential carrier, never an authority.** `apps/web` reads it server-side and forwards it as `Authorization: Bearer` on the internal hop. **No JWT is decoded anywhere in `apps/web`** — the token carries `sub`/`iat`/`exp` and no role claim, the cookie's `Max-Age` is aligned to the token TTL so the browser dropping it _is_ expiry, and identity and role come from `GET /auth/me`, which re-reads `sam_platform` on every request. NestJS remains the final authorization authority; the `admin`-role check in the shell decides what to render, not what is permitted.

**Middleware refresh lifecycle**, at most once per incoming browser request (middleware runs once per request, so this is structural — no lock, no shared store):

1. access cookie present → continue, no refresh.
2. absent, no refresh cookie → `307` to `/login`.
3. `POST /auth/refresh` **rejected** (401/403) → clear both cookies, `307` to `/login`.
4. **unavailable** (network, timeout, 5xx, non-envelope) → **touch no cookie**, flag the request with `x-sam-admin-session: unavailable`, and let the page render a neutral state.
5. success → set both cookies on the response **and** rewrite the forwarded `Cookie` request header via `NextResponse.next({ request: { headers } })`, so the render that triggered the refresh observes the new token. The header clone must be complete: Next deletes every request header absent from the override list.

**Outage is not an auth failure, anywhere.** 401/403 is auth truth and clears credentials; a network failure or 5xx never does. A backend outage renders "Temporarily unavailable" on `/admin` and "Sign-in is unavailable" on `/login` — never "Invalid email or password", and never a login redirect.

**Wrong role.** An authenticated non-Admin gets a distinct Access-denied page with a sign-out control, not a login redirect — collapsing the two would send someone to re-enter credentials that work.

**Logout.** `signOut` sends `POST /auth/logout` with both factors, then **clears both cookies whatever the API answered** — already-revoked, 401, 5xx, unreachable alike — and redirects to `/login`. It is not retried.

**Stale-credential cleanup.** When `GET /auth/me` refuses an access token the browser still holds (deleted, `disabled`, or predating the credential-revocation cutoff), the render redirects to `/admin/session/end`, a parameterless Route Handler that clears both cookies and lands on `/login`. It exists because a render cannot mutate cookies and a direct redirect would bounce forever against middleware waving the stale cookie through.

**CSRF and caching.** Login and logout are Server Actions: POST-only to an unguessable action id, origin-checked by Next, and both cookies are `SameSite=Strict`. **Future Admin mutations must preserve both properties** — Server Actions or same-origin-checked handlers, never a handler accepting a cross-origin POST. Every Admin route is `force-dynamic` with `revalidate = 0`, and every protected API call is `cache: "no-store"`; no identity, role or auth result is ever cached or prerendered.

**Not built, and deferred to their own gates:** the remaining Admin modules (catalog, blog, users, locales, redirects, translations), password reset/change, MFA/SSO, self-registration, any status- or role-management surface, session-management UI, and refresh-token family reuse detection.

### 2b. Admin Lead Inbox — [SHIPPED]

The first operational Admin module, 19 August 2026. Read-only.

**Routes, under the frozen `leads/` segment** of the §1 tree — the tree gives one segment to all four lead-bearing submissions rather than one per entity, so these are `/admin/leads/...` and not `/admin/inquiries`, even though the **API** paths are `/admin/inquiries` and `/admin/custom-formulation-requests` (API_CONTRACT_FINAL §2.10 names those). A REST resource and a screen in a tool are allowed to differ; the tree is the authority for the second.

| Route                                           | Renders                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| `/admin/leads/inquiries`                        | paged list, with an `?inquiryType=` filter strip |
| `/admin/leads/inquiries/[id]`                   | one submission, grouped for follow-up            |
| `/admin/leads/custom-formulation-requests`      | paged list, no filter                            |
| `/admin/leads/custom-formulation-requests/[id]` | one request                                      |

There is **no page at the bare `/admin/leads`**: two links on the shell is the whole of the navigation this module needs, and a landing page above them would be the beginning of a dashboard. `isAdminSurfacePath` already matches these by prefix, so middleware short-circuits them before locale resolution and no middleware change was needed. The two unbuilt siblings — distributor applications, download requests — have no entity written by any endpoint yet and get no placeholder route.

**BFF only.** Browser → `apps/web` Server Component → NestJS. The access token is read from its HttpOnly cookie inside a `server-only` module and attached as `Authorization: Bearer` on the internal hop; it is never a prop, never in the markup, and never reachable from a browser. No route in this tree is a Client Component. Verified against a production build: the rendered HTML contains no token, no `Bearer`, no cookie name, no API origin and no `/api/v1`, and a browser loading the inbox issues requests to the `apps/web` origin only.

**Five outcomes per read, and collapsing any two would be a bug.**

| API answer                            | What renders                                                     |
| ------------------------------------- | ---------------------------------------------------------------- |
| 2xx                                   | the list (or "No inquiries yet.") / the record                   |
| **401**                               | redirect to `/admin/session/end`, which clears both cookies      |
| **403**                               | "Access denied" — no cookie touched, no login redirect           |
| **404** (detail only)                 | "Not found", with a link back to the inbox                       |
| 5xx, timeout, transport, non-envelope | "Temporarily unavailable" — **never** a 404 and never a sign-out |

The last row is the load-bearing one: **infrastructure failure must never become a missing record.** [ADR-010](../ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7 fixes that for public content, and a lead exists exactly once, so the cost of getting it wrong is higher here — an operator told a submission does not exist stops chasing it.

**Authorization is per area.** `resolveAdminAccess(session, area)` reads a role list per route group, declared in `features/admin/session/admin-areas.ts`:

| Area    | Path              | Roles                                |
| ------- | ----------------- | ------------------------------------ |
| `shell` | `/admin`          | Admin                                |
| `leads` | `/admin/leads/**` | Admin, Content Manager, Sales Expert |

It is an **allow-list**, so an unknown role is refused everywhere, and the default argument is `shell` — an unqualified call cannot accidentally widen a page. The two lists are separate on purpose: the inbox had to admit Content Manager and Sales Expert, per [SECURITY.md](../SECURITY.md#rbac-permission-matrix)'s "Forms & Leads" row, and nothing on the shell is meant for either role yet.

**Entry is all it decides.** Record scoping is NestJS's, from the authenticated caller — `apps/web` sends no `assignedToId` and has no URL spelling for one — so an authorized Sales Expert with no assigned leads sees the ordinary **empty state**, not a refusal. Navigation follows the same area rules, so a Content Manager is not offered a link to `/admin`, and a Customer, whom no area admits, is shown no navigation at all.

**Query vocabulary is read strictly and never proxied.** `page` is parsed and bounded, `inquiryType` matched against the closed list, and anything unrecognised is dropped rather than forwarded — so a hand-edited URL renders page 1 instead of a 400 an operator would read as an outage. Pagination links are built from the parsed query, so nothing the parser refused survives a click. Page size is fixed at 25 by the page, not by the URL. There is **no URL spelling of `assignedToId`**: lead scoping is the server's, per SECURITY.md §RBAC integration.

**Dynamic and uncached.** Every route is `force-dynamic` with `revalidate = 0`, every fetch is `cache: "no-store"`, and the API answers `Cache-Control: no-store`.

**Read-only, and no fabricated content.** No write action of any kind — no status change, assignment, note, tag, delete or export. An empty inbox says so plainly; no sample rows and no metrics are invented to fill it.

### 2c. Admin accessibility — target: WCAG 2.2 AA

**Frozen for the whole Admin UI**, not just this module: `/login`, `/admin`, every `/admin/leads/**` route, and each of the empty, forbidden, not-found and unavailable states.

- **Landmarks and headings.** One `<main id="main-content">` per page — the target of the skip link the `(admin)` root layout already renders, which appears on focus and is the first control Tab reaches. Every `<nav>` carries an accessible name ("Admin modules", "Filter inquiries by type", "Pagination"). One `<h1>` naming the screen, every state a `<h2>`, every detail group a `<section>` with its own `<h2>` and `aria-labelledby`. No level is skipped, and no native landmark is given a redundant `role`.
- **Titles.** Each route sets its own `metadata.title` naming the screen; the group's `noindex, nofollow, nocache, noarchive` is inherited untouched.
- **Tables.** Real `<table>` markup with a visually-hidden `<caption>`, `scope="col"` on every column header and `scope="row"` on the record name. One real link per row — **no clickable row, no clickable `<div>`, no `onClick` anywhere on the surface** — whose accessible name says what it opens ("View inquiry from …") while its visible text stays the record's own. The wide table scrolls **inside its own container**, which carries `tabIndex={0}` and a name so it is scrollable without a pointer; the page body never scrolls sideways.
- **Pagination.** A named `<nav>` around an ordered list: Previous, windowed page numbers each labelled "Page N", Next. The current page carries `aria-current="page"` plus a fill, a border and a weight change. At a boundary, Previous/Next are inert `<span>`s rather than fake disabled links, so a keyboard user never lands on a control that does nothing. Arrows are `aria-hidden`. Hrefs are built from the parsed query, so only recognised parameters survive a click.
- **Dates** render as `<time dateTime>`, carrying the ISO instant beside the human UTC stamp.
- **Status** is text. Nothing on this surface carries meaning by colour, icon or position alone — it has no icons at all.
- **The login form** keeps programmatically associated labels, `autocomplete="username"` / `"current-password"`, and a `role="alert"` banner that is _inserted_ on failure so it announces. Nothing else is a live region, and no submitted value is echoed back.
- **Contrast**, measured against the generated tokens: text ≥ 4.5:1 (lowest 4.62:1), interface components ≥ 3:1. Two component-level corrections were made with existing tokens — interactive boundaries moved from `--color-border-hairline` (1.1:1) to `--color-border-strong` (3.25–3.48:1), and the record link gained vertical padding to meet the 24×24 target minimum. **No palette value was added or changed.** Decorative container edges keep the hairline: §1.4.11 does not cover them.
- **Focus** is a 2px `--color-focus-ring` outline at a non-zero offset on every focusable control, so the ring paints on the surface behind rather than on the control — which is what keeps it visible on the accent-filled button. Nothing removes an outline.
- **Reflow**, verified at 1280px, 375px, and the 640×512 viewport a 1280×1024 window has at 200% zoom: no page-level horizontal scrolling, no clipped control, no overlap, every target ≥ 24×24.
- **Motion.** No animation was added; the transitions here are already zeroed by the design system's `prefers-reduced-motion` block.
- **Language.** Admin stays `lang="en" dir="ltr"` outside locale routing. No Admin translation was invented.

Automated coverage runs in the existing Vitest stack — semantic assertions on the returned trees, plus a contrast suite that reads the real token file — and **no accessibility dependency was added**. What markup cannot decide (focus order, focus visibility, reflow, the accessibility tree itself) was verified in a browser.

- `generateStaticParams` for the `[locale]` segment calls `GET /api/v1/locales` at build time — the route tree is generated from the `Locale` table, not a hardcoded `['en','fa','ar']` array, so a new locale needs no route code change (per [i18n strategy §1](../i18n/INTERNATIONALIZATION_STRATEGY.md#1-url-strategy)).
- `app/[locale]/layout.tsx` sets `<html lang={locale} dir={direction}>` from that same locale data — `direction` travels with the locale record, never inferred client-side.

**[CONFIRMED]** URL segments for the structural brand pages (`about-us`, `products`, `customized-solutions`, `export-logistics`, `quality-certifications`, `insights`, `contact-us`, `become-a-distributor`, `faq`, `careers`, `privacy-policy`, `terms-of-use`, `cookie-notice`, `general-sales-conditions`, `sitemap`, `thank-you` — the full structural page set per [SITE_STRUCTURE.md §0](../SITE_STRUCTURE.md#0-full-sitemap), not just the original six) are **fixed English strings, identical across every locale** — e.g. `/en/about-us`, `/fa/about-us`, `/ar/about-us` all share the same `about-us` segment, never a translated one. **Localized slugs are reserved for SEO-driven content only — Products, Categories, and Blog articles** — resolved server-side against `ContentTranslation` (per [i18n strategy §3](../i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization)). This was flagged as a new, revisit-if-wrong call in the original draft of this document; it's now a confirmed decision, not an open one — the reasoning stands as written: the structural pages are few, fixed, and primarily navigational, so keeping their URLs identical across locales keeps the site's IA legible and avoids three parallel route trees for pages that are otherwise structurally identical, while the actual localized-slug SEO value is concentrated exactly where it's kept — Products, Categories, and Blog articles.

### [P1 — SHIPPED 13 August 2026]

Everything in this subsection describes code that exists. `apps/web` now has a `[locale]` segment, a middleware at `src/middleware.ts`, two root layouts, and a canonical homepage at `/en`, `/fa` and `/ar`. `src/app/layout.tsx` is **deleted**. The eleven `/design-proof` pages are unchanged and still reachable. `next-intl` is still not installed.

**What P1 did not do**, so this is not read as more than it is: no Product Family route, no `products/[slug]`, no Product Detail, no message catalogs, no navigation or switcher rewrite, no sitemap or `robots.ts`, and no indexing — see "Not indexed" below.

**Root-layout topology during the transition.** `app/layout.tsx` was **deleted** and replaced by **two true root layouts**:

```
app/
├── [locale]/layout.tsx        # root layout — <html lang={locale} dir={direction}> from the Locale record
└── design-proof/layout.tsx    # root layout — <html lang="en" dir="ltr">, robots noindex/nofollow
```

The correction this records: in the App Router the root layout is **positional** — the first `layout` file found walking down from `app/` owns `<html>`/`<body>` for every page beneath it, and that layout is the one Next validates the `<html>`/`<body>` tags on. So while `app/layout.tsx` existed it was unavoidably the root, a nested `app/[locale]/layout.tsx` could not own `<html>`, and there was **no supported way** to set a per-locale `lang`/`dir` from beneath it. (Reading the pathname via `headers()` in the root layout would work but makes every route dynamic; setting `document.documentElement.lang` from a client effect ships the wrong `lang` in the server HTML, which is exactly what crawlers and assistive technology read. Both rejected.)

Consequences of two root layouts, both accepted:

- **Navigation between the proof tree and the canonical tree performs a full page navigation**, because the two branches resolve different root layouts. Accepted: no normal site navigation links into `/design-proof` — `site-routes.ts` contains no proof path, and the proof pages link only to canonical `ROUTES` values.
- **Changing locale does not cross a root layout.** The root-layout comparison ignores a dynamic segment's _value_ and compares only its name and type, so `/en/…` → `/fa/…` stays a client-side transition under one `[locale]` root.
- The proof tree's `noindex` becomes **scoped by construction** rather than inherited from a shared root that the canonical tree would then have to override.

The second root layout disappears when the proof routes are removed (ADR-010 §9 step 4), leaving `app/[locale]/layout.tsx` as the single root layout. That is why the step-3 redirects belong in `next.config.ts` or middleware rather than in page files — those are not routes, so they need no layout.

**`next-intl` is deferred, and is not installed.** P1 uses **native App Router locale routing plus a hand-written middleware**; nothing in P1 needs message catalogs, and there are none — every visible string in `features/**` is still hardcoded English. `next-intl` gets its own dependency approval at the gate that first introduces translated UI message catalogs. The three-concern middleware list above still describes the eventual shape; concern 1 (admin) has no surface yet and concern 3 (`Redirect` table) has no rows yet, so both stay deferred to their own gates.

**Middleware policy, as shipped.** Four ordered rules — and the middleware **does not recognise locales at all**:

1. **`/design-proof/**`** — bypass locale logic completely.
2. **`/`** — a redirect candidate.
3. **A known locale-less canonical structural first segment** — a redirect candidate. The set is derived from `ROUTES` in `site-routes.ts` (fragment values excluded, reduced to first path segments), never retyped, so `/products/**` and `/contact-us/request-a-quote` are covered without enumerating them.
4. **Everything else** — pass through unchanged.

Rule 4 is what makes the other cases work without any notion of what a locale code looks like. `/en/…`, `/xx/…` and `/foo` all take it: `/en` matches `[locale]` and renders, while `/xx` and `/foo` match nothing and 404 because `dynamicParams = false` closes the segment to the generated set. There is deliberately **no two-letter regex, no BCP-47 parsing, and no lookup of the active list to classify a path** — a shape test would buy nothing (both branches 404 identically) and would misfire the day a structural page is added whose first segment happens to be two letters.

Only a redirect candidate queries `GET /api/v1/locales`; general traffic taking rule 4 issues no request. Negotiation on a candidate is `NEXT_LOCALE` cookie → `Accept-Language` → the API-declared default, and it can only ever produce a locale from the fetched active set. **If the locale source fails, the middleware does not guess and does not redirect** — it logs and passes the request through, and normal routing answers it.

The invariant behind all of it: **the middleware must never turn an unsupported locale or a typo into an English 200.** A wrong URL that silently succeeds is worse than one that 404s, because nothing ever reports it.

**P1 scope, as shipped.** The root-layout swap could not be usefully separated from the first page under `[locale]` — a locale branch with no page generates no route and can be validated against nothing. P1 therefore promoted **only the homepage**, `/{locale}`, rendering the existing `HomeExperience` **without redesign**, as the verification route. **No Product Family page was promoted**, and the shared `products/[slug]` route was not created.

**The locale source is `GET /api/v1/locales`, and the build depends on it.** This is the one operational consequence of P1 that is not visible in the route tree, and it changed how `apps/web` builds.

- `generateStaticParams` for `[locale]` reads the active locale list through `src/lib/locales.ts`, and `<html lang dir>` comes from the same record. The locale list is data in a `Locale` table and adding a language must not require a code change (PROJECT_HANDOFF §6.9), so nothing in the routing layer holds a locale literal.
- **There is no fallback, by decision.** Not to `['en','fa','ar']`, not to an empty array, and not to the `LOCALES` fixture in `site-routes.ts` — which is a presentational switcher constant whose fields (`label`/`native`) are not even the endpoint's (`name`/`nativeName`). A fallback here would not degrade a page; it would generate a different site.
- **The build therefore fails, loudly, when the locale source is unavailable or unusable** — a missing or invalid `API_INTERNAL_URL`, an unreachable API, a non-2xx, a payload that is not the envelope, an empty active set, a malformed row, a duplicate code, or zero-or-many defaults. That is a deliberate, permanent property after P1, not a temporary strictness.
- **`apps/web` no longer builds without configuration.** It did before P1; `apps/web/.env.example` documents the change.
- This is the opposite policy from the Category fetch, and the two must not be confused. A Product Family page **fails open** to its fixture because the fixture holds the approved content, so a failed fetch costs it nothing observable. The locale list has no fixture that could stand in for it, because it does not describe a page's content — it determines which pages exist.

**Not indexed.** `/en`, `/fa` and `/ar` carry `robots: { index: false, follow: false }`, inherited from the `[locale]` layout, and the proof tree carries its own. P1 is a routing and topology milestone, not the SEO launch: most canonical pages do not exist, the header and footer link to routes that 404, the switcher is still presentational, and `fa`/`ar` render in a browser fallback font because the three self-hosted families carry no Arabic or Persian coverage. Indexing is enabled by a later, explicit launch gate.

---

## 3. Page Architecture

Per-page composition, cross-referencing [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)'s sections against [docs/design/FRONTEND_DESIGN_DIRECTION.md](../design/FRONTEND_DESIGN_DIRECTION.md)'s named components:

| Page                            | Route                                                                                                                                                    | Primary feature components                                                                                                                                                                 | Data source                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                            | `/[locale]`                                                                                                                                              | `LuxuryHero`, `ProductEcosystemPreview`, `WhyChooseSamGroup`, `IndustriesWeServe`, `CustomFormulationHighlight`, `EditorialInsights`                                                       | Payload (Pages) + Prisma (Products, BlogPost) via NestJS                                                                                                       |
| About Us                        | `/[locale]/about-us`                                                                                                                                     | `LuxuryHero` (shared), `CompanyMilestones`, `OurExpertise`, `QualitySnapshot`, `OurTeam`, `PartnershipCTA` — `CompanyMilestones`/`OurTeam` are repeater-driven, zero hardcoded items (§10) | Payload (Pages)                                                                                                                                                |
| Products (landing)              | `/[locale]/products`                                                                                                                                     | `ProductEcosystem` (category cards), `ProductFinderTeaser`                                                                                                                                 | Prisma (Category)                                                                                                                                              |
| Product Finder                  | `/[locale]/products/finder`                                                                                                                              | `ProductFinderTemplate` — `FinderHero`, `FinderFilters`, `FinderResults` (**[IMPLEMENTED]**, `features/products/finder/`)                                                                  | `GET /products` per render — **server-side filtering, see the correction below**                                                                               |
| Product category page (×6)      | `/[locale]/products/[slug]` — shared route, Family branch (ADR-010)                                                                                      | `ProductEcosystem` (category mode: range accordion, `SpecificationTable`, applications, industries, packaging)                                                                             | Prisma (Product, Specification, Media) — **one page renders every product/grade in its category; see §1's routing note**                                       |
| Customized Solutions            | `/[locale]/customized-solutions`                                                                                                                         | `CustomizationProcess` (GSAP, §8), `PrivateLabelProgramme`, `CaseExamples`, `CustomFormulationRequestForm`                                                                                 | Payload (Pages) + Prisma (`CustomFormulationRequest` on submit)                                                                                                |
| Export & Logistics              | `/[locale]/export-logistics`                                                                                                                             | `GlobalExportMap`, `ManufacturingJourney` (GSAP, §8), `IncotermsBlock`                                                                                                                     | Payload (Pages) + Mapbox (client)                                                                                                                              |
| Quality & Certifications        | `/[locale]/quality-certifications`                                                                                                                       | `ResearchLaboratory` (proposed home — see below), `CertificationsGrid`, `SamplingPolicy`                                                                                                   | Payload (Pages)                                                                                                                                                |
| Insights (Blog index + article) | `/[locale]/insights`, `/[locale]/insights/[slug]` — **implemented**                                                                                      | `InsightsTemplate`, `InsightCard`, `PostTemplate`, `PostUnavailable` (`features/insights/`)                                                                                                | Prisma (BlogPost, BlogCategory, BlogTag) via `GET /api/v1/blog/posts` ([API_CONTRACT_FINAL.md §2.3a](../API_CONTRACT_FINAL.md))                                |
| Contact Us                      | `/[locale]/contact-us`, `/[locale]/contact-us/request-a-quote`                                                                                           | `InquiryForm`, `PartnershipCTA`                                                                                                                                                            | Payload (Pages) + Prisma (`Inquiry` on submit)                                                                                                                 |
| Become a Distributor            | `/[locale]/become-a-distributor`                                                                                                                         | `DistributorApplicationForm`                                                                                                                                                               | Payload (Pages) + **new entity needed, not yet in `DATA_MODEL.md`** — see [SITE_STRUCTURE.md](../SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure) |
| FAQ                             | `/[locale]/faq`                                                                                                                                          | `FaqAccordion`                                                                                                                                                                             | Payload content (likely a new collection — not yet modeled)                                                                                                    |
| Careers                         | `/[locale]/careers`                                                                                                                                      | `JobListings`, `SpeculativeApplicationForm`                                                                                                                                                | Payload (Pages) + **new entity needed** — see `SITE_STRUCTURE.md`                                                                                              |
| Legal pages (×4)                | `/[locale]/privacy-policy` — **route implemented, no content published**; `/terms-of-use`, `/cookie-notice`, `/general-sales-conditions` not implemented | `LegalPageTemplate`, `LegalPageUnavailable` (`features/legal/`) — one shared shell for all four, no per-page component                                                                     | Payload (Pages) via `GET /api/v1/content/pages/:slug`                                                                                                          |
| Thank You                       | `/[locale]/thank-you`                                                                                                                                    | Minimal — confirmation message + next-step links, fires analytics conversion event                                                                                                         | Static/CMS text                                                                                                                                                |

**[CORRECTED] The Product Finder does not filter client-side.** This table previously described it as "client-side filtering over a server-fetched list". The implemented finder does the opposite, and the reason is [ADR-008](../ADR/ADR-008-b2-filter-contract-and-segment-vocabulary.md) rather than a preference: ADR-008 fixes the meaning of `?category=` and `?segment=` and of combining them, `GET /products` implements it, and a second implementation in `apps/web` could only ever agree with the first by coincidence — while disagreeing silently the first time those semantics gain a rule. So each filter is a link, the page re-issues `GET /products` with the two parameters, the result count is `meta.total`, and nothing is narrowed in the browser or in the Next.js server. The consequence is that the finder ships **no client JavaScript of its own**: filter state is URL state, so refresh, Back/Forward, bookmarking and sharing work without a control, a store or a handler. The row above is the corrected description; this note records what it replaced.

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
│   ├── editorial-insights.tsx
│   ├── insights-template.tsx           # implemented — the /{locale}/insights index shell
│   ├── insights-query.ts               # implemented — ?category= / ?page= URL state
│   ├── insight-card.tsx                # implemented — one GET /blog/posts row
│   ├── published-date.tsx              # implemented — locale-formatted <time>
│   ├── post-template.tsx               # implemented — the article page
│   ├── post-unavailable.tsx            # implemented — blog-service-down state, never a 404
│   ├── resolve-post.ts                 # implemented — per-request memoized lookup
│   └── sections/                       # implemented — hero.tsx, list.tsx
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

**As built**, `forms/` holds `actions.ts` (the two Server Actions), `submit.ts` (`FormData` reading, the POST, and the `ApiResult` → `SubmissionState` mapping), `form-feedback.tsx` (the outcome banner, field messages, submit button), `submission-state.ts`, `inquiry-vocabulary.ts` and `inquiry-form.tsx` — the shape above with the shared logic split by concern rather than gathered into one `use-form-submit.ts` hook, because the submission itself runs server-side and only the display of its result is a client concern. **The Custom Product Request form did not move here**: it stayed at `customized-solutions/sections/custom-request-form.tsx`, which is where the page's own field data lives, and it consumes the shared modules above. The `careers-partners/` forms are unbuilt and unchanged.

Two behaviours the built forms depend on and that are worth stating here because neither is obvious:

- **Field error messages are keyed by the API's `details[].field`**, which is the DTO property name and therefore the input's own `name`. There is no client-side schema and no mapping table, so the two cannot drift.
- **React 19 resets an uncontrolled form once its action completes — including when it failed.** Left alone, that empties every field the moment a validation error or an outage comes back. Both forms therefore carry the submitted text values in `SubmissionState` and remount their controls with a changing `key`, so a failed attempt keeps what was typed. The consent checkbox is deliberately excluded: consent is re-given per attempt, never restored by the server.

---

## 6. Design System Architecture

- **Tokens as data, not just Tailwind config**: colors, spacing, and type scale are defined once as plain TypeScript constants in `packages/ui` (e.g. `tokens.ts`), and both Tailwind's theme (via the future `packages/config` Tailwind config) _and_ non-CSS consumers — Three.js materials, Mapbox style JSON, neither of which can read a Tailwind class — import from that same source. One value, three consumers, never redefined per-consumer.
- **`packages/ui` is a systems library, not a themed component kit.** Given the design direction explicitly rejects "generic SaaS layouts," heavily pre-skinned components (an opinionated `Card`, a fully-styled `Hero`) would push every page toward the same templated look the brief is trying to avoid. Primitives stay minimal (layout, spacing, base typography); visual personality lives in `features/`, composed per page.
- **Typography**: Latin faces (Inter, Neue Haas Grotesk style, Helvetica Neue style) load via `next/font`, subset to Latin only. The RTL-capable pairing for Persian/Arabic is **still an open decision** (candidates proposed in the i18n strategy, not confirmed) — the design system's font-loading mechanism must key off `Locale.direction`/`code` so swapping in the confirmed RTL faces later is a token change, not a component rewrite.

---

## 7. Server Component vs. Client Component Rules

Default is Server Component — that's the App Router default and the right one for a content-heavy, SEO-critical site. `"use client"` is added only where one of these is true, and always at the smallest component that needs it, never at a page or layout root (already stated as a best practice in [technology/FRONTEND_STACK.md](../technology/FRONTEND_STACK.md); this is where it becomes a hard rule with named cases):

| Needs client                                                         | Because                                     |
| -------------------------------------------------------------------- | ------------------------------------------- |
| `LuxuryHero`, `EditorialInsights` card reveals, etc. (Framer Motion) | Animation hooks require the client runtime  |
| `ManufacturingJourney`, `CustomizationProcess` (GSAP/ScrollTrigger)  | DOM refs + scroll listeners                 |
| `GlobalExportMap` (Mapbox), any Three.js/R3F canvas                  | Browser-only WebGL/map APIs                 |
| `CustomFormulationRequestForm`, `InquiryForm`                        | Form state, client-side validation feedback |
| `LocaleSwitcher`                                                     | Client-side navigation on click             |

Data fetching happens server-side (in the page or a server-side feature wrapper) and is passed down as props — a Client Component leaf does not call the API client directly to _read_ data. The one exception is form **submission**, which goes through a Next.js Server Action (§11), not a client-side `fetch` — the component is a Client Component for interactivity, but the mutation itself still runs server-side.

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

### [SHIPPED 16 August 2026 — the first CMS-backed route]

`src/lib/content.ts` consumes `GET /api/v1/content/pages/:slug` through the existing `apiGet` client.
It is the first Payload-backed data in `apps/web`, and **nothing about it knows a CMS exists**: no
Payload origin, no CMS credential, no Payload-shaped type. `PAYLOAD_INTERNAL_URL` and
`PAYLOAD_API_KEY` are read only by `apps/api` and must never be given to this application.

The route is `app/[locale]/cms-proof/[slug]/page.tsx` — **a demonstration route, not a canonical
one**, and it must not become one. The `Pages` collection holds legal pages, and every one of them is
blocked on approved, legally reviewed text in three locales that does not exist
([SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §12). `/{locale}/privacy-policy` is created by the gate
that has that content; pointing it at this data now would publish whatever is in the CMS as though it
were policy. When that gate arrives, this route follows
[ADR-010](../ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §9's transition order
(implement → validate → redirect → remove) and is deleted.

Four things it establishes, each of which the legal routes will inherit unchanged:

- **Only a definitive NOT_FOUND becomes a canonical 404.** A stopped API, a stopped **Payload**, a
  timeout, a 5xx, a rejected service credential and a malformed payload all render a restrained
  unavailable state, reported server-side and specific about which of the two services failed. The
  new failure mode compared with every earlier route is a CMS outage, and turning that into a 404
  would tell crawlers the company's legal pages had been withdrawn.
- **Locale fallback is surfaced, not hidden.** `meta.localeFallback` renders a "not yet translated"
  notice, as the article route already does.
- **The `cms-proof/` namespace is its own**, separate from `products/` and `insights/`. Nothing here
  claims, reserves or consults a `ProductSlugClaim` — ADR-010 and ADR-011 govern `/products/{slug}`
  alone.
- **`bodyHtml` is rendered as markup**, via `dangerouslySetInnerHTML`, and it is the only place in
  `apps/web` that renders any. **It is sanitized server-side by NestJS before it arrives** — an
  allow-list rebuild described in [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.4a — and
  `apps/web` deliberately does **not** sanitize it a second time: a second policy would be a second
  thing to keep in step, and the API is the boundary precisely so every consumer inherits it. The
  alternative to rendering markup at all — parsing the HTML into React elements here — would be a
  second hand-written renderer for a document format this application does not own.

**Verified in the browser:** every request on the page goes to the Next origin. None reaches the API
origin, and none reaches Payload's.

### [SHIPPED 17 August 2026 — the first canonical CMS-backed route]

`app/[locale]/privacy-policy/page.tsx`, with the shared shell in `src/features/legal/`. It consumes
the same `src/lib/content.ts` client, unchanged, and inherits all four properties the proof route
established above — definitive-NOT_FOUND-only 404s, surfaced locale fallback, its own namespace, and
API-sanitized `bodyHtml`. Three things distinguish it, and each is the difference between a proof and
a canonical page:

- **The slug is a constant, not a segment.** `PRIVACY_POLICY_SLUG` is fixed in the route file, so
  unlike `cms-proof/[slug]` no document can be surfaced here by asking for it in the URL. That is
  what makes the route safe to exist before its content does.
- **It publishes nothing, and today it 404s.** No approved Privacy Policy text exists in the
  repository or in `sam_cms` ([SITE_STRUCTURE.md](../SITE_STRUCTURE.md) §12), and none was drafted
  to make the route return 200. A published `Pages` document with slug `privacy-policy` is the only
  thing that turns this page on — authored by a human editor after legal review. **The paragraph
  above this section said this route would be "created by the gate that has that content"; the route
  arrived first, deliberately, and the content did not arrive with it.** That is a weaker claim than
  it sounds: the capability is proven, the page is not published, and the two must never be reported
  as one.
- **It is linked from nowhere.** `ROUTES.privacyPolicy` exists so `middleware.ts` gives locale-less
  `/privacy-policy` a locale, and for no other reason. The header, the footer and all four consent
  labels are unchanged — a link to a 404 beside a consent checkbox is worse than the plain wording
  they already carry.

The shell is shared on purpose: SITE_STRUCTURE §12's four legal pages are structurally
interchangeable, so `LegalPageTemplate` takes a `ContentPageResponse` and knows nothing about which
one it is rendering. Terms of Use, Cookie Notice and General Sales Conditions are a route file each —
**none was created**, because none has content either. The template contributes no copy of its own
beyond the "last updated" label and the untranslated notice, and deliberately renders no table of
contents, no legal contact block and no compliance iconography.

**Measured, not inferred.** Both branches were exercised against a healthy Payload, a healthy Content
API and a valid service credential: with no row, all three locales return a **canonical 404**; with a
temporary NON-AUTHORITATIVE test row under the canonical slug — since deleted, leaving no residue —
all three return 200, the metadata comes from the CMS `SeoFields` record, and `robots` still renders
`noindex, nofollow` because the layout stays the nearest value. With Payload stopped, both an existing
and a missing slug render the unavailable state at 200 rather than 404, and recover without restarting
`apps/api` or `apps/web`. Full record in [ROADMAP.md](../ROADMAP.md).

**`cms-proof` is unchanged and still live.** ADR-010 §9's transition (implement → validate → redirect
→ remove) cannot complete while the canonical route has no content to validate against, and the proof
route still demonstrates the 200 path that this one cannot yet reach.

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

### [SHIPPED 15 August 2026 — the Product list client]

Describes code that exists. `src/lib/` now holds three modules against the plan above: `api-client.ts` (transport and envelope), `catalog.ts` (Category), and `products.ts` (Product). One module per resource, all `server-only`, all `cache: "no-store"`.

- **`getProductsByCategory(categorySlug, locale, segmentSlug?)`** backs the Family pages' list; **`getProductBySlug(slug, locale)`** backs Product Detail (added by the gate below, which also removed the line that said the detail endpoint had no caller).
- **Failure is a value, never a throw.** The result union separates `unknown-filter` (a 400 naming a rejected filter parameter — the only failure a visitor caused and the only one they can undo) from `unreachable` and `api-error`, because those need different words on the page. An empty list and a failed request are never rendered alike.
- **Filtering is the API's, in full.** `apps/web` narrows nothing locally; ADR-008 fixes the semantics of combining `category` and `segment`, and a second implementation could only agree by coincidence.
- **Filter state is URL state.** The Segment control is a row of links carrying `?segment={slug}`, so refresh, sharing and browser history work by construction and the section ships no client JavaScript. Reading `searchParams` costs nothing here: `no-store` had already made the route dynamic.
- **One `Suspense` boundary, at the list.** The route creates the promise and does not await it; the template awaits it below a boundary. Without that, a hung catalog service would hold eleven sections of approved editorial content for the client's full ten-second timeout. **Data access still belongs to the route** — the promise is created there, per §7; the section fetches nothing.

**Open, and named so it is not mistaken for done:** there is no Segment endpoint, so the eight approved Segment slugs are mirrored in `features/products/segments-data.ts` from `prisma/seed-catalog.ts`. That module is a stopgap with its reasoning written into it, and it is **deleted** — not kept in sync — by the gate that adds `GET /segments`.

### [SHIPPED 15 August 2026 — Product Detail and the shared-namespace discriminator]

`/{locale}/products/{slug}` now serves both entity types from one dynamic segment, closing the ADR-010 §2 read path.

- **One discriminator, in the route file**, resolving in a fixed order: **reserved** slug (`finder`/`segments`/`types`) → 404 answered locally, no catalog lookup; **Product Family** → the local content registry, returning before any Product request is issued — which is what Family precedence means operationally; **Product** → `GET /products/:slug`, the only branch that asks the network whether a page exists.
- **Only a definitive NOT_FOUND may 404.** An unreachable service, a timeout, a 5xx or a malformed payload render a restrained unavailable page instead (ADR-010 §7). It renders with a 200, which is a known limitation: the App Router gives a page no supported way to set a 5xx, and the whole `[locale]` tree is `noindex` so nothing is interpreting the status yet. Revisit with the SEO launch.
- **`generateStaticParams` and `dynamicParams` are absent from `[slug]`, and that is required rather than incidental.** A child segment's `dynamicParams = true` does **not** override `dynamicParams = false` on the parent `[locale]` layout: with an enumeration present, Next builds the closed cross-product of locales × slugs and 404s anything outside it **at the router, before the page runs** — measured, not inferred. Removing the enumeration keeps the fix local to this segment and preserves §2's locale closure, which is what makes `/xx` a 404 without the middleware recognising locales. The six Family pages are therefore server-rendered on demand, which they already were: the route reads `searchParams` and every fetch beneath it is `no-store`.
- **`generateMetadata` for a Product shares the page's fetch** through React's `cache()`, so a title and a body cannot describe different responses. The Family branch still reads metadata from the local registry and issues no request at all.
- **Product cards link to the flat canonical URL**, composed inside the card from `locale` + `product.slug` rather than passed in — a caller cannot hand it a nested path. ADR-011's triggers make a Product slug colliding with a Family or reserved value unwritable, so no card can point into Family or reserved space.
- **The page renders only API-backed fields.** Specifications and imagery render only when the record carries them; a null `productType` renders no row. There is no empty state for any of the three, and no placeholder imagery.

---

## 12. SEO Integration

- Every route exports `generateMetadata`, calling the API client server-side and mapping the normalized `SeoFields` shape ([SEO_ARCHITECTURE.md §2](../seo/SEO_ARCHITECTURE.md#2-reusable-seo-model--field-contract)) onto Next.js's Metadata API (`title`, `description`, `alternates.canonical`, `openGraph`, `twitter`, `robots`).
- `alternates.languages` (hreflang) is populated from the per-locale translation-existence check already specified in [i18n strategy §4](../i18n/INTERNATIONALIZATION_STRATEGY.md#4-seo-localization) — omitted, not stubbed, for locales without a real translation.
- `app/sitemap.ts` and `app/robots.ts` (outside `[locale]`, per §1) call `GET /api/v1/seo/sitemap-entries` / the environment-aware robots rule from [API_DESIGN.md](../API_DESIGN.md).
- **JSON-LD** renders through one shared `<JsonLd>` component (§4) taking a typed schema object per the SEO Master table in [SITE_STRUCTURE.md §14](../SITE_STRUCTURE.md#14-seo-master) — never hand-written inline per page, so the structured data can't drift from a shared shape. `FAQPage` applies to every product category page plus `/faq` itself, sourced from the shared `FaqEntries` collection ([SEO_ARCHITECTURE.md §8](../seo/SEO_ARCHITECTURE.md#8-structured-data-schemaorg)).
- **Breadcrumbs**: one component renders both the visible nav _and_ feeds the `BreadcrumbList` JSON-LD from the same data object — per [SEO_ARCHITECTURE.md §4](../seo/SEO_ARCHITECTURE.md#4-next-js-seo-consumption)'s rule that the two must never diverge.

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
2. **Product category pages are single-level, no per-SKU detail route** — confirmed directly by the site structure source of truth's Sitemap sheet, not an inference. See §1. **[SUPERSEDED BY ADR-007]** — the six category pages stand; the no-per-SKU-detail-route half is reversed, and a canonical Product Detail route at `/{locale}/products/{product-slug}` is approved. **Decided — not implemented.** **[UPDATED BY ADR-010]** — the two share one namespace and one route, `app/[locale]/products/[slug]/page.tsx`, with Product Family precedence and colliding data treated as invalid. Still not implemented.
3. **Mapbox's placement (`GlobalExportMap`, Export & Logistics) is now confirmed**, not just proposed — the site structure source of truth explicitly calls for "interactive or illustrated map plus regional cards" on that page's Global Reach section.

## Open Items (not resolved by this document)

1. `ResearchLaboratory`'s page placement — a proposal (Quality & Certifications' Laboratory Capability, §3), still not signed off by content/design.
2. Three.js's exact placement (packaging visualization) — still proposed, not confirmed (§9; tracked in `/AI_CONTEXT.md`). Unlike Mapbox, the site structure source of truth doesn't call for 3D anywhere.
3. RTL typeface pairing (§6; tracked in the i18n strategy's Remaining Decisions).
4. CMS publish → ISR revalidation path (§10) — a future `API_DESIGN.md` addition, not designed here.
5. `DistributorApplicationForm`, `JobListings`, `FaqAccordion`, and `CertificationsGrid` (§4/§5) have no backing `DATA_MODEL.md` entity yet — component shells can be planned, but their data contracts can't be finalized until [SITE_STRUCTURE.md's Data Model Gaps](../SITE_STRUCTURE.md#data-model-gaps-surfaced-by-this-structure) are addressed.
