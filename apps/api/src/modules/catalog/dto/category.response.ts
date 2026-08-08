import type { SeoFields } from "@sam-group/types";

/**
 * The wire shape of one category — API_CONTRACT_FINAL.md §2.3.
 *
 * `id` is exposed, unlike LocaleResponse's deliberately hidden uuid, because the same
 * section defines `GET /categories?parentId=` — a client cannot ask for a category's
 * children without holding its id.
 *
 * `name` and `slug` carry the requested locale's values, resolved from
 * `content_translations`; the row's own columns hold the default locale
 * (INTERNATIONALIZATION_STRATEGY.md §3).
 *
 * `SeoFields` is NOT on this type. §2.3 contracts it for `GET /categories/:slug` alone, and
 * this shape is also the list row AND the category nested inside a product detail response —
 * neither of which is contracted to carry SEO, and a product page's metadata is the
 * product's, never its category's.
 */
export type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  /** Null for a top-level category — the six the site is built around. */
  parentId: string | null;
};

/**
 * `GET /categories/:slug` — the same category, plus the SEO record for the requested locale
 * (§2.3). `SeoFields` comes from `@sam-group/types` rather than being declared here because
 * Payload-owned content must satisfy the identical shape (SEO_ARCHITECTURE.md §0).
 */
export type CategoryDetailResponse = CategoryResponse & {
  seo: SeoFields;
};
