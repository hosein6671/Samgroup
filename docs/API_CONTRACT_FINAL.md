# API Contract (Final)

The complete NestJS API surface, consolidated from every approved architecture document. This **supersedes** [API_DESIGN.md](./API_DESIGN.md) where they overlap — that document remains the statement of conventions (envelope, versioning, naming); this one is the authoritative endpoint list.

**No code, no controllers, no DTOs, no packages.** Endpoint shapes below are the contract, not an implementation. Where this document makes a call not already settled elsewhere it's marked **[NEW DECISION]**. No frozen architecture (ADR-001/002/003) is changed.

---

## 1. API Ownership Boundaries

```
   apps/web (Next.js)          ← consumes ONLY /api/v1/*
        │
        │  HTTPS, server-side (RSC + Server Actions)
        ▼
   apps/api (NestJS)           ← owns every public contract
        │
        ├──▶ Prisma  ──▶ sam_platform    (products, blog, submissions, locales, SEO, redirects)
        │
        └──▶ Payload REST ──▶ sam_cms    (server-to-server, internal only)
                    ▲
                    │
   apps/cms (Payload)          ← admin UI for editors; never called by apps/web
```

### NestJS owns

Every contract any external consumer touches: REST endpoints, JWT issuance, RBAC enforcement, the `{data, meta}` / `{error}` envelope, locale resolution, published-state filtering, Payload response normalization, caching, and rate limiting. If a behavior is observable by `apps/web`, NestJS owns it.

### Payload owns internally

Editorial content in `sam_cms` and the admin UI editors work in. Payload's own REST API is reachable **only** from NestJS, server-to-server, on the internal network — never exposed publicly, never called by `apps/web` (ADR-003). Payload's response shapes are an internal detail; NestJS translates them into the platform envelope so the frontend has no awareness Payload exists.

### Next.js consumes

`/api/v1/*` only, server-side. Reads happen in Server Components; writes happen in Server Actions ([FRONTEND_ARCHITECTURE.md §11](./frontend/FRONTEND_ARCHITECTURE.md)). **No browser-originated call ever reaches NestJS directly** — which means CORS can stay strict and the API's public surface is effectively server-to-server.

### RAG consumes (future)

`/api/v1/rag/*` only, as an authenticated service client with read-only scope — never a database connection ([RAG_IMPLEMENTATION_ARCHITECTURE.md](./ai/RAG_IMPLEMENTATION_ARCHITECTURE.md)).

---

## 2. REST API Structure

All paths prefixed `/api/v1`. **P** = public (no token), **A** = authenticated, **S** = service token.

### 2.1 System & Locales

| Method | Path       | Auth | Purpose                                                                                                                                                           |
| ------ | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`  | P    | Liveness/readiness for Docker health checks ([DEVOPS.md](./DEVOPS.md))                                                                                            |
| GET    | `/locales` | P    | Active `Locale` rows (code, name, nativeName, direction, isDefault). Consumed at **build time** by `apps/web` routing config and by Payload's localization config |

### 2.2 Authentication

| Method | Path            | Auth   | Purpose                                                                  |
| ------ | --------------- | ------ | ------------------------------------------------------------------------ |
| POST   | `/auth/login`   | P      | Email + password → access token (body) + refresh token (httpOnly cookie) |
| POST   | `/auth/refresh` | Cookie | Rotate access token                                                      |
| POST   | `/auth/logout`  | A      | Invalidate refresh token, clear cookie                                   |
| GET    | `/auth/me`      | A      | Current user + role, for admin-surface authorization                     |

#### 2.2a Implementation status — **all four paths are live**

**Implemented:** `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` and `GET /auth/me`. The table above is unchanged — it remains the contract; this records how much of it exists, and clarifies one ambiguity it carried (see the cookie note below). Session persistence, rotation and account status are [ADR-012](./ADR/ADR-012-application-session-and-account-status.md).

- **`POST /auth/login`** answers **200** (not 201 — logging in creates no resource) with `data: { accessToken, tokenType: "Bearer", expiresIn, refreshToken, refreshExpiresIn, user: { id, email, role } }`. `refreshExpiresIn` is **604800** (seven days); `expiresIn` remains **900**. A successful login writes exactly one `AuthSession` row. The body is `{ email, password }` and **nothing else**: the global pipe runs `forbidNonWhitelisted`, so a request carrying `role` — or any other property — answers **400 `VALIDATION_ERROR` naming it** rather than having it stripped. A failure is always **401 `UNAUTHENTICATED`** with one fixed message, `"Invalid email or password."`, for an unknown email, a wrong password **and a `disabled` account** alike; all three paths do the same amount of argon2 work — the status check runs _after_ the password verification — so they are not distinguishable by timing either. No password hash appears in any response.
- **`GET /auth/me`** answers `data: { id, email, role }` for any authenticated caller. It is **not role-gated** — it discloses nothing the caller has not already proven. A deleted account, a `disabled` one, **and one whose token predates the account's credential cutoff** all fail the same 401: the guard re-reads `sam_platform` on every request and checks all three at once. `status` is not served here, because this endpoint answers only for `active` accounts and the field would carry one constant value.
- **`POST /auth/refresh`** answers **200** with `data: { accessToken, tokenType, expiresIn, refreshToken, refreshExpiresIn }` — the login body **without** `user`. The request body is `{ refreshToken }` and nothing else; an unknown property answers **400 `VALIDATION_ERROR`** naming it. It carries **no `Authorization` header requirement**: the endpoint exists to be reachable once the access token has expired, so the refresh token is the authentication factor. Every failure — unknown, expired, revoked, already-rotated, deleted account, disabled account — is one **401 `UNAUTHENTICATED`** with a single message, and no token material is echoed back.
- **`POST /auth/logout`** answers **204** with an empty body. It requires **both** an `Authorization: Bearer` access token (who is asking) and `{ refreshToken }` in the body (which session to end); revocation is scoped to the authenticated user, so presenting another account's token revokes nothing. It is **idempotent** — a second logout, an already-rotated token and a stranger's token all answer 204 alike, because reporting the difference would disclose whether a token the caller holds is live elsewhere. **The access token is not invalidated**: it stays valid for the remainder of its 15 minutes, and no deny-list exists.

- **`role` is on the wire as the physical enum label** — `admin`, `content_manager`, `sales_expert`, `customer` — following the precedent §2.6 set for `inquiryType` and `GET /locales` set for `ltr`/`rtl`.

**Disabling an account permanently revokes its credentials.** `active → disabled` revokes every live session and stamps a credential cutoff, both in one transaction and both enforced by the database. Re-enabling restores the ability to log in and to be issued **new** credentials; it restores nothing already issued, so a pre-disable refresh token answers 401 forever and a pre-disable access token does too, even inside its 15 minutes. The access token's claim set is unchanged — the cutoff is compared against the `iat` it already carries, and **no `jti` was added** ([ADR-012](./ADR/ADR-012-application-session-and-account-status.md) §7).

**The refresh token is rotated on every use.** A successful refresh revokes the presented session and creates exactly one replacement, in a single transaction; the presented token is unusable immediately afterwards. Two concurrent refreshes of one token produce **exactly one success and one generic 401** — guaranteed by a conditional `UPDATE` under PostgreSQL's READ COMMITTED, not by an in-process lock. **Refresh-token family reuse detection is deferred**: replaying a rotated token is refused and nothing further happens.

<a id="the-cookie-boundary"></a>

##### The cookie boundary — a clarification of §2.2's table, not a change to it

§2.2 says login returns the refresh token in an "httpOnly cookie" and marks `/auth/refresh`'s auth as **Cookie**. §1 of this document says **"No browser-originated call ever reaches NestJS directly"**. Both describe the browser's view; neither describes the NestJS hop, and read as describing the same hop they contradict each other. [ADR-012](./ADR/ADR-012-application-session-and-account-status.md) resolves it:

| Hop                  | What carries the refresh token                                                        |
| -------------------- | ------------------------------------------------------------------------------------- |
| Browser ↔ `apps/web` | An **HttpOnly cookie owned by `apps/web`** — never readable by browser JavaScript     |
| `apps/web` → NestJS  | The **raw token as a body value**, over the trusted server-to-server hop behind nginx |

**NestJS sets no cookie, reads no cookie and clears no cookie**, and `apps/api` has no cookie dependency. "Clear cookie" in §2.2's logout row is `apps/web`'s half.

**[STATUS] `apps/web` has now issued them, and this changes nothing on this side.** The frontend session gate fixed **two** cookies — `sam_admin_refresh` (7 days) and `sam_admin_access` (15 minutes), both `HttpOnly`, `SameSite=Strict`, `Path=/`, host-only, `Secure` outside local development. The second exists because Next 15 forbids cookie mutation during a render, so a Server Component cannot persist a rotated refresh token; it carries the access token that `apps/web` presents to this API as `Authorization: Bearer`, which is the same header §2.2 already contracts. **No endpoint, body, status or claim on this side moved**, `apps/api` still has no cookie parser, and the table above is unchanged. Full description: [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md) §2a.

**No self-registration exists, and none is contracted.** The first Admin is created by an explicitly armed bootstrap script outside the request path (`pnpm seed:admin`), described in [SECURITY.md](./SECURITY.md#admin-bootstrap).

**[NEW DECISION] Password reset is deferred to the admin surface build, not Phase 1 launch.** Phase 1 has no public customer login — the Customer role exists in the data model for the future Customer Portal, but no Phase 1 page authenticates an end user. The only accounts are internal staff, who can be reset by an Admin directly. A public reset flow (token issuance, email delivery, expiry) is real work with a real attack surface, and building it before anyone can log in publicly is premature. Revisit with Customer Portal.

### 2.3 Products & Catalog _(Prisma)_

| Method | Path                             | Auth | Purpose                                                  |
| ------ | -------------------------------- | ---- | -------------------------------------------------------- |
| GET    | `/categories`                    | P    | The six product categories; `?parentId=` for nesting     |
| GET    | `/categories/:slug`              | P    | One category + its `SeoFields`                           |
| GET    | `/products`                      | P    | List/filter/search — the Product Finder's backend (§2.7) |
| GET    | `/products/:slug`                | P    | One product + specifications + media + `SeoFields`       |
| GET    | `/products/:slug/specifications` | P    | Specifications alone, for partial refreshes              |

`:slug` accepts the **locale-specific slug** resolved via `ContentTranslation` ([INTERNATIONALIZATION_STRATEGY.md §3](./i18n/INTERNATIONALIZATION_STRATEGY.md#3-content-localization)).

### 2.3a Blog / Insights _(Prisma)_ **[ADDED — APPROVED]**

| Method | Path                | Auth | Purpose                                                     |
| ------ | ------------------- | ---- | ----------------------------------------------------------- |
| GET    | `/blog/posts`       | P    | Published posts, newest first; `?category=`, `page`, `sort` |
| GET    | `/blog/posts/:slug` | P    | One published post + its category + tags                    |

**Why these were added.** Before this pass the only public blog read in this document was `GET /pages/insights` (§2.5), which composes an **Insights Global** — a Payload object — with the post list. Payload is not implemented, so that endpoint cannot be built yet; and because no blog **resource** endpoint was listed, the Article page (`/{locale}/insights/[slug]`, [SITE_STRUCTURE.md §0](./SITE_STRUCTURE.md#0-full-sitemap)) had no endpoint anywhere in this contract. That is a gap rather than a deliberate exclusion — §2.5 itself states the composition endpoints are "additive, not a replacement" and that resource endpoints "remain the foundation".

These two fill it in the shape §2.3 already fixes: same envelope, same `?locale=`, same pagination `meta`, same `localeFallback`, and `:slug` is the locale-specific slug resolved via `ContentTranslation`. **`GET /pages/insights` is unchanged and still contracted** — it arrives with Payload and is expected to consume this same service rather than replace it.

**Approved.** These two endpoints are the missing Prisma-owned Blog resource API under the existing NestJS sole-gateway architecture. **Blog stays Prisma-owned; Payload owns no blog content**, which is what [SEO_ARCHITECTURE.md §5](./seo/SEO_ARCHITECTURE.md) already states ("Payload holds no blog content and no blog SEO"). No write endpoint is authorized here — blog CRUD remains an Admin surface (§5).

**Published means `BlogPost.publishedAt` is set and in the past** — the definition §6 already fixes for the RAG export. `sam_platform` has no draft/published status column for blog content, so a future-dated post is a scheduled one and is not served. An unpublished or scheduled post answers **404, not 403**: whether a draft exists is not a fact a public endpoint should leak.

`?category=` is a `BlogCategory` slug, matched exactly (no hierarchy exists) and **not locale-aware** — `BlogCategory` and `BlogTag` are not `ContentEntityType` members, so they carry no translation rows and their `name`/`slug` are served verbatim in every locale. An unresolvable value answers 400 `VALIDATION_ERROR` naming the `category` field, never an empty 200.

**No `?tag=` and no `?q=`.** `blog_post_tags` exists, but no blog tag vocabulary is approved; a tag filter would fix semantics ahead of the decision that defines them. Free-text blog search is outside §2.7's Phase 1 scope. Both are rejected by the `forbidNonWhitelisted` validation pipe rather than silently ignored.

**No `author` and no `seo` on the wire.** `BlogPost.authorId` exists and is null on every row — a byline is a claim about a person. `SeoMeta` is polymorphic and [SEO_ARCHITECTURE.md §5](./seo/SEO_ARCHITECTURE.md) does name Prisma as the blog's SEO home, so `SeoFields` can be attached; it is deliberately deferred to the gate that renders it.

**Write endpoints are out of scope.** Blog CRUD is an Admin surface (§5) and no write path exists here.

### 2.4 Content _(Payload, via NestJS)_

| Method | Path                               | Auth | Purpose                                                                                                                                                                        |
| ------ | ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/content/globals/:name`           | P    | One Payload Global: `home`, `about-us` (**built** — §2.4b), `products-landing`, `customized-solutions`, `export-logistics`, `quality-certifications`, `contact-us`, `faq-page` |
| GET    | `/content/pages/:slug`             | P    | Legal pages from the `Pages` collection                                                                                                                                        |
| GET    | `/content/product-categories/:key` | P    | `ProductCategoryContent` — editorial copy for a category page                                                                                                                  |
| GET    | `/content/faq`                     | P    | `FaqEntries`; `?category=` filter. Feeds both `/faq` and per-product-page FAQ blocks from one source                                                                           |
| GET    | `/content/certifications`          | P    | **Published certifications only** — see §4                                                                                                                                     |
| GET    | `/content/job-openings`            | P    | Open vacancies                                                                                                                                                                 |
| GET    | `/content/navigation`              | P    | Header + Footer Globals — consumed by the root layout                                                                                                                          |
| GET    | `/content/settings`                | P    | Site-wide settings: `Organization` schema data, default OG image, contact details                                                                                              |

#### 2.4a Implementation status — 16 August 2026, extended 20 August 2026

**Two of the eight paths are implemented, and no path was added, renamed or reshaped.**
`GET /content/pages/:slug` is described below; `GET /content/globals/:name` is §2.4b.

`GET /content/pages/:slug` is live, served by a new `ContentModule` in `apps/api`. It takes `?locale=`
like every content-bearing endpoint (§3), answers in the standard envelope, and serves four fields:
`slug`, `title`, `bodyHtml`, `lastUpdatedDate`.

- **`bodyHtml`, not a rich-text AST.** §4 names Payload's rich-text AST as an internal shape, so
  something has to turn the Lexical document into a transport form. It is produced by **Payload's own
  official converter**, as a virtual unstored field on the collection. The alternatives were a
  hand-written AST walker inside `apps/api` (a second implementation of a format `apps/api` does not
  depend on) or a newly invented block vocabulary on the wire (a contract decision this gate had no
  mandate to make).
- **`bodyHtml` is SANITIZED by NestJS before it is served, and this is the platform's only such
  boundary.** An allow-list rebuild using `sanitize-html`, applied in the one function every Content
  response is assembled by, so no response can be constructed that skips it. It admits headings,
  emphasis, lists, links, quotes, tables and the converter's own wrapper classes; it removes script
  hosts (tag **and** contents), every `on*` handler, `style` elements and attributes, `iframe`,
  `object`, `embed`, `svg`, form controls, comments, and any URL scheme outside
  `http`/`https`/`mailto`/`tel` — including entity-, whitespace- and case-obfuscated `javascript:`.
  Links opening a new tab have `rel="noopener noreferrer"` applied by the sanitizer rather than
  trusted from the editor.
  The boundary is here rather than in `apps/web` deliberately: NestJS is the only public contract
  (§1), so every present and future consumer receives the same safe HTML and none can forget to
  sanitize. A frontend-side sanitizer would be repeated per consumer and would leave the unsafe form
  on the wire. `title` is not sanitized and does not need to be — it is a `text` field, never
  rendered as markup, and escaped by the renderer.
  **Fallback detection reads the RAW body, not the sanitized one**: a body made entirely of stripped
  markup is _present_ in the CMS, and treating its empty sanitized output as "untranslated" would
  report a fallback that did not happen.
- **No Payload document id on the wire**, and no `_status` — only published pages are served, so a
  status field would have exactly one value.
- **`seo` carries the shared `SeoFields` contract**, normalized from Payload's `seoFields()` group —
  the same shape Prisma-owned content will serve from its own `SeoMeta` table, so a consumer cannot
  tell which database it came from ([SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md) §0).
  **Always present.** A page whose editor never opened the SEO tab yields nulls and §2's documented
  defaults (`robotsIndex`/`robotsFollow` true, `twitterCardType` `summary_large_image`, `keywords`
  `[]`) rather than a missing object, so `generateMetadata` reads one shape and never tests for it.
  `locale` is the **requested** locale, never the one values may have fallen back to —
  `meta.localeFallback` is what reports that. `alternates` lists only locales holding a real
  translation, derived from the documents rather than stored.
- **`socialImage`/`twitterImage` are objects, not URL strings** — `{ url, alt, width, height }`, the
  facts [SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md) §Image SEO and §6 require for
  `og:image:alt` and for layout-stable rendering. Null when no image is set; `twitterImage` falls
  back to `socialImage` whole. `alt` follows the same locale and fallback rules as every other
  localized value; `width`/`height` come from Payload's upload metadata and are null when it has
  none.
- **Their `url` is origin-relative** (`/media/cms/<file>`), served from the site's own origin by
  nginx. The API does not compose absolute URLs — it does not know the public origin, and the
  production object store is undecided — so absolutising them for Open Graph is the frontend's job,
  exactly as `canonicalUrl` already specifies.
- **No media document on the wire.** Payload expands an upload relationship into a full record — id,
  `filename`, `prefix`, MIME type, filesize, focal point, timestamps. Everything beyond the four
  fields above describes how the CMS stores the object, so it is dropped by allow-list.
- **`:slug` is not locale-specific**, unlike the catalog and blog detail routes: structural page URLs
  stay fixed English across locales ([PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) §6.12).

**Published-state filtering, per §4, is applied twice.** NestJS never sends `draft`, and Payload's own
access control additionally constrains the service identity to published documents. Verified: with the
demo page unpublished, asking Payload directly with the service credential and `draft=true` returns
zero documents.

**Failure semantics, and the one distinction that matters most here:**

| Condition                                                                                     | Answer                            |
| --------------------------------------------------------------------------------------------- | --------------------------------- |
| CMS answered; no published page carries the slug                                              | 404 `NOT_FOUND`                   |
| CMS unconfigured, unreachable, timed out, 4xx/5xx, or a 2xx that is not a Payload find result | 503 `UPSTREAM_UNAVAILABLE`        |
| `?locale=` names an inactive locale                                                           | 400 `INVALID_LOCALE`, no CMS call |

`UPSTREAM_UNAVAILABLE` had no thrower in the platform until now. **A Payload outage never becomes a
404** — that is [ADR-010](./ADR/ADR-010-products-slug-namespace-and-collision-policy.md) §7's principle
applied to a chain one service longer than the one it was written for.

**`meta.localeFallback` is measured, not inferred.** Payload's `fallback: true` serves the default
locale's value without saying so, so the service asks with `fallback-locale=none` first and re-asks
with fallback on only when a localized field is missing — one request for a fully translated locale,
two for an untranslated one.

**Service credential (§4) is implemented** as a Payload API key belonging to a user whose only role is
`service`. `PAYLOAD_INTERNAL_URL` and `PAYLOAD_API_KEY` are read only by `apps/api`; both are
**optional**, and with either absent the Content endpoints answer 503 and log why rather than taking
the whole API down with them.

#### 2.4b `GET /content/globals/:name` — About Us only (20 August 2026)

**One name answers: `about-us`.** The other seven that §2.4's table lists are separate gates, and an
unimplemented name is a **404 here**, decided before any request reaches the CMS — the CMS is not a
routing table and a typo must not surface as an upstream error. No alias and no second path exists.

The response is a curated projection of the Payload `AboutUs` Global, not the document: a hero and
four optional sections (`whoWeAre`, `expertise`, `qualityStandards`, `closing`), each `null` when the
editor has written nothing for it, plus the shared `seo` record. **No id, no `_status`, no
`globalType`, no timestamps, no rich-text AST, no media document** — allow-list projection, verified
by a test that scans the serialized response rather than named properties.

- **Calls to action carry a route _key_, never a URL.** `{ label, route }` where `route` is one of
  `products`, `customized-solutions`, `quality-certifications`, `contact-us`, `request-a-quote`.
  Structural page URLs stay fixed English and are locale-prefixed by `apps/web`
  ([PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) §6.12), so the path a key resolves to is the
  frontend's, exactly as absolutising a social image URL already is. An incomplete or unrecognised
  action is dropped rather than served.
- **A section photograph is `figure: { image: { url, alt, width, height }, caption }`**, or `null`.
  Same four facts and the same origin-relative `url` as the SEO images.
- **`seo.alternates` is always empty**, by decision: `/about-us` is a structural route whose URL is
  identical in every locale, so its `hreflang` set is the `Locale` table rather than CMS translation
  state. Deriving it from Payload would cost a third read to answer something the frontend knows.
- **`whoWeAre.bodyHtml` is sanitized by the same function** every Content response is assembled by.

**Locale handling differs from `/content/pages/:slug`, deliberately.** That route reads strictly
first and falls back only if the strict read came back untranslated — correct for a two-field
document, wrong for a thirty-field one, where a page translated in its hero but not its quality
section would pass the strict test and then be served with every untranslated field **empty**. So the
content read always has Payload's fallback on, and a second `depth=0` read with `fallback-locale=none`
answers the only question fallback state is needed for: did the requested locale supply its own
heading? `meta.localeFallback` reports that. The default locale costs one read, never two.

**The response is an availability envelope, not the content alone.** `data` is
`{ available: true, content: {…} }` or `{ available: false, content: null }` — because a recognised
Global with nothing published is **not** a missing resource, and must not be reported as one:

```json
{ "data": { "available": false, "content": null }, "meta": {} }
```

Payload's own empty document (`{}`) never reaches a consumer. `available: false` is this API's
statement about the resource; the CMS's raw answer stops at the Content module.

**Three conditions, three answers, and they must stay distinguishable:**

| Condition                                                                               | Answer                            |
| --------------------------------------------------------------------------------------- | --------------------------------- |
| A name other than `about-us`                                                            | 404 `NOT_FOUND`, no CMS call      |
| CMS answered; the Global is unpublished, empty, or has no heading                       | **200**, `available: false`       |
| CMS unconfigured, unreachable, timed out, 4xx/5xx, or a 2xx that is not a JSON document | 503 `UPSTREAM_UNAVAILABLE`        |
| `?locale=` names an inactive locale                                                     | 400 `INVALID_LOCALE`, no CMS call |

**`NOT_FOUND` is reserved for a Global this API does not serve at all.** Collapsing "nothing
published yet" into it would make an editor's outstanding work indistinguishable from a name the
platform has never heard of, and would hand `apps/web` a 404 it must then be trusted never to act on
— for a structural corporate URL, acting on it would state that the company has no About page.

`meta.localeFallback` is never reported for an unavailable response: it describes content that was
served, and none was.

`apps/web` maps the three to three: `available: false` → the "not published yet" state; 503 or an
unreachable API → the "unavailable" state; a 404 → the "unavailable" state as well, because for a
name the frontend hardcodes it can only mean a broken deployment. **All of them render HTTP 200, and
none calls `notFound()`.**

**Published-only, verified against a running CMS rather than assumed.** Payload gives Globals no
default `readVersions` access rule, and `executeAccess` grants any authenticated identity when one is
absent — so without an explicit rule the service credential could have read every draft through
`/api/globals/about-us/versions`. The Global declares `readVersions: editorOnly`. Measured with a
draft saved and nothing published: service read `{}`, service read with `?draft=true` `{}`,
service `GET …/versions` **403**, anonymous read **403**, editor read returns the draft.

**The other six paths are unbuilt** because the Globals and collections behind them do not exist.

### 2.5 Page Composition **[NEW DECISION]**

Three pages need data from 3+ sources. Fetching each separately means 3 sequential frontend→NestJS round trips, each potentially triggering a NestJS→Payload hop — directly at odds with the LCP < 2.5s budget ([SEO_ARCHITECTURE.md §6](./seo/SEO_ARCHITECTURE.md#6-performance-seo)).

| Method | Path                            | Auth | Composes                                                                                   |
| ------ | ------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| GET    | `/pages/home`                   | P    | Home Global + 6 categories + 3 latest posts + settings                                     |
| GET    | `/pages/product-category/:slug` | P    | Category + its products + specifications + `ProductCategoryContent` + relevant FAQ entries |
| GET    | `/pages/insights`               | P    | Insights Global + paginated posts + blog categories                                        |

**Aggregation belongs in NestJS, not the frontend** — that is precisely what ADR-003's "NestJS fronts Payload" gateway exists for, and it lets NestJS resolve the Payload hop and the Prisma queries in parallel server-side rather than serialized across the network.

**These are additive, not a replacement.** Resource endpoints (§2.3, §2.4) remain the foundation and stay independently usable. Only three composition endpoints exist, for the three pages that measurably need them — this is deliberately not a `/pages/*` endpoint per route, which would recreate a page-builder API and couple the API to frontend layout.

### 2.6 Form Submissions _(Prisma — all write endpoints)_

| Method | Path                           | Auth | Entity                                                                            |
| ------ | ------------------------------ | ---- | --------------------------------------------------------------------------------- |
| POST   | `/inquiries`                   | P    | `Inquiry` — covers all 7 `inquiryType` values **including Sample Request**        |
| POST   | `/custom-formulation-requests` | P    | `CustomFormulationRequest`                                                        |
| POST   | `/distributor-applications`    | P    | `DistributorApplication`                                                          |
| POST   | `/job-applications`            | P    | `JobApplication`                                                                  |
| POST   | `/downloads/request`           | P    | `DownloadRequest` → returns a signed download URL                                 |
| POST   | `/newsletter/subscribe`        | P    | `NewsletterSubscription` (status `pending`)                                       |
| GET    | `/newsletter/confirm`          | P    | Double opt-in confirmation via emailed token                                      |
| POST   | `/newsletter/unsubscribe`      | P    | Token-based unsubscribe                                                           |
| POST   | `/media/upload`                | P    | Attachments/CVs → MinIO, returns a `Media` id (rate-limited, type/size validated) |

**There is no `/sample-requests` endpoint.** "Request Sample" CTAs POST to `/inquiries` with `inquiryType: 'Sample Request'` and `relatedProductId` set — the approved merge ([DATA_MODEL_GAP_REVIEW.md](./DATA_MODEL_GAP_REVIEW.md)).

#### 2.6a Implemented submission endpoints

`POST /inquiries` and `POST /custom-formulation-requests` are **implemented**; the other seven rows above are not. The paths, the entities and the merge above are unchanged — what follows records the wire shapes the implementation fixed, none of which this section previously stated.

**`inquiryType` is the physical enum label, not the display label.** The seven accepted values are `product_inquiry`, `request_a_quote`, `customized_solution`, `export_and_logistics`, `distribution_partnership`, `general_inquiry`, `sample_request` — the `@map` labels `inquiry_type` already carries in PostgreSQL. The `'Sample Request'` spelling above is the **form option's** label: `schema.prisma` states that human-readable forms belong to the translation catalogs rather than to a Postgres type, and a display label on the wire would change with a rewording and could not survive a submission from `/fa` or `/ar`. This follows `GET /locales`, which serves `ltr`/`rtl` rather than `LTR`/`RTL`.

**Request bodies.** `POST /inquiries` accepts `firstName`, `lastName`, `companyName`, `country`, `email`, `industry`, `inquiryType` and `consentGiven` (all required), plus optional `phone`, `productsOfInterest[]`, `relatedProductId`, `requiredQuantity`, `destinationCountryPort`, `preferredIncoterm` and `message`. `POST /custom-formulation-requests` accepts `companyName`, `country`, `industry`, `email`, `productOrApplication`, `requiredSpecifications` and `consentGiven` (all required), plus optional `phone`, `estimatedQuantity`, `packagingRequirements`, `destinationCountry`, `preferredIncoterm` and `additionalInformation`. **`preferredIncoterm` differs between the two by design** — `EXW`/`FOB`/`CFR`/`CIF`/`Not sure` on Inquiry, without `Not sure` on the formulation request, per [DATA_MODEL_GAP_REVIEW.md](./DATA_MODEL_GAP_REVIEW.md) §2.

**No client-settable internal state.** `id`, `createdAt`, `status`, `userId`, `assignedToId` and `attachmentMediaId` are not accepted on either endpoint. Because the global pipe runs `forbidNonWhitelisted`, sending one answers **400 `VALIDATION_ERROR` naming the property** rather than silently ignoring it. `status` is **server-owned**: it is written as `new`, which means _initial ingestion state and nothing more_ — it defines no workflow, authorizes no transition, and has no second value ([DATA_MODEL.md](./DATA_MODEL.md) §2 Notes).

**Consent evidence is persisted, and is not on the wire in either direction — implemented 18 August 2026.** Both entities now store `privacyPolicyVersion`, the Privacy Policy revision the consent was given against ([SECURITY.md](./SECURITY.md#personal-data-retention), [DATA_MODEL.md](./DATA_MODEL.md)). **The request cannot set it**: like `status`, the field is undeclared on both DTOs, so sending it answers **400 `VALIDATION_ERROR`** naming the property. **The response does not return it**, and the response shape is unchanged — still `data: { id, createdAt }` with `meta: {}`. The value is a constant owned by `apps/api`; **no Payload call is made during a submission**, so neither endpoint's availability, latency or failure modes depend on the CMS. It is `null` while no approved Privacy Policy exists, which is the current state.

**Response.** **201** with `data: { id, createdAt }` and `meta: {}`. Deliberately not the stored record: `status` and `assignedToId` are lead-routing state SECURITY.md scopes to Admin and the assigned Sales Expert, and echoing the submitter's own contact details back serves no consumer.

**`relatedProductId` is validated, not merely referenced.** An id naming no `Product` answers **400 `VALIDATION_ERROR`** with `details[].field` = `relatedProductId` — not 404, which would describe the request as a request for that product rather than as a submission carrying an unusable field.

**Both endpoints are rate-limited at 5 per hour per client — implemented.** §Rate limits' "Form submissions (all others)" row is enforced by `@nestjs/throttler`, and the budget is **shared across the two paths** rather than five each, because that row budgets an endpoint _group_: alternating between `/inquiries` and `/custom-formulation-requests` does not buy a sixth submission. Exceeding it answers **429 `RATE_LIMITED`** in the standard envelope, with a `Retry-After` header as §8 requires and a message that names no limit, window or counter. `X-RateLimit-Limit`/`-Remaining`/`-Reset` are set on accepted requests.

**The limit reaches these two endpoints and nothing else.** No global guard is registered, so every public GET — products, categories, blog, locales, health, SEO — is untouched: §Rate limits' 100/min for reads remains contracted and unimplemented, which is the honest state rather than reads silently inheriting a 5/hour budget meant for writes.

Two conditions on it, both recorded rather than solved: the counter is **in-process**, correct only for the single-instance topology ADR-005 deploys and requiring a shared store before any second `apps/api` instance exists; and the client is identified by `req.ip`, which behind nginx resolves to the proxy unless `trust proxy` is configured as part of the deployment work. See [ROADMAP.md](./ROADMAP.md).

**Rate limiting is not the anti-spam control.** §Rate limits also specifies an **invisible captcha** on public forms. No provider is selected and none is implemented; the two are separate requirements and the limit does not satisfy the captcha one.

**`/downloads/request` [NEW DECISION]:** submitting the gating form returns a **short-lived signed URL** (suggested TTL: 15 minutes, single-use), not a permanent public link. A permanent link defeats the gate — it gets shared, and the lead capture stops happening. Applies only to the Company Catalogue and Product Catalogue; **TDS/SDS are served as plain public URLs with no form and no endpoint**, per the approved gating scope.

### 2.7 Search & Filtering

**[NEW DECISION] No dedicated `/search` endpoint in Phase 1.** The only search surface in the approved site structure is the Product Finder; the 404 page's search field points at the same thing. A global cross-content search isn't specified anywhere, and building one speculatively is exactly the future-phase infrastructure `AI_CONTEXT.md`'s constraints rule out. `GET /products` carries it:

```
GET /products?category=base-oils&segment=marine&productType={product-type-slug}
             &q=SN%20500&locale=en&page=1&limit=20&sort=-createdAt
```

`q` matches product name, slug, and specification values — **specification matching matters most**, because real buyer queries are grade strings ("SN 500", "ISO VG 46", "15W-40") that live in `Specification.value`, not in prose. Canonical URL rules for filtered lists per [SEO_ARCHITECTURE.md §7](./seo/SEO_ARCHITECTURE.md#7-canonical-strategy-for-filtered--paginated-views).

`{product-type-slug}` is a placeholder, not a value: **no Product Type name or slug is approved** ([ADR-008](./ADR/ADR-008-b2-filter-contract-and-segment-vocabulary.md)), and printing a plausible one here would read as approved vocabulary.

**Filter parameters.** `category`, `q`, `locale`, `page`, `limit` and `sort` are the live contract and are unchanged. The table below records what the Product Taxonomy v2 pass decided about the rest — the Status column gives each parameter's current implementation state: `segment` and `productType` are implemented, `industry` is retired, `application` is unresolved, and `packaging` is pending.

| Parameter     | Status          | Contract                                                                                                                                                                                                              |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `segment`     | **Implemented** | A `Segment` slug. Locale-aware and matched exactly; no subtree, because Segment has no hierarchy. The eight approved slugs are in [DATA_MODEL.md](./DATA_MODEL.md) §2 Notes                                           |
| `productType` | **Implemented** | A `ProductType` slug. Locale-aware, matched exactly. Named `productType` and not `type`, which `Media.type` and `Inquiry.inquiryType` already spend and which no later type-shaped facet could then reuse             |
| `industry`    | **Retired**     | Superseded by `segment`. **Not a rename**: the `industry=automotive` this example URL previously carried maps to no approved Segment, and no automatic mapping from any `industry` value to any Segment is authorized |
| `application` | **Unresolved**  | Mapped to **neither** `segment` nor `productType`. Blocked on the open sub-range ↔ Product Type decision in [ADR-007](./ADR/ADR-007-product-taxonomy-v2.md), which no implementation may close                        |
| `packaging`   | **Pending**     | An independent future facet, **not superseded** by either taxonomy axis. No entity backs it yet (ADR-007 §10)                                                                                                         |

**Combination semantics.** Every filter present is combined with **AND** — `category` + `segment`, `category` + `productType`, `segment` + `productType`, and all three together. `q` keeps its internal OR across name, slug and specification values, and joins the rest as a single AND term. `locale` is orthogonal: it selects which slug vocabulary is accepted and which language is returned, never which rows match. Filtering is applied **before** pagination, so `meta.total` counts the filtered set. `sort` is unaffected. **Multi-value taxonomy filters (`?segment=a,b`) are unsupported and deferred.**

**Slug resolution and unknown slugs.** `segment` and `productType` resolve exactly as `category` already does: the requested locale's translated slug first, the entity's own slug second. A value matching neither is **400 `VALIDATION_ERROR`**, with `details[].field` set to `segment` or `productType`; the rejected slug is never echoed into `message` (§8). An empty 200 is deliberately not the answer — it is indistinguishable from a genuinely empty Segment. A blank or whitespace-only value is treated as **omitted**, and a valid slug matching no products is **200 with an empty list**.

### 2.8 SEO

| Method | Path                   | Auth | Purpose                                                             |
| ------ | ---------------------- | ---- | ------------------------------------------------------------------- |
| GET    | `/seo/sitemap-entries` | P    | Every indexable URL, **one entry per entity per translated locale** |
| GET    | `/seo/redirects`       | P    | Active `Redirect` rows for `apps/web` middleware                    |

### 2.9 RAG _(future — see §6)_

| Method | Path          | Auth  | Purpose                                  |
| ------ | ------------- | ----- | ---------------------------------------- |
| GET    | `/rag/export` | **S** | Allow-listed public content for indexing |

### 2.10 Admin _(all endpoints authenticated + RBAC-enforced)_

The Admin Dashboard lives inside `apps/web` as a separate application area (approved decision — see [ARCHITECTURE.md](./ARCHITECTURE.md#admin-dashboard) and [FRONTEND_ARCHITECTURE.md](./frontend/FRONTEND_ARCHITECTURE.md)). It calls **only** `/api/v1/admin/*` — never Payload, never a database. ADR-003 holds without exception.

**[NEW DECISION] Admin operations live under a dedicated `/admin/*` namespace rather than reusing public resource paths with an auth check.** The two surfaces genuinely differ: public `GET /products` returns published, single-locale, SEO-shaped data and is **cached aggressively**; admin needs unpublished records, all locales, and audit fields, and must **never** be cached. Serving both from one path means the cache layer has to vary on authentication state — a well-known source of cache-poisoning bugs where an admin response leaks to an anonymous request. Separate namespaces make "public is cacheable, admin is not" a structural property rather than a configuration detail someone must get right.

| Group            | Paths                                                                                                                                                | Roles                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Catalog          | `/admin/products`, `/admin/categories`, `/admin/specifications` (CRUD)                                                                               | Admin                                                                    |
| Blog             | `/admin/blog/posts`, `/admin/blog/categories`, `/admin/blog/tags` (CRUD)                                                                             | Admin, Content Manager                                                   |
| Leads            | `/admin/inquiries`, `/admin/custom-formulation-requests`, `/admin/distributor-applications`, `/admin/download-requests` (list, read, assign, status) | Admin (all) · Sales Expert (**own leads only**) · Content Manager (read) |
| Job applications | `/admin/job-applications`                                                                                                                            | **Admin only**                                                           |
| Newsletter       | `/admin/newsletter/subscriptions` (list, export, suppress)                                                                                           | Admin                                                                    |
| Users            | `/admin/users` (CRUD, role assignment)                                                                                                               | Admin                                                                    |
| Locales          | `/admin/locales` (CRUD)                                                                                                                              | Admin                                                                    |
| Redirects        | `/admin/redirects` (CRUD)                                                                                                                            | Admin                                                                    |
| SEO              | `/admin/seo-meta` (edit `SeoMeta` for Prisma entities)                                                                                               | Admin, Content Manager                                                   |
| Translations     | `/admin/content-translations` (edit, set `translationStatus`)                                                                                        | Admin, Content Manager                                                   |

**Rules that apply to every endpoint above:**

- `Cache-Control: no-store` — always. Admin responses are never cached at any layer.
- **Every mutation writes a `StatusHistory` row** where the entity supports it — who changed what, when.
- **Lead scoping is enforced server-side**, never by the client sending its own filter. A Sales Expert requesting `/admin/inquiries` receives only their assigned leads because NestJS applies the constraint — not because the UI asked nicely.
- **`/admin/job-applications` has no assignment endpoint at all.** `JobApplication` carries no `assignedToId` by design; there is no route to put a CV in a Sales queue, which is the API-level expression of that decision.
- **Nothing under `/admin/*` touches `sam_cms`.** Payload content is edited in Payload's own admin UI — see §2.11.

**Implementation status — the Users list, and the read half of the Leads group.**

`GET /admin/users` is live, as **list only**: it answers `data: [{ id, email, role, status }]` with `meta.total`, `Cache-Control: no-store`, and **Admin alone** — every other role receives **403 `FORBIDDEN`** with a message naming neither the caller's role nor the required one. The rest of the Users group (create, update, **role assignment**) is unbuilt; role assignment in particular is privilege management and needs its own gate.

**The Leads group is live for `Inquiry` and `CustomFormulationRequest`, read-only** — 19 August 2026. Four endpoints:

| Method | Path                                     | Answers                                             |
| ------ | ---------------------------------------- | --------------------------------------------------- |
| GET    | `/admin/inquiries`                       | a page of lead rows, `meta: { total, page, limit }` |
| GET    | `/admin/inquiries/:id`                   | one submission, or 404                              |
| GET    | `/admin/custom-formulation-requests`     | a page of request rows, same `meta`                 |
| GET    | `/admin/custom-formulation-requests/:id` | one request, or 404                                 |

- **Roles: Admin, Content Manager, Sales Expert** — the "Forms & Leads" row of [SECURITY.md](./SECURITY.md#rbac-permission-matrix) applied unchanged. `Customer` receives **403**; no token receives **401**. **Sales Expert is scoped server-side** to `assignedToId = <their own id>`, derived from the authenticated caller; no endpoint accepts an `assignedToId` parameter, and sending one is answered **400 `VALIDATION_ERROR`** naming it. **No lead is assigned to anyone today** — there is no assignment endpoint — so a Sales Expert's list is legitimately empty.
  **Assign and status are now built** ([ADR-013](./ADR/ADR-013-lead-assignment-and-status-workflow.md)), completing the group's contracted "list, read, assign, status":

| Method | Path                                                            | Roles                            |
| ------ | --------------------------------------------------------------- | -------------------------------- |
| PATCH  | `/admin/{inquiries,custom-formulation-requests}/:id/assignment` | **Admin only**                   |
| PATCH  | `/admin/{inquiries,custom-formulation-requests}/:id/status`     | Admin (any) · Sales Expert (own) |
| GET    | `/admin/{inquiries,custom-formulation-requests}/:id/history`    | Admin · Sales Expert (own)       |

- **Narrow sub-resource commands, never a generic `PATCH /:id`.** The two mutations have different role lists, write different audit tables and validate differently; one handler would authorize per-field inside the body. No POST, no DELETE, no bulk operation.
- **`status` body:** `{ from, to, note? }`, both from `new | in_progress | closed`. `from` is the compare-and-set predicate — a stale value answers **409 `CONFLICT`**, never a silent overwrite. Transitions: `new→in_progress`, `new→closed`, `in_progress→closed`, `closed→in_progress`. Anything else, including any `X→X`, is **400**.
- **`assignment` body:** `{ fromAssigneeId, assigneeId }`, both nullable — `null` means unassigned. An assignee must be an **active Sales Expert**; anything else is 400 naming `assigneeId`.
- **404, not 403, for a lead outside a Sales Expert's scope** on every one of these routes — the same non-disclosure rule the detail read follows.
- **History publishes email snapshots, not user ids**, and is nested under the lead. There is no global audit-log endpoint.
- **`assigneeId` is now on the read projections.** It was withheld before this gate; the assignment control needs it as its compare-and-set predicate.

- **Read-only no longer describes the group.** It was, before this gate. There is no `PATCH`, `POST` or `DELETE` under either path, no assignment, no notes, no tags and no export. `status` is served as stored and remains the **initial ingestion state `new`** with no authorized transition and no second value — a lifecycle is a separate gate, together with the `StatusHistory` audit trail [DATA_MODEL.md](./DATA_MODEL.md) §2 anchors for it.
- **Pagination**: `?page` (≥1, default 1) and `?limit` (1–100, default 25), per §Pagination & Filtering in [API_DESIGN.md](./API_DESIGN.md). `?sort=-createdAt` (default) or `createdAt`; **`id` is applied as a secondary key in the same direction**, so page boundaries are deterministic when timestamps tie. The count and the page are read in one transaction, so `meta.total` describes the snapshot the rows came from. A page past the end is an empty array with the real `total`, not a 404.
- **Filters**: `/admin/inquiries` accepts `?inquiryType=`, restricted to the same seven values `POST /inquiries` accepts. **No other filter exists on either endpoint** — no `q`, no date range, no `status`, no country facet — and `forbidNonWhitelisted` answers **400** naming any undeclared parameter rather than ignoring it. `/admin/custom-formulation-requests` accepts no filter at all: the entity has no enumerated column.
- **Projections are explicit, and the list is narrower than the detail.** The list omits every free-text body (`message`, `requiredSpecifications`) — those appear only on the detail response. **`userId`, `assignedToId` and `attachmentMediaId` are omitted from every response**, list and detail alike. `relatedProductId` is served as an id and is never resolved to a product name.
- **`:id` is validated as a UUID** before any query runs; a malformed segment is **400** naming `id`, never a 500. A row outside the caller's scope is **404, not 403** — a 403 would confirm that an id names a real record.
- `Cache-Control: no-store` on all four, as on every `/admin/*` response.
- **The Admin Dashboard mirrors these three roles** at `/admin/leads/**`, while `/admin` itself stays Admin-only — authorization per area, not per surface ([SECURITY.md](./SECURITY.md#admin-dashboard-access)). The UI decides entry only; record scoping stays here.

Every other group in the table above — Catalog, Blog, Job applications, Newsletter, Locales, Redirects, SEO, Translations — is unbuilt, as are `/admin/distributor-applications` and `/admin/download-requests`, whose entities have no write path yet.

### 2.11 What the Admin Dashboard does _not_ manage

The split follows the **ADR-002 database boundary exactly**, which makes it easy to reason about: _whichever database owns the data owns the UI that edits it._

| Managed in Admin Dashboard (`apps/web`)          | Managed in Payload Admin (`apps/cms`)          |
| ------------------------------------------------ | ---------------------------------------------- |
| Products, Categories, Specifications             | Company/brand page Globals (Home, About Us, …) |
| Blog posts, categories, tags                     | Legal `Pages`                                  |
| All form submissions & leads                     | `ProductCategoryContent`                       |
| Job applications _(Admin only)_                  | `FaqEntries`                                   |
| Newsletter subscriptions                         | `Certifications` _(Admin publishes)_           |
| Users & roles                                    | `JobOpenings`                                  |
| Locales, Redirects                               | Header, Footer, Settings Globals               |
| `SeoMeta`, `ContentTranslation` (Prisma content) | Payload Media (editorial images/video)         |

**This means two admin UIs, and that cost is real** — a Content Manager updating a product category page edits catalog data in the Admin Dashboard and editorial copy in Payload. It's the unavoidable consequence of ADR-002, not a design preference: Payload structurally cannot reach `sam_platform`, and building a second CMS inside the Admin Dashboard to avoid the split would be far worse. **Mitigation:** each surface deep-links to its counterpart — a product category row in the Admin Dashboard links to its Payload editorial record and vice versa — so the boundary is navigable rather than something editors have to memorize.

---

## 3. Localization Handling

- **Every content-bearing endpoint accepts `?locale=`.** Omitted → platform default (`en`).
- **Invalid or inactive locale → 400**, not a silent fallback. A typo'd locale silently serving English is the kind of bug that survives to production.
- **Fallback within a valid locale**: untranslated fields fall back to default-locale content (Payload `fallback: true`; equivalent behavior for `ContentTranslation`). Responses include `meta.localeFallback: true` when any field fell back, so the frontend can decide whether to surface a "not yet translated" notice.
- **Slugs are locale-specific** for products, categories, and blog posts — resolved server-side against `ContentTranslation`. Structural page paths stay fixed English across locales ([FRONTEND_ARCHITECTURE.md §2](./frontend/FRONTEND_ARCHITECTURE.md)).
- **`SeoFields` returns the requested locale's SEO record**, never the default's, plus `alternates` listing locales with a **real** translation — omitted, not stubbed, for untranslated locales ([INTERNATIONALIZATION_STRATEGY.md §4](./i18n/INTERNATIONALIZATION_STRATEGY.md#4-seo-localization)).
- **`/seo/sitemap-entries` emits one entry per entity per translated locale**, each with its localized path — never one entry per entity with a locale switcher implied.

**Fallback and `hreflang` deliberately disagree, and that's correct.** Content falls back so a page renders rather than showing blanks; `hreflang` does _not_ advertise a locale as translated when it isn't, because pointing search engines at a thin fallback page is worse than omitting it.

---

## 4. Payload Integration

- **Server-to-server only.** NestJS's Content module calls Payload's REST API over the internal network with a service credential. Payload is never publicly routable and never receives an end-user's JWT.
- **Published-state filtering is mandatory and applied by NestJS**, not trusted from the caller. Public endpoints request published content only; `?draft=true` is never honored from a public request. **Certifications are the sharpest case** — an unpublished certification is likely a placeholder, and surfacing one is exactly what the Admin-publish gate exists to prevent ([PAYLOAD_CONTENT_ARCHITECTURE.md](./content/PAYLOAD_CONTENT_ARCHITECTURE.md)).
- **Normalization**: Payload's shapes (rich-text AST, `docs[]` wrappers, relationship expansion) are internal. NestJS maps them into the platform envelope. If a Payload field shape changes, only the Content module changes — the frontend contract holds.
- **Caching**: CMS content changes infrequently and is cached aggressively in NestJS, tagged by Global/collection so invalidation can be surgical. `apps/web` layers Next.js's own fetch cache on top.

**[NEW DECISION] Publish-triggered revalidation, replacing TTL-only invalidation.** Long an open follow-up in both the SEO and frontend documents; resolving it here:

```
Editor publishes in Payload
   └─▶ Payload afterChange hook  ──▶  POST /api/v1/internal/revalidate   (service token)
                                          └─▶ NestJS drops its cache tag
                                          └─▶ NestJS calls apps/web's revalidation hook
```

TTL-only means an editor publishes a correction and waits out the TTL with no feedback — they retry, re-edit, or conclude the CMS is broken. The endpoint is internal, service-token-only, and never public.

**Draft preview remains open** — see Remaining Blockers.

---

## 5. Prisma Integration

All of `sam_platform`. Payload never touches it (ADR-002).

- **Reads** — products, categories, specifications, blog, locales, redirects, SEO. Public, cacheable, locale-filtered.
- **Writes** — the six submission entities (§2.6). All public, all rate-limited, all validated, all requiring `consentGiven`.

### Submission handling, uniformly

Every submission endpoint: validates → persists → returns `201` with a reference id (never the full record echoed back).

**Corrected to the approved behaviour.** This step previously read "validates → persists → writes an initial `StatusHistory` row → fires notification → returns `201`". The `StatusHistory` write is still not implemented; the notification now is, in the form described below.

- **No `StatusHistory` row is written on submission.** `status` is set to `new` and never changes, so there is no transition to record ([DATA_MODEL.md](./DATA_MODEL.md) §2 Notes). The audit trail arrives with the Admin workflow that first moves a submission out of `new`.
- **An internal notification is attempted after the write, and it is outside the success condition.** Implemented 18 August 2026 for the two live endpoints (§2.6a). The row is committed and the `201` payload composed _before_ any mail is attempted; **a delivery failure never invalidates, rejects or loses an already-persisted submission** — it is logged for operations and nothing more.

**Lead notification, as built:**

|                       |                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism             | **SMTP relay via `nodemailer`**, called server-side from `apps/api` only. No HTTP transactional provider, no commercial account, no third-party SDK.                                                                                                                            |
| Direction             | **Internal only.** One message per persisted submission to the mailbox named by `LEAD_NOTIFICATION_TO`.                                                                                                                                                                         |
| Buyer acknowledgement | **None.** Nothing is sent to the person who submitted the form, and no form's success copy claims otherwise.                                                                                                                                                                    |
| Sender / recipient    | Environment configuration (`MAIL_FROM`, `LEAD_NOTIFICATION_TO`) with **no defaults and no mailbox hard-coded anywhere in code or documentation**. The production values have not been supplied.                                                                                 |
| Unconfigured          | The API still boots, forms still validate, still persist and still answer `201`; the notification is skipped and logged with the names of the missing variables. A partial configuration is treated as unconfigured rather than attempted.                                      |
| Timeout               | **5 seconds for the whole attempt**, bounded both by nodemailer's per-phase timeouts and by an overall cap. An unreachable relay therefore adds up to ~5 s to a submission's response and never more.                                                                           |
| Retry                 | **None.** One attempt. No queue, no scheduler, no backoff, no Redis.                                                                                                                                                                                                            |
| Delivery state        | **Not persisted.** No `notifiedAt`, no `deliveryStatus`, no retry counter and no notification table — this gate added no schema at all.                                                                                                                                         |
| Content               | Persisted submission fields only, as **plain text with no HTML part**, so submitted markup can never be executable. `relatedProductId` appears as the id; no product name is resolved, because a catalog read has no business in a path whose failure is defined not to matter. |
| Response              | **Unchanged** — `201` with `data: { id, createdAt }`, `meta: {}`. Delivery success or failure is never exposed to the submitter.                                                                                                                                                |

**Still undecided, and deliberately not decided here:** the production mailbox, relay host and credential; whether the buyer ever receives an acknowledgement; reply-to behaviour (**no `Reply-To` header is set**); and whether a durable retry or delivery audit is ever built — the last would need both a queue and schema, and is a separate architecture gate.

- **Inquiry workflow** — `status` transitions recorded in `StatusHistory`; `assignedToId` routes to a Sales Expert. Sales Expert sees own leads only ([SECURITY.md](./SECURITY.md)).
- **Distributor applications** — same lead-routing shape as Inquiry.
- **Job applications** — **Admin-only on read, no `assignedToId`, never in a Sales queue.** The API must not expose these under any Sales-scoped endpoint. Deliberately a different access path from every other submission.
- **Downloads** — lead captured, then a signed URL issued (§2.6).
- **Newsletter** — `pending` on subscribe; `confirmed` only after the emailed token is used. **Never `confirmed` on submit** — that would make double opt-in decorative.

---

## 6. RAG Export API

`GET /api/v1/rag/export` — **service token only**, read-only scope, never public.

```
GET /api/v1/rag/export?since=<ISO8601>&locale=<code>&cursor=<opaque>&limit=100
```

### Response shape

```json
{
  "data": {
    "items": [
      {
        "sourceType": "product",
        "sourceId": "...",
        "locale": "en",
        "url": "/en/products/base-oils",
        "title": "...",
        "content": "...",
        "contentHash": "...",
        "publishedAt": "...",
        "updatedAt": "..."
      }
    ],
    "deletions": [
      { "sourceType": "certification", "sourceId": "...", "locale": "en", "reason": "unpublished" }
    ]
  },
  "meta": { "cursor": "...", "hasMore": true, "generatedAt": "..." }
}
```

### Allowed `sourceType` values — allow-list, exhaustive

`product` · `specification` · `category` · `blog_post` · `product_category_content` · `company_page` · `faq_entry` · `certification` · `legal_page` · `product_document`

**Any type not on this list is not exportable.** New entities are excluded by default; adding one requires a deliberate documented change. A deny-list would fail open — with CVs and customer confidential specifications in this database, failing open once is a breach ([RAG_IMPLEMENTATION_ARCHITECTURE.md §2](./ai/RAG_IMPLEMENTATION_ARCHITECTURE.md)).

### Published-state rules

Only published content is ever exported: `BlogPost.publishedAt` set and in the past; Payload content published (never draft); **certifications published and Admin-approved**. Unpublishing must emit a `deletions` entry — an expired certification whose vectors survive means an assistant keeps asserting a certification the company no longer holds.

### Excluded — never exportable at any tier

`JobApplication` · CV files · `Inquiry` · `CustomFormulationRequest` · `DistributorApplication` · `DownloadRequest` · `NewsletterSubscription` · `User` · `Organization` · `StatusHistory` · per-batch COA documents.

**`product_document` filters `Media` by `ownerType == 'Product'` — an allow-list, never a deny-list.** `Media` is polymorphic and holds product documents _alongside_ customer-uploaded confidential specifications and CVs. An unfiltered media export leaks both in one call. This is the single most likely way this endpoint gets built wrong.

### Deletions are as important as additions

The endpoint must report unpublications and deletions, not just changes. An export returning only "what's currently published" produces a corpus that only grows and silently accumulates stale claims.

---

## 7. Security

### Authentication

JWT issued only by NestJS. Access token 15 min (Authorization header); refresh token 7 days (httpOnly, secure, same-site cookie, never localStorage). argon2id password hashing. Service tokens for RAG export and internal revalidation are separate credentials with narrow scope — never a user JWT.

### Authorization

[SECURITY.md](./SECURITY.md)'s RBAC matrix is the source of truth, enforced in NestJS guards. Two carve-outs the API must respect specifically:

- **Job Applications: Admin-only.** Content Manager and Sales Expert get `none`, not read.
- **Certifications: Admin publishes.** Enforced in Payload's own access control too, since editing happens in the CMS UI.

### Rate limits **[NEW DECISION]**

`SECURITY.md` requires rate limiting but names no numbers. Concrete starting points, per IP:

| Endpoint group                | Limit                    | Why                                                               |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `POST /newsletter/subscribe`  | 3 / hour                 | Ungated email field — the easiest abuse surface on the site       |
| `POST /media/upload`          | 5 / hour                 | Storage-cost abuse vector                                         |
| Form submissions (all others) | 5 / hour                 | Generous for humans, hostile to bots                              |
| `POST /downloads/request`     | 10 / hour                | Legitimate users download several documents                       |
| `GET /auth/login`             | 5 / 15 min, then backoff | Credential stuffing                                               |
| Public GET endpoints          | 100 / min                | Effectively server-to-server (all frontend calls are server-side) |
| `GET /rag/export`             | 10 / min                 | Service client; bulk by design                                    |

**Two of the seven are enforced**: form submissions at 5/hour, and **login at 5 per 15 minutes**, each on its **own budget**. The login row's `GET` is a typo for the `POST /auth/login` §2.2 contracts, and the numbers are what was read from it. The two buckets are deliberately separate — sharing one would let form-submission volume lock staff out of the Admin surface, and let login attempts consume a lead's ability to submit. **"then backoff" is implemented as a block for the remainder of the window, not as escalation**: a genuinely escalating backoff needs per-client violation history, which the in-process storage does not keep. The remaining five groups have no throttler because the endpoints behind them do not exist, and the public GET budget is deliberately unenforced.

Numbers are a starting point to tune against real traffic, not a permanent commitment. **Invisible captcha** on public forms, per the site structure — never a visible challenge, which costs real B2B leads.

### Input validation

`class-validator` DTOs at the boundary, `whitelist: true` (unknown fields rejected). Rich text and free-text sanitized before storage. Uploads validated on **MIME type and magic bytes, not extension**, with a size cap. Locale validated against active `Locale` rows. `consentGiven` must be `true` — a submission without consent is rejected, not stored-and-flagged, since storing it is the thing consent governs.

---

## 8. Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": [{ "field": "email", "issue": "must be a valid email address" }]
  }
}
```

| Code                   | HTTP | Meaning                                                                                                    |
| ---------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400  | Field-level failure; `details` populated                                                                   |
| `INVALID_LOCALE`       | 400  | Locale not in the active list                                                                              |
| `UNAUTHENTICATED`      | 401  | Missing/expired token                                                                                      |
| `FORBIDDEN`            | 403  | Authenticated, insufficient role                                                                           |
| `NOT_FOUND`            | 404  | Resource or slug doesn't exist in this locale                                                              |
| `CONFLICT`             | 409  | e.g. already-confirmed newsletter subscription                                                             |
| `PAYLOAD_TOO_LARGE`    | 413  | Upload exceeds cap                                                                                         |
| `RATE_LIMITED`         | 429  | Includes `Retry-After`                                                                                     |
| `INTERNAL_ERROR`       | 500  | Generic; details logged server-side, never returned                                                        |
| `UPSTREAM_UNAVAILABLE` | 503  | Payload/MinIO unreachable — distinguishable from a genuine 500 so the frontend can retry rather than error |

Never leak stack traces, ORM errors, or upstream messages in production. `message` is safe to display; `details` is safe to map to form fields.

---

## Files Updated

- **Created** `docs/API_CONTRACT_FINAL.md` (this document).
- **Updated** [API_DESIGN.md](./API_DESIGN.md) with a pointer marking this document authoritative for endpoints.

## New Decisions Made

1. **Three page-composition endpoints** (`/pages/home`, `/pages/product-category/:slug`, `/pages/insights`) alongside pure resource endpoints — aggregation belongs in the gateway, and only for the three pages that measurably need it.
2. **Publish-triggered revalidation** via an internal service-token endpoint, replacing TTL-only cache invalidation. Closes a follow-up left open in both the SEO and frontend documents.
3. **No dedicated `/search` endpoint** — the Product Finder is the only specified search surface; `GET /products` serves it, with specification-value matching because real queries are grade strings.
4. **Gated downloads return short-lived single-use signed URLs** (~15 min), not permanent links — a permanent link gets shared and the gate stops capturing leads.
5. **Concrete rate limits per endpoint group**, replacing "rate limiting exists" with numbers.
6. **Password reset deferred** to the admin-surface build — no Phase 1 page authenticates a public user.
7. **Invalid locale returns 400**, not a silent fallback to default.
8. **`UPSTREAM_UNAVAILABLE` (503)** added to the error catalog, distinguishing a Payload/MinIO outage from a genuine server error.

## Remaining Blockers Before Implementation

1. **RESOLVED — Admin Dashboard lives inside `apps/web`** as a separate application area, no fourth app, communicating only through NestJS. Specified in §2.10/§2.11 above. **The follow-on question it raised — how staff reach Payload's admin UI — is also RESOLVED, 7 August 2026:** Payload Admin uses **separate authentication**. Editors sign in at `cms.<domain>/admin` with a Payload account held in `sam_cms`; NestJS does not manage Payload sessions; there is **no SSO bridge** and **no account syncing from `User`**; cookies are never shared between the two hosts. Payload maintains its own role model (minimum `Admin`, `Content Manager`) mirroring the CMS-facing RBAC rules, including the Admin-only certification publish gate. Recorded as [ADR-006](./ADR/ADR-006-payload-admin-authentication.md); `ARCHITECTURE.md` and `SECURITY.md` amended accordingly. **Accepted cost:** staff sign in twice — the §2.11 deep-linking mitigation makes the boundary navigable but does not remove the second login. **No longer blocks M2.**
2. **DECIDED — draft preview is DEFERRED for Phase 1 (20 August 2026).** The question was open, and the CMS Editorial Operations gate is where it had to be answered rather than defaulted. The decision is that **no preview mechanism is built**: no Next.js draft mode, no preview token, no `draft=true` browser path, and no editor preview link. **Published public reads remain the only public content path**, and the API never sends `draft` to Payload. The cost is accepted and stated rather than mitigated: an editor sees an unpublished page only in Payload's own admin UI, and confirms it on the live site after publishing. Reopening this is a decision of its own, and it becomes more expensive once response caching assumes published-only.
3. **Legal/content prerequisites**, unchanged and already tracked: Privacy Policy (every form's consent checkbox is inert without it), retention periods, and the `[TO CONFIRM]` content items in [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed).
4. **Email delivery is partially resolved.** **Internal lead notification is built** — SMTP via `nodemailer`, outside the persistence success path, described under §5 above. **The remaining three flows still have no mechanism**: newsletter double opt-in, acknowledgements to the buyer, and download links. What is missing for all of them, this one included, is **operational rather than architectural** — a production mailbox, a relay host and credential, and a sender domain with its deliverability records. Those are the client's to supply; until they are, notifications are skipped and logged, and no lead is lost.
