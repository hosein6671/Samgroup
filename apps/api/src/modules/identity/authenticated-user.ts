import type { UserRole } from "../../prisma/generated/client";

/**
 * The authenticated caller, as every guard, decorator and handler in the application sees it.
 *
 * Read from `sam_platform` by `JwtAuthGuard` on each request and attached to the request object —
 * never assembled from token claims, and never from anything the client sent. `passwordHash` is
 * absent from the type, so no handler can reach one through this object even by accident.
 */
export type AuthenticatedUser = {
  readonly id: string;
  readonly email: string;
  /** The role as stored, resolved live. `toWireRole` converts it at the response boundary. */
  readonly role: UserRole;
};

/**
 * The request property the guard writes and `@CurrentUser()` reads.
 *
 * A symbol rather than `request.user`: `request.user` is a well-known property that several
 * middlewares and libraries write, and a value this application treats as an authorization
 * decision must not share a name with one anything else can set.
 */
export const AUTHENTICATED_USER = Symbol("sam-group:authenticated-user");

export type RequestWithUser = {
  [AUTHENTICATED_USER]?: AuthenticatedUser;
};
