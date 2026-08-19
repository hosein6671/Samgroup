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
 * The token carries `sub`, `iat` and `exp`, so `role` here is always the row's current value.
 * That costs one primary-key lookup per authenticated request and buys four things:
 *
 *   1. **Revocation actually works.** A self-contained token would keep authenticating a deleted
 *      user for the rest of its 15 minutes. Here the next request after the delete is a 401.
 *   2. **Disabling an account is equally immediate.** The lookup filters on `status = active`
 *      (ADR-012), so an account switched off a second ago fails its very next authenticated
 *      request — the same 401, indistinguishable from every other. The status is **never** read
 *      from a claim: there is no status claim, deliberately, because a token that carried one
 *      would go on asserting `active` until it expired.
 *   3. **Disabling is permanent, not a pause** (ADR-012 §7). The same lookup requires the token's
 *      `iat` to sit after the account's `credentials_revoked_at` cutoff, which the database
 *      advances on every active → disabled transition and never lowers. So re-enabling an account
 *      does **not** bring a pre-disable token back to life, even one whose `exp` is still in the
 *      future — the account can be used again, the credentials it held cannot.
 *   4. **A role change takes effect immediately**, rather than up to 15 minutes later, and there is
 *      no second copy of the role that can disagree with `sam_platform`.
 *
 * All four are one `findActiveByToken` call and one 401, so nothing here can leak which of them
 * refused the request.
 *
 * ── `iat` does the work that a `jti` would, without a claim being added ─────
 *
 * Point 3 needs to know when a token was minted, and `iat` already says so — it is in the frozen
 * claim set (API_CONTRACT_FINAL.md §7) because every JWT signer writes it, not because this gate
 * wanted it. **No `jti`, no `status` claim, no session id in the token**: a per-token identifier
 * would need a table of issued access tokens to be checked against, which is the deny-list this
 * platform deliberately does not keep. A cutoff timestamp on the account revokes every token at
 * once and stores one nullable column to do it.
 *
 * Note what this does *not* do: it consults no session table. An access token is valid until it
 * expires or until the account's cutoff passes it, and logging out does not shorten it — see
 * `AuthService.logout` for why no deny-list exists.
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

    if (typeof claims.iat !== "number") {
      // Every token this application signs carries `iat` — the signer sets it and jwt.config.ts
      // declares it. One that arrives without it cannot be placed relative to the account’s
      // credential cutoff, so it is refused rather than exempted from the check.
      throw unauthenticated();
    }

    const user = await this.users.findActiveByToken(claims.sub, claims.iat);

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
