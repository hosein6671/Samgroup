/**
 * The catalog resources' wire shapes — API_CONTRACT_FINAL.md §2.3.
 *
 * Shared rather than declared inside `apps/web` so the frontend client and any later consumer
 * read one declaration. The same caveat as `api.ts` applies: `apps/api` keeps its own DTOs and is
 * untouched in this gate, so this is a transcription of the contract, not `tsc`-enforced
 * agreement with the backend.
 */

/**
 * One category, as `GET /categories` and `GET /categories/:slug` both serve it.
 *
 * `name` and `slug` carry the REQUESTED locale's values, resolved server-side from
 * `content_translations`; the row's own columns hold the default locale
 * (INTERNATIONALIZATION_STRATEGY.md §3). A category is therefore reachable at a translated slug
 * and answers with the same `id` — which is why `id`, not `slug`, is the join key, while `slug`
 * in the DEFAULT locale is the canonical Product Family identifier (ADR-009 §1).
 *
 * ── `seo` is deliberately not modelled ──────────────────────────────────────
 *
 * `GET /categories/:slug` additionally carries `seo: SeoFields` (§2.3) — `GET /categories` does
 * not. It is absent here on purpose rather than by oversight: consuming it is explicitly out of
 * scope for the first integration gate, extra JSON properties do not affect parsing, and a
 * declared shape that nothing reads is surface that can drift unnoticed. It is added, with
 * `SeoFields` from this same package, by the gate that consumes it.
 */
export type CategoryResponse = {
  id: string;
  name: string;
  /** The requested locale's slug. In the default locale this is the canonical family identifier. */
  slug: string;
  /** Null for a top-level category — the six Product Families the site is built around. */
  parentId: string | null;
};
