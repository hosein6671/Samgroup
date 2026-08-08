/**
 * The shapes MediaService hands to a consuming module — ARCHITECTURE.md §Modules.
 *
 * These are internal to the module boundary, not wire types. An endpoint that returns imagery
 * declares its own response shape in its own `dto/` (see catalog/dto/product.response.ts's
 * `ProductImageResponse`), so a change to what Media exposes internally cannot silently alter
 * an API_CONTRACT_FINAL.md payload.
 */

/**
 * One public image row of `media`.
 *
 * `media` has no visibility column, so "public" is not a flag on the row — it is expressed by
 * the `type = image` filter MediaService applies and callers cannot influence. COA, SDS, TDS
 * and every other document are `file`/`document` rows and never appear here.
 */
export type MediaImageResponse = {
  id: string;
  url: string;
  altText: string | null;
};
