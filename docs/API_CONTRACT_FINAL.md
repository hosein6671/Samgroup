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

| Method | Path                               | Auth | Purpose                                                                                                                                                    |
| ------ | ---------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/content/globals/:name`           | P    | One Payload Global: `home`, `about-us`, `products-landing`, `customized-solutions`, `export-logistics`, `quality-certifications`, `contact-us`, `faq-page` |
| GET    | `/content/pages/:slug`             | P    | Legal pages from the `Pages` collection                                                                                                                    |
| GET    | `/content/product-categories/:key` | P    | `ProductCategoryContent` — editorial copy for a category page                                                                                              |
| GET    | `/content/faq`                     | P    | `FaqEntries`; `?category=` filter. Feeds both `/faq` and per-product-page FAQ blocks from one source                                                       |
| GET    | `/content/certifications`          | P    | **Published certifications only** — see §4                                                                                                                 |
| GET    | `/content/job-openings`            | P    | Open vacancies                                                                                                                                             |
| GET    | `/content/navigation`              | P    | Header + Footer Globals — consumed by the root layout                                                                                                      |
| GET    | `/content/settings`                | P    | Site-wide settings: `Organization` schema data, default OG image, contact details                                                                          |

#### 2.4a Implementation status — 16 August 2026

**One of the eight paths is implemented, and no path was added, renamed or reshaped.**

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

**The other seven paths are unbuilt** because the Globals and collections behind them do not exist.

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

**Corrected to the approved behaviour.** This step previously read "validates → persists → writes an initial `StatusHistory` row → fires notification → returns `201`". Neither the `StatusHistory` write nor the notification is implemented, and the flow above is what the two live endpoints (§2.6a) actually do.

- **No `StatusHistory` row is written on submission.** `status` is set to `new` and never changes, so there is no transition to record ([DATA_MODEL.md](./DATA_MODEL.md) §2 Notes). The audit trail arrives with the Admin workflow that first moves a submission out of `new`.
- **No notification is fired.** No email or notification infrastructure exists anywhere in the platform — no provider, dependency, credential, queue, or template. The success copy on every form is written to match ("Your inquiry has been received"), claiming nothing was sent and nobody was told.

**Approved architecture for notification, when it is built:** it is **not** in the persistence success path. A submission is validated, persisted, and answered `201` first; notification is attempted separately afterwards. **A delivery failure must never invalidate, reject or lose an already-persisted inquiry** — it is logged for operations and nothing more. The outbound provider, the internal recipient address(es), whether the buyer receives an acknowledgement, reply-to behaviour, retry strategy and whether delivery status is persisted are all **undecided**; a durable retry or delivery audit would additionally need schema this gate has not added.

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
2. **Draft preview is unresolved.** Editors currently have no way to see an unpublished page before publishing — they publish blind, or publish-then-check on the live site. Standard fix is an authenticated preview path (Next.js draft mode + a NestJS endpoint honoring `draft=true` for authenticated Content Managers). Cheap now, awkward to retrofit once caching assumes published-only. Recommend deciding before M3.
3. **Legal/content prerequisites**, unchanged and already tracked: Privacy Policy (every form's consent checkbox is inert without it), retention periods, and the `[TO CONFIRM]` content items in [SITE_STRUCTURE.md](./SITE_STRUCTURE.md#outstanding-confirmations-needed).
4. **Email delivery is unspecified.** Four flows now depend on it — newsletter double opt-in, form acknowledgements, download links, and admin notifications — and no provider, sender domain, or deliverability plan exists in any document. Not an API-contract blocker, but it blocks §2.6 functioning end-to-end.
