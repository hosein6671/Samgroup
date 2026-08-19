import { IsUUID } from "class-validator";

/**
 * The `:id` of a lead detail route.
 *
 * A validated parameter object rather than a bare `@Param("id") id: string`, so a malformed id is
 * **400 `VALIDATION_ERROR` naming `id`** and never reaches the database. Both tables key on
 * `uuid`, so a non-UUID path segment cannot identify a row: without this, Prisma would raise a
 * driver-level error on an invalid uuid input and the request would surface as a 500 — an
 * infrastructure fault reported for what is plainly a bad request.
 *
 * It also closes the shape of what reaches Prisma. `findUnique({ where: { id } })` with a
 * caller-supplied string is not injectable — Prisma parameterises — but a value proven to be a
 * UUID before the query is a narrower thing to reason about than a string that merely has not
 * been shown to be dangerous.
 *
 * No version is pinned. `@default(uuid())` produces v4 today; asserting v4 here would make the
 * API reject its own rows if that default ever changed, which is a coupling this gate has no
 * reason to take on.
 */
export class LeadIdParam {
  @IsUUID()
  id!: string;
}
