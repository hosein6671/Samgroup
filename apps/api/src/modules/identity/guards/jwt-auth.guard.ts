import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { AUTHENTICATED_USER } from "../authenticated-user";
import { JWT_ALGORITHM } from "../jwt.config";
import { UsersService } from "../users.service";

import type { AccessTokenClaims } from "../jwt.config";
import type { RequestWithUser } from "../authenticated-user";

const UNAUTHORIZED_STATUS = 401;

/**
 * One message for every way authentication can fail — no token, a malformed one, an expired one, a
 * good signature over a deleted user. The client can do exactly one thing about any of them (log
 * in again), and distinguishing them tells an attacker which of their guesses was closer.
 */
const UNAUTHENTICATED_MESSAGE = "Authentication is required.";

/**
 * Rejects any request that does not carry a valid access token — API_CONTRACT_FINAL.md §7.
 *
 * ── Transport: `Authorization: Bearer`, and only that ───────────────────────
 *
 * §7 is explicit — "Access token 15 min (Authorization header)" — and FRONTEND_ARCHITECTURE.md §11
 * says the same from the caller's side: `apps/web` attaches "the `Authorization: Bearer` header"
 * when a session exists. **No cookie is read here.** SECURITY.md's "both tokens live in httpOnly
 * cookies" describes where `apps/web` *stores* them in the browser — it says so itself, "only the
 * storage location is made explicit" — and `apps/web` reads that cookie server-side and forwards
 * the value in this header. The two documents describe two different hops and do not conflict.
 *
 * ── Why the user is loaded from the database on every request ───────────────
 *
 * The token carries `sub` and nothing else, so `role` here is always the row's current value.
 * That costs one primary-key lookup per authenticated request and buys two things this gate
 * specifically needs:
 *
 *   1. **Revocation actually works.** `users` has no status column (see `AuthService.login`), so
 *      deleting the row is the only way to revoke an account — and a self-contained token would
 *      keep authenticating a deleted user for the rest of its 15 minutes. Here the next request
 *      after the delete is a 401.
 *   2. **A role change takes effect immediately**, rather than up to 15 minutes later, and there is
 *      no second copy of the role that can disagree with `sam_platform`.
 *
 * The cost is acceptable on this surface: every `/admin/*` response is `Cache-Control: no-store`
 * and admin traffic is a handful of staff, not public read volume. It would need revisiting if a
 * high-volume authenticated public surface ever existed — the Customer Portal is the candidate,
 * and it is a future phase.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser & { headers?: unknown }>();
    const token = bearerToken(request.headers);

    if (token === null) {
      throw unauthenticated();
    }

    let claims: AccessTokenClaims;

    try {
      // `algorithms` is pinned so the token's own header cannot choose the verification
      // algorithm — see jwt.config.ts. Expiry and signature are both checked here; a failure of
      // either arrives as a throw, which is why nothing below re-checks `exp`.
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        algorithms: [JWT_ALGORITHM],
      });
    } catch {
      // The library's message ("jwt expired", "invalid signature") is deliberately discarded.
      throw unauthenticated();
    }

    if (typeof claims.sub !== "string" || claims.sub === "") {
      throw unauthenticated();
    }

    const user = await this.users.findAuthenticatedById(claims.sub);

    if (user === null) {
      throw unauthenticated();
    }

    request[AUTHENTICATED_USER] = user;

    return true;
  }
}

function unauthenticated(): ApiException {
  return new ApiException(UNAUTHORIZED_STATUS, ErrorCode.Unauthenticated, UNAUTHENTICATED_MESSAGE);
}

/**
 * The token out of `Authorization: Bearer <token>`, or `null`.
 *
 * The scheme is compared case-insensitively (RFC 7235 makes it case-insensitive) but nothing else
 * is tolerated: no `Bearer` with extra whitespace-separated parts, no bare token without a scheme,
 * and no other scheme. A header this function cannot parse is the same as no header at all.
 */
function bearerToken(headers: unknown): string | null {
  if (typeof headers !== "object" || headers === null) {
    return null;
  }

  const raw: unknown = (headers as Record<string, unknown>).authorization;

  if (typeof raw !== "string") {
    return null;
  }

  const parts = raw.split(" ");
  const [scheme, token] = parts;

  if (parts.length !== 2 || scheme?.toLowerCase() !== "bearer" || token === undefined) {
    return null;
  }

  return token === "" ? null : token;
}
