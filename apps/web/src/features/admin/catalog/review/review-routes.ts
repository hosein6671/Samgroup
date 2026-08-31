import { ADMIN_PATH } from "../../admin-routes";

/**
 * The Admin catalog technical-review paths.
 *
 * `/admin/catalog/review` mirrors the API namespace — `admin/catalog/review/queue` — one segment
 * for one segment, so a screen maps onto its contract without a translation step. It also leaves
 * `/admin/catalog/products` and `/admin/catalog/categories` free for the catalog CRUD surface that
 * API_CONTRACT_FINAL.md §2.10 reserves and nothing has built.
 *
 * ## One route, and no alias
 *
 * `/admin/catalog` is **not** declared here and no redirect to the queue exists. A second spelling
 * of one screen is a second thing to keep correct, and it would be reachable before the catalog
 * area has anything else in it.
 *
 * ## The two detail namespaces, and why only their bases live here
 *
 * Phase B adds `/admin/catalog/review/specifications/:id` and
 * `/admin/catalog/review/product-claims/:id`, and ADR-019 adds
 * `/admin/catalog/review/product-copy/:id` beside them — one route each, mirroring the three
 * NestJS subject controllers segment for segment. They are **three routes, not one generic subject
 * route**: a
 * `[subject]/[id]` pair would make the subject type a caller-supplied string that some later reader
 * has to validate, and the API itself declares two controllers rather than one.
 *
 * What lives here is the **base** of each namespace and nothing more. The id-bearing href is built
 * in `review-query.ts`, next to every other URL this feature emits, because a detail link also
 * carries the queue context that module owns and validates. Splitting URL construction across two
 * files is how one of them ends up not knowing about a rule the other enforces.
 *
 * No alias, no redirect and no `/admin/catalog` index: the same rule the queue route follows.
 */
export const CATALOG_REVIEW_PATH = `${ADMIN_PATH}/catalog/review`;

/** The Specification detail namespace. The subject id is appended by `reviewSubjectHref`. */
export const SPECIFICATION_REVIEW_PATH = `${CATALOG_REVIEW_PATH}/specifications`;

/** The ProductClaim detail namespace. The subject id is appended by `reviewSubjectHref`. */
export const PRODUCT_CLAIM_REVIEW_PATH = `${CATALOG_REVIEW_PATH}/product-claims`;

/**
 * The ProductCopy detail namespace (ADR-019). The subject id is appended by `reviewSubjectHref`.
 *
 * `product-copy`, singular, matching the API controller and the table. "Copy" is a mass noun here:
 * one row is one product's copy in one locale, not one "copy" of anything, so the plural the other
 * two carry would be naming a different thing.
 */
export const PRODUCT_COPY_REVIEW_PATH = `${CATALOG_REVIEW_PATH}/product-copy`;
