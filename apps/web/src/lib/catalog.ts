/**
 * The Catalog resource client — `GET /api/v1/categories/:slug`, and nothing else yet.
 *
 * One function per resource, per FRONTEND_ARCHITECTURE.md §11. `GET /categories` is deliberately
 * absent: the only things the list endpoint adds over the detail endpoint are the set of
 * categories and an ordering, and navigation order is frontend-owned by decision — `categories`
 * has no `sortOrder` column and the canonical order lives in `site-routes.ts`. Wiring the list in
 * would put an ordering on the wire that nothing is allowed to consume.
 *
 * Server-only by transitive import of `api-client`, whose module-load guard throws in a browser.
 */

import { apiGet } from "./api-client";

import type { ApiMeta, CategoryResponse } from "@sam-group/types";

/**
 * What a category lookup produced.
 *
 * Four outcomes rather than `CategoryResponse | null`. Every one of them renders the fixture in
 * this gate, so collapsing them would be invisible today and wrong tomorrow: `not-found` means
 * the row is missing and someone should seed it, `unreachable` means the API is down and nothing
 * is wrong with the data, and `api-error` means the contract broke. Those need different answers
 * the moment this route stops being a design proof, and the distinction is free to keep now.
 */
export type CategoryResult =
  | { readonly ok: true; readonly record: CategoryResponse; readonly meta: ApiMeta }
  | { readonly ok: false; readonly reason: "not-found" }
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "api-error"; readonly status: number };

/**
 * The four fields this gate reads, checked before any of them is trusted.
 *
 * `apiGet` verifies the envelope, not the payload. A 200 carrying a shape that is not a category
 * would otherwise reach the resolver as a well-typed lie and put `undefined` into a heading, so
 * it is narrowed here and reported as `api-error` if it fails.
 *
 * `seo` is on the wire for this endpoint and is deliberately neither checked nor read — consuming
 * it is a later gate, and extra properties do not affect anything here.
 */
function isCategoryResponse(value: unknown): value is CategoryResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    (record.parentId === null || typeof record.parentId === "string")
  );
}

/**
 * One category by slug.
 *
 * @param slug the locale-specific slug. In the default locale this is the canonical Product
 *   Family identifier (ADR-009 §1) and the route segment.
 * @param locale an active locale code. **No caller passes this in the current gate** — there is
 *   no `[locale]` segment in any route, so `apps/web` has no locale to send, and omitting the
 *   parameter is what makes the API resolve the platform default. The parameter exists so the
 *   seam is in place; hardcoding `"en"` at a call site would invent a locale source.
 *
 * Never throws for an API condition. A thrown error here would take down a page whose content is
 * sitting in a fixture two lines away.
 */
export async function getCategoryBySlug(slug: string, locale?: string): Promise<CategoryResult> {
  const result = await apiGet<unknown>(
    `/categories/${encodeURIComponent(slug)}`,
    locale === undefined ? undefined : { locale },
  );

  if (!result.ok) {
    if (result.reason === "unreachable") {
      return { ok: false, reason: "unreachable" };
    }

    if (result.reason === "http") {
      // The service throws 404 NOT_FOUND for a slug that exists in no locale. Matched on status
      // rather than on `code`, because the status is the part of the contract the HTTP layer
      // guarantees even if the body never arrived.
      return result.status === 404
        ? { ok: false, reason: "not-found" }
        : { ok: false, reason: "api-error", status: result.status };
    }

    return { ok: false, reason: "api-error", status: result.status };
  }

  if (!isCategoryResponse(result.data)) {
    // A 2xx that is not a category. `status` is 200 here — the failure is in the payload, not the
    // status line, and saying so is more useful than inventing a synthetic code.
    return { ok: false, reason: "api-error", status: 200 };
  }

  return { ok: true, record: result.data, meta: result.meta };
}
