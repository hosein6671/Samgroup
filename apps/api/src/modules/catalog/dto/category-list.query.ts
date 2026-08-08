import { IsOptional, IsUUID } from "class-validator";

import { LocaleQuery } from "../../../common/locale/locale.query";

/**
 * `GET /categories` query parameters — API_CONTRACT_FINAL.md §2.3 defines `?parentId=` "for
 * nesting"; `?locale=` is inherited from LocaleQuery.
 *
 * `@IsUUID` is not decoration: `categories.parent_id` is `@db.Uuid`, so a malformed value
 * reaches PostgreSQL as an invalid input syntax error and surfaces as a 500. Rejecting it at
 * the boundary makes it the 400 VALIDATION_ERROR it actually is, with a field the frontend
 * can map.
 */
export class CategoryListQuery extends LocaleQuery {
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
