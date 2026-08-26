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
 * ## No detail path in this gate
 *
 * `/admin/catalog/review/specifications/:id` and `/admin/catalog/review/product-claims/:id` are
 * Phase B. There is no helper for them here on purpose: a path constant that no route serves is an
 * invitation to link at it, and a queue row linking to a 404 is worse than a queue row that does
 * not link at all.
 */
export const CATALOG_REVIEW_PATH = `${ADMIN_PATH}/catalog/review`;
