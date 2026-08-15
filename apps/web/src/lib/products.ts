/**
 * The Product resource client — `GET /api/v1/products` and `GET /api/v1/products/:slug`.
 *
 * ── Why this is not in `catalog.ts` ─────────────────────────────────────────
 *
 * `catalog.ts` is the Category resource and says so in its first line. FRONTEND_ARCHITECTURE.md
 * §11 asks for one function per resource, not one module per API module, and `apps/api` already
 * draws the same line inside its own catalog module — `categories.service.ts` beside
 * `products.service.ts`. Products get their own file for the same reason.
 *
 * ── Two functions, and the difference between their failures matters ────────
 *
 * `getProductsByCategory` backs a section of a page that exists regardless; `getProductBySlug`
 * decides whether a page exists at all. That makes the distinction between "this product does not
 * exist" and "the catalog service did not answer" load-bearing rather than tidy: ADR-010 §7 forbids
 * the second being served as the first, so both results are separated at the source here and the
 * route can never collapse them by accident.
 *
 * Server-only by transitive import of `api-client`, whose `import "server-only"` fails a client
 * bundle at build time.
 */

import { apiGet } from "./api-client";

import type { ProductDetailResponse, ProductListItemResponse } from "@sam-group/types";

/**
 * What a product-list request produced.
 *
 * Five outcomes rather than an array-or-empty, and the distinction is the point: an empty list and
 * a failed request must never render the same way. "This family publishes no products" is a fact
 * about the catalog; "the API did not answer" is a fact about the infrastructure, and ADR-010 §7
 * forbids the second being presented as the first. `unknown-filter` is separated from the other
 * failures because it is the only one the VISITOR caused and the only one they can undo.
 */
export type ProductListResult =
  | {
      readonly ok: true;
      readonly products: readonly ProductListItemResponse[];
      /** `meta.total` — the size of the filtered set, which may exceed `products.length`. */
      readonly total: number;
      readonly page: number;
      readonly limit: number;
    }
  /** A 400 VALIDATION_ERROR naming a filter parameter — an unknown `segment`/`category` slug. */
  | { readonly ok: false; readonly reason: "unknown-filter"; readonly field: string }
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "api-error"; readonly status: number };

/**
 * The six fields of one list row, checked before any of them is trusted.
 *
 * `apiGet` verifies the envelope, not the payload — a 200 carrying something that is not a product
 * row would otherwise reach a heading as `undefined`. Every field the shared type declares is
 * checked, including `createdAt`, which nothing renders: a validator that vouches for less than
 * the type declares is a validator that makes the type a claim rather than a guarantee.
 */
function isProductListItem(value: unknown): value is ProductListItemResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    (record.description === null || typeof record.description === "string") &&
    typeof record.categoryId === "string" &&
    typeof record.createdAt === "string"
  );
}

/**
 * The `field` of the first `VALIDATION_ERROR` detail, when the API named one.
 *
 * The service answers 400 with `details: [{ field: "segment", issue: ... }]` for a slug that
 * resolves to no Segment, and the same shape for `category`. Which parameter was rejected is the
 * whole of what the page needs in order to say something true about it; the `issue` text is the
 * API's own prose and is never rendered.
 */
function rejectedFilterField(details: readonly { field: string }[] | null): string | null {
  return details?.[0]?.field ?? null;
}

/**
 * The taxonomy axes `GET /products` is asked to narrow on.
 *
 * Both are optional and **both are omitted from the request when absent** rather than sent blank
 * — see `getProducts`. Product Type is deliberately not a member: no ProductType row is approved
 * (ADR-008), every non-blank `?productType=` answers 400, and a field here would be an invitation
 * to send one.
 */
export type ProductFilters = {
  /**
   * A Product Family's canonical identifier — its DEFAULT-locale `Category.slug`, which is also
   * the registry key and the route segment (ADR-009 §1). Never a label, never a name.
   */
  readonly category?: string;
  /**
   * An approved `Segment.slug` (ADR-008 §4). Single-valued: ADR-008 defers multi-value taxonomy
   * filtering, so this never sends two.
   */
  readonly segment?: string;
};

/**
 * The product list, optionally narrowed on either taxonomy axis or on both.
 *
 * @param locale the active locale code from the `[locale]` segment. The API resolves the filter
 *   slugs in it and localizes `name`/`slug`/`description` to it.
 * @param filters the axes to narrow on. `{}` is the whole published list — which is exactly what
 *   the Product Finder asks for before a visitor touches a control, and is a real request rather
 *   than a degenerate one.
 *
 * **Filtering is the backend's**, in full, and both callers depend on that equally. Nothing here
 * fetches a wider set and narrows it locally — that would reimplement ADR-008's conjunctive
 * semantics in a second place, against a list the API has already paginated, and would silently
 * disagree the first time those semantics gain a rule. It is also why `total` below is `meta.total`
 * and never a length this module computed.
 *
 * Never throws for an API condition; every one of them is reported as a value on
 * `ProductListResult`. Both surfaces that call this have content of their own that must survive a
 * catalog outage (ADR-010 §7).
 */
export async function getProducts(
  locale: string,
  filters: ProductFilters = {},
): Promise<ProductListResult> {
  const result = await apiGet<unknown>("/products", {
    locale,
    // Spread rather than sent as an empty string. The service treats `?segment=` as an omitted
    // filter, so both forms behave alike — but a parameter that is not a filter should not appear
    // in the request at all.
    ...(filters.category === undefined ? {} : { category: filters.category }),
    ...(filters.segment === undefined ? {} : { segment: filters.segment }),
  });

  if (!result.ok) {
    if (result.reason === "unreachable") {
      return { ok: false, reason: "unreachable" };
    }

    if (result.reason === "http") {
      const field = result.status === 400 ? rejectedFilterField(result.details) : null;

      return field === null
        ? { ok: false, reason: "api-error", status: result.status }
        : { ok: false, reason: "unknown-filter", field };
    }

    return { ok: false, reason: "api-error", status: result.status };
  }

  if (!Array.isArray(result.data) || !result.data.every(isProductListItem)) {
    // `status` is 200 here — the failure is in the payload, not the status line.
    return { ok: false, reason: "api-error", status: 200 };
  }

  const products = result.data;

  return {
    ok: true,
    products,
    // §Pagination contracts all three as always present on a list response. They are read
    // defensively anyway, and fall back to what the response itself demonstrates rather than to a
    // literal that could contradict it.
    total: result.meta.total ?? products.length,
    page: result.meta.page ?? 1,
    limit: result.meta.limit ?? products.length,
  };
}

/**
 * The products of one Product Family, optionally narrowed to one Segment.
 *
 * A named wrapper rather than a second implementation: the Product Family page is the one caller
 * for which `category` is not optional — it is the page's own identity, and a family page that
 * issued an unfiltered request would be listing the whole catalog under a family's heading. The
 * required parameter is what states that at the call site, and the type system enforces it.
 *
 * @param categorySlug the family's canonical identifier — its DEFAULT-locale `Category.slug`
 *   (ADR-009 §1).
 * @param locale the active locale code from the `[locale]` segment.
 * @param segmentSlug an approved `Segment.slug`, or `undefined` for the whole family.
 */
export async function getProductsByCategory(
  categorySlug: string,
  locale: string,
  segmentSlug?: string,
): Promise<ProductListResult> {
  return getProducts(locale, { category: categorySlug, segment: segmentSlug });
}

/* ------------------------------------------------------------------- detail */

/**
 * What a product lookup produced.
 *
 * The four outcomes are kept apart because exactly one of them is allowed to become a 404.
 * `not-found` is the API stating that no product answers this slug in this locale — a fact about
 * the catalog, and the only honest reason to serve a canonical 404. `unreachable` and `api-error`
 * are facts about the infrastructure, and ADR-010 §7 is explicit that neither may be converted into
 * one. Collapsing them into `null` would make that rule impossible to keep at the call site.
 */
export type ProductResult =
  | {
      readonly ok: true;
      readonly record: ProductDetailResponse;
      /**
       * `meta.localeFallback` — true when any localized part of the response was served in the
       * default locale because the requested one has no translation. Envelope metadata, not a
       * field on the record, so it is surfaced beside it rather than folded into it.
       */
      readonly localeFallback: boolean;
    }
  /** A definitive 404 from the API: no product answers this slug. */
  | { readonly ok: false; readonly reason: "not-found" }
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "api-error"; readonly status: number };

/**
 * The fields the Product Detail page reads, checked before any of them is trusted.
 *
 * `apiGet` verifies the envelope, not the payload. The four collections are checked for being
 * arrays and nothing deeper: their contents are rendered through `.map`, so a malformed member
 * would surface as a missing string rather than as a thrown render, and validating every element of
 * every array would be asserting agreement this gate does not enforce.
 *
 * `seo` is deliberately not checked — it is declared on the type and read by nothing here.
 */
function isProductDetail(value: unknown): value is ProductDetailResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const category = record.category as Record<string, unknown> | null | undefined;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    (record.description === null || typeof record.description === "string") &&
    typeof category === "object" &&
    category !== null &&
    typeof category.name === "string" &&
    typeof category.slug === "string" &&
    Array.isArray(record.segments) &&
    Array.isArray(record.specifications) &&
    Array.isArray(record.images) &&
    (record.productType === null || typeof record.productType === "object")
  );
}

/**
 * One product by its locale-specific slug.
 *
 * @param slug the slug as it appears in the URL. The API resolves it in the requested locale's
 *   vocabulary — translated slug first, the row's own column second — so a product with no
 *   translation is still reachable in every locale at its default-locale path.
 * @param locale the active locale code from the `[locale]` segment.
 *
 * Never throws for an API condition, and never reports a transport failure as a missing product.
 * The route's 404 decision reads `reason`, and only `not-found` may produce one.
 */
export async function getProductBySlug(slug: string, locale: string): Promise<ProductResult> {
  const result = await apiGet<unknown>(`/products/${encodeURIComponent(slug)}`, { locale });

  if (!result.ok) {
    if (result.reason === "unreachable") {
      return { ok: false, reason: "unreachable" };
    }

    if (result.reason === "http") {
      /*
       * Matched on the status line rather than on `error.code`, for the same reason `catalog.ts`
       * does: the status is the part of the contract the HTTP layer guarantees even when the body
       * never arrived. A 404 here is the service's own NOT_FOUND — the one definitive answer.
       */
      return result.status === 404
        ? { ok: false, reason: "not-found" }
        : { ok: false, reason: "api-error", status: result.status };
    }

    return { ok: false, reason: "api-error", status: result.status };
  }

  if (!isProductDetail(result.data)) {
    // A 2xx carrying something that is not a product. Reported as an API error and NOT as
    // `not-found`: a broken contract must not be able to delete a page.
    return { ok: false, reason: "api-error", status: 200 };
  }

  return { ok: true, record: result.data, localeFallback: result.meta.localeFallback === true };
}
