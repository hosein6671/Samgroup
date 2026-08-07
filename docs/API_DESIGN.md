# API Design

> **[API_CONTRACT_FINAL.md](./API_CONTRACT_FINAL.md) is authoritative for the endpoint list.** This document remains the statement of _conventions_ — versioning, resource naming, the request/response envelope, pagination, error shape — which the final contract builds on and does not change. Where the two overlap on specific endpoints, the final contract wins.

## Single API Surface

The `web` app calls only the `api` (NestJS) app. NestJS fronts Payload CMS internally — the frontend never calls Payload directly (see [ARCHITECTURE.md](./ARCHITECTURE.md#cms-integration)).

---

## Versioning

- Base path: `/api/v1`
- Breaking changes require a new version prefix (`/api/v2`), old version kept until the frontend migrates

---

## Resource Naming

- Plural nouns, kebab-case: `/api/v1/products`, `/api/v1/custom-formulation-requests`
- Nested resources for ownership: `/api/v1/products/:id/specifications`
- Actions that aren't pure CRUD as verbs on a sub-path: `/api/v1/forms/sample-request/submit`

---

## Request/Response Envelope

Success:

```json
{
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": []
  }
}
```

- HTTP status code always matches the error category (400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 500 server)
- Never leak stack traces or internal error messages to the client in production

---

## Pagination & Filtering

- Cursor or offset pagination via query params: `?page=1&limit=20`
- Filtering: `?category=lubricants&status=published`
- Sorting: `?sort=-createdAt` (`-` prefix = descending)
- List responses always include `meta.total`, `meta.page`, `meta.limit`

---

## Authentication Header

- `Authorization: Bearer <access_token>` on all protected endpoints
- Public endpoints (catalog browsing, blog reading, form submission) require no token

---

## CMS Content Endpoints

NestJS exposes CMS-backed content (pages, menus, footer, settings) under `/api/v1/content/*`, translating Payload's internal shape into the standard envelope above. The frontend has no awareness that Payload exists.

---

## SEO Endpoints

Full strategy: [docs/seo/SEO_ARCHITECTURE.md](./seo/SEO_ARCHITECTURE.md). The API surface it depends on:

- `GET /api/v1/seo/sitemap-entries` — every indexable URL platform-wide (products, categories, blog posts, CMS pages) with `path`, `lastModified`, and `locale`, consumed by `apps/web`'s `sitemap.ts`. Aggregates across both `sam_platform` (via Prisma) and `sam_cms` (via the Content module) behind one call, same pattern as CMS Content Endpoints above.
- `GET /api/v1/seo/redirects` — active `Redirect` records, consumed by `apps/web` middleware.
- Every existing resource endpoint (`/products/:id`, `/blog/:slug`, `/content/pages/:slug`, etc.) includes the normalized `SeoFields` shape (§2 of the SEO doc) as part of its `data` payload — SEO metadata is not a separate round-trip per page, it rides along with the content request that was already happening.

## Canonical URLs for Filtered/Paginated Lists

Extending the Pagination & Filtering convention above: query-parameter combinations (`?category=...&sort=...`) are valid, crawlable URLs but are never the canonical target — canonical always resolves to the clean, page-1, unfiltered list URL. Full reasoning: [docs/seo/SEO_ARCHITECTURE.md §7](./seo/SEO_ARCHITECTURE.md#7-canonical-strategy-for-filtered--paginated-views).

---

## Locale-Aware Requests

Full strategy: [docs/i18n/INTERNATIONALIZATION_STRATEGY.md](./i18n/INTERNATIONALIZATION_STRATEGY.md).

- Every content-bearing endpoint (`/products/:id`, `/blog/:slug`, `/content/pages/:slug`, etc.) accepts a `locale` query param (e.g. `?locale=fa`); omitted means the platform default locale.
- `GET /api/v1/locales` — the active locale list from the `Locale` table, consumed by `apps/web`'s build step to generate its routing config and by `apps/cms`'s Payload localization config.
- `GET /api/v1/seo/sitemap-entries` (already defined above) returns one entry **per locale each entity is actually translated into**, not one entry per entity regardless of locale.
