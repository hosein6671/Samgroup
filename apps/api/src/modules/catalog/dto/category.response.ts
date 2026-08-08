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
 * `SeoFields` is contracted for `GET /categories/:slug` and is NOT here: its canonical shape
 * is specified to live in `packages/types` (SEO_ARCHITECTURE.md §0/§2), which this step was
 * scoped to leave untouched. Defining it locally would create the duplicate that decision
 * exists to prevent.
 */
export type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  /** Null for a top-level category — the six the site is built around. */
  parentId: string | null;
};
