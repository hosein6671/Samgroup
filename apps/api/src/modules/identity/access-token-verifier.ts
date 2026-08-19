import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { JWT_ALGORITHM } from "./jwt.config";
import { UsersService } from "./users.service";

import type { AuthenticatedUser } from "./authenticated-user";
import type { AccessTokenClaims } from "./jwt.config";

/**
 * The Identity & Access module's **one exported capability**: an `Authorization` header value in,
 * the live authenticated user out.
 *
 * ## Why this class exists
 *
 * `JwtAuthGuard` is exported so a module that owns its own data can protect its own routes, and
 * **Nest constructs a class-referenced enhancer in the module that declares the controller, not in
 * the module that exported it** — `DependenciesScanner` inserts every class named in `@UseGuards()`
 * into the *host* module's injectables. So whatever the guard injects has to be resolvable in
 * `FormsModule`, `CatalogModule`, and every future module with an admin route.
 *
 * When the guard injected `JwtService` and `UsersService` directly, that meant exporting both — and
 * exporting `UsersService` hands every consuming module the `users` repository: `findCredentialsByEmail`
 * (the password hash), `listAll` (the whole staff table), and a direct read of an entity that
 * ARCHITECTURE.md §Modules puts behind this module. Nobody had to *use* it for the boundary to be
 * gone; a test asserting nobody currently does is a description of today, not an encapsulation.
 *
 * This class is the narrow thing to export instead. It is the entire authentication capability the
 * platform needs to share, expressed as one method, and it is what the guards depend on.
 *
 * ## What it deliberately does not offer
 *
 * No Prisma, no repository, no `User` lookup by id or email, no password verification, no session
 * creation or revocation, no token *minting*, and no way to reach `AuthSessionsService`. A consumer
 * holding this object can answer exactly one question — "who, if anyone, is this request?" — and
 * cannot mutate anything at all. `AuthService`, `AuthSessionsService` and `UsersService` remain
 * unexported and stay inside this module with the endpoints that own them.
 *
 * It is also **not** a service locator: it resolves nothing dynamically, exposes no registry, and
 * its single method has a concrete signature and a concrete return type.
 *
 * ## What it does, in order
 *
 * 1. Parse `Authorization: Bearer <token>`.
 * 2. Verify the signature and expiry, with the algorithm pinned.
 * 3. Require the two claims the account gate needs: `sub` and `iat`.
 * 4. Resolve the **live** user, applying the active-status and credential-revocation boundary.
 *
 * Every failure returns `null` and none of them says which one it was. The reasoning for step 4 —
 * why the row is read on every request rather than trusted from the token, and why `iat` does the
 * work a `jti` would — belongs to `UsersService.findActiveByToken` and is documented there.
 */
@Injectable()
export class AccessTokenVerifier {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  /**
   * The caller behind an `Authorization` header value, or `null`.
   *
   * The parameter is the **header value**, not the request and not the header bag: a capability
   * that took a request object would be reaching into transport, and one that took the whole bag
   * could read `Cookie`. Extracting the one header is the guard's job, which is the only part of
   * this path that is really about HTTP plumbing.
   *
   * `null` covers all of: no header, an unparseable one, a wrong scheme, a forged signature, an
   * expired token, a missing claim, a deleted account, a disabled account, and a token predating
   * the account's credential cutoff. The caller turns that into one 401 with one message, so
   * nothing here can leak which guess was closer.
   */
  async identify(authorization: unknown): Promise<AuthenticatedUser | null> {
    const token = bearerToken(authorization);

    if (token === null) {
      return null;
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
      return null;
    }

    if (typeof claims.sub !== "string" || claims.sub === "") {
      return null;
    }

    if (typeof claims.iat !== "number") {
      // Every token this application signs carries `iat` — the signer sets it and jwt.config.ts
      // declares it. One that arrives without it cannot be placed relative to the account's
      // credential cutoff, so it is refused rather than exempted from the check.
      return null;
    }

    return this.users.findActiveByToken(claims.sub, claims.iat);
  }
}

/**
 * The token out of `Authorization: Bearer <token>`, or `null`.
 *
 * The scheme is compared case-insensitively (RFC 7235 makes it case-insensitive) but nothing else
 * is tolerated: no `Bearer` with extra whitespace-separated parts, no bare token without a scheme,
 * and no other scheme. A header this function cannot parse is the same as no header at all.
 */
function bearerToken(authorization: unknown): string | null {
  if (typeof authorization !== "string") {
    return null;
  }

  const parts = authorization.split(" ");
  const [scheme, token] = parts;

  if (parts.length !== 2 || scheme?.toLowerCase() !== "bearer" || token === undefined) {
    return null;
  }

  return token === "" ? null : token;
}
