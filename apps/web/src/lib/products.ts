/**
 * The Product resource client — `GET /api/v1/products`, and nothing else yet.
 *
 * ── Why this is not in `catalog.ts` ─────────────────────────────────────────
 *
 * `catalog.ts` is the Category resource and says so in its first line. FRONTEND_ARCHITECTURE.md
 * §11 asks for one function per resource, not one module per API module, and `apps/api` already
 * draws the same line inside its own catalog module — `categories.service.ts` beside
 * `products.service.ts`. Products get their own file for the same reason.
 *
 * ── One function, and the list only ─────────────────────────────────────────
 *
 * `GET /products/:slug` is deliberately absent. There is no Product Detail route in `apps/web`
 * (ADR-010 §2 authorizes the shared namespace, not the branch), so a detail client would be a
 * function no caller can reach, typed against a response nothing renders.
 *
 * Server-only by transitive import of `api-client`, whose `import "server-only"` fails a client
 * bundle at build time.
 */

import { apiGet } from "./api-client";

import type { ProductListItemResponse } from "@sam-group/types";

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
 * The products of one Product Family, optionally narrowed to one Segment.
 *
 * @param categorySlug the family's canonical identifier — its DEFAULT-locale `Category.slug`,
 *   which is the registry key and the route segment (ADR-009 §1). Never a label, never a name.
 * @param locale the active locale code from the `[locale]` segment. The API resolves the filter
 *   slugs in it and localizes `name`/`slug`/`description` to it.
 * @param segmentSlug an approved `Segment.slug` (ADR-008 §4), or `undefined` for the whole family.
 *   Single-valued: ADR-008 defers multi-value taxonomy filtering, so this never sends two.
 *
 * **Filtering is the backend's**, in full. Nothing here fetches the family and narrows it locally
 * — that would reimplement ADR-008's semantics in a second place, against a list the API has
 * already paginated, and would silently disagree the first time those semantics gain a rule.
 *
 * Never throws for an API condition. The Product Family page's editorial content is registered
 * locally and must survive a catalog outage (ADR-010 §7).
 */
export async function getProductsByCategory(
  categorySlug: string,
  locale: string,
  segmentSlug?: string,
): Promise<ProductListResult> {
  const result = await apiGet<unknown>("/products", {
    locale,
    category: categorySlug,
    // Spread rather than sent as an empty string. The service treats `?segment=` as an omitted
    // filter, so both forms behave alike — but a parameter that is not a filter should not appear
    // in the request at all.
    ...(segmentSlug === undefined ? {} : { segment: segmentSlug }),
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
