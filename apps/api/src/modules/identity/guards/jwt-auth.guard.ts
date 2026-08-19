import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

import { ApiException } from "../../../common/http/api.exception";
import { ErrorCode } from "../../../common/http/error-code";
import { AccessTokenVerifier } from "../access-token-verifier";
import { AUTHENTICATED_USER } from "../authenticated-user";

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
 * ── This guard is plumbing; the decision is `AccessTokenVerifier`'s ─────────
 *
 * All this class does is lift one header off the request, ask the identity boundary who it belongs
 * to, and either attach the answer or throw one 401. Verification, the claim checks, the live-user
 * lookup, the active-status gate and the credential-revocation cutoff are all in
 * `access-token-verifier.ts`, and that file explains each of them.
 *
 * The split is not tidiness. **Nest constructs a class-referenced enhancer in the module that
 * declares the controller**, so everything this guard injects has to be resolvable in every module
 * that protects a route with it. Injecting `JwtService` and `UsersService` therefore meant
 * exporting the `users` repository — the password-hash lookup and the whole staff list — to every
 * such module. Injecting one narrow capability instead means the only thing Identity has to publish
 * is "a header value, in; an authenticated identity, out".
 *
 * ── One message, and no branch that could leak which failure it was ─────────
 *
 * The verifier answers `null` for every failure, so there is exactly one rejection path here.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly identities: AccessTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser & { headers?: unknown }>();
    const user = await this.identities.identify(authorizationHeader(request.headers));

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
 * The raw `Authorization` header value, or `undefined`.
 *
 * Only that one header is read and only that one is handed onward — the identity boundary never
 * receives the request or the header bag, so it has no way to reach `Cookie` or anything else the
 * transport happens to be carrying.
 */
function authorizationHeader(headers: unknown): unknown {
  if (typeof headers !== "object" || headers === null) {
    return undefined;
  }

  return (headers as Record<string, unknown>).authorization;
}
