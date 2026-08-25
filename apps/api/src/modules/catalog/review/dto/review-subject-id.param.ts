import { IsUUID } from "class-validator";

/**
 * The `:id` of a review subject — a `Specification` or a `ProductClaim`.
 *
 * A validated parameter object rather than a bare `@Param("id")`, for the reason
 * `LeadIdParam` states: both tables key on `uuid`, so a non-UUID path segment cannot identify a
 * row, and without this Prisma raises a driver-level error that surfaces as a **500** for what is
 * plainly a bad request. With it, the answer is **400 `VALIDATION_ERROR` naming `id`** and the
 * database is never reached.
 *
 * No UUID version is pinned — `@default(uuid())` produces v4 today, and asserting v4 here would
 * make the API reject its own rows if that default ever changed.
 */
export class ReviewSubjectIdParam {
  @IsUUID()
  id!: string;
}
