/**
 * The Content resource client — `GET /api/v1/content/pages/:slug`.
 *
 * ── Nothing here knows a CMS exists ─────────────────────────────────────────
 *
 * This module calls NestJS and only NestJS, exactly as `catalog.ts`, `products.ts` and `blog.ts` do.
 * There is no Payload origin, no CMS credential and no Payload-shaped type anywhere in `apps/web` —
 * ADR-003 makes NestJS the single API surface, and AI_CONTEXT.md restates it as an absolute
 * constraint. The content this returns happens to be stored in `sam_cms`; that fact is not
 * observable from here, from a browser, or from the response shape.
 *
 * Server-only by transitive import of `api-client`, whose `import "server-only"` fails a client
 * bundle at build time.
 *
 * ── Four outcomes, one of which may 404 ─────────────────────────────────────
 *
 * The same taxonomy `blog.ts` uses, for the same reason: `not-found` is the API stating that no
 * published page carries this slug — the only honest reason to serve a canonical 404. `unavailable`
 * and `api-error` are facts about infrastructure, and converting either into a 404 is what
 * ADR-010 §7 forbids. Collapsing them into `null` would make that rule impossible to keep at the
 * call site.
 */

import { apiGet } from "./api-client";

import type { ContentPageResponse } from "@sam-group/types";

export type ContentPageResult =
  | {
      readonly ok: true;
      readonly page: ContentPageResponse;
      /** `meta.localeFallback` — true when the page was served in the default locale. */
      readonly localeFallback: boolean;
    }
  /** A definitive 404: the CMS answered and holds no published page for this slug. */
  | { readonly ok: false; readonly reason: "not-found" }
  /**
   * The API itself did not answer — down, refused, timed out, or `API_INTERNAL_URL` unset.
   *
   * Distinct from `api-error` below, which includes the API answering 503 because *Payload* did not
   * respond. Both render the same unavailable state; they are kept apart so the server-side log can
   * say which of the two services is at fault, which is the difference between restarting the API
   * and restarting the CMS.
   */
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "api-error"; readonly status: number };

/**
 * The four fields the page renders, checked before any of them is trusted.
 *
 * `apiGet` verifies the envelope, not the payload. `lastUpdatedDate` is checked as string-or-null
 * because the endpoint contracts exactly that.
 */
function isContentPage(value: unknown): value is ContentPageResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.slug === "string" &&
    typeof record.title === "string" &&
    typeof record.bodyHtml === "string" &&
    (record.lastUpdatedDate === null || typeof record.lastUpdatedDate === "string")
  );
}

/**
 * One published CMS page by slug.
 *
 * @param slug the URL segment. Identical in every locale — structural page URLs stay fixed English
 *   (PROJECT_HANDOFF.md §6.12) — so unlike a product or an article there is no localized slug to
 *   resolve.
 * @param locale the active locale code from the `[locale]` segment. The API serves the page in it
 *   and reports `meta.localeFallback` when the translation does not exist.
 *
 * Never throws for an API condition, and never reports an infrastructure failure as a missing page.
 */
export async function getContentPage(slug: string, locale: string): Promise<ContentPageResult> {
  const result = await apiGet<unknown>(`/content/pages/${encodeURIComponent(slug)}`, { locale });

  if (!result.ok) {
    if (result.reason === "unreachable") {
      return { ok: false, reason: "unreachable" };
    }

    if (result.reason === "http") {
      /*
       * Matched on the status line, as `blog.ts` and `products.ts` both do: the status is the part
       * of the contract the HTTP layer guarantees even when the body never arrived.
       *
       * **404 is the only status that becomes `not-found`.** 503 is the API telling us the CMS did
       * not answer — the exact condition that must never be published as absence.
       */
      return result.status === 404
        ? { ok: false, reason: "not-found" }
        : { ok: false, reason: "api-error", status: result.status };
    }

    return { ok: false, reason: "api-error", status: result.status };
  }

  if (!isContentPage(result.data)) {
    // A 2xx carrying something that is not a page. An API error, never `not-found`: a broken
    // contract must not be able to delete a page.
    return { ok: false, reason: "api-error", status: 200 };
  }

  return { ok: true, page: result.data, localeFallback: result.meta.localeFallback === true };
}
