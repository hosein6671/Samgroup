import { JwtService } from "@nestjs/jwt";

import { ErrorCode } from "../../../common/http/error-code";
import { AUTHENTICATED_USER } from "../authenticated-user";
import { JWT_ALGORITHM } from "../jwt.config";
import { UserRole } from "../../../prisma/generated/client";

import { AccessTokenVerifier } from "../access-token-verifier";
import { JwtAuthGuard } from "./jwt-auth.guard";

import type { ApiException } from "../../../common/http/api.exception";
import type { RequestWithUser } from "../authenticated-user";
import type { UsersService } from "../users.service";
import type { ExecutionContext } from "@nestjs/common";

/**
 * The authentication guard, against the **real** `JwtService`. Only the database is faked.
 *
 * Every rejection case is checked for the same status, the same code and the same message: an
 * expired token and a forged one must be indistinguishable to the caller.
 *
 * The guard is built over a **real** `AccessTokenVerifier` rather than a stub of one. The two are
 * one decision split across two files for a module-boundary reason (see either file), so testing
 * the guard against a faked boundary would leave the actual verification untested and would pass
 * even if the split had been made wrong. Nothing below changed when it was introduced except this
 * construction line.
 */

const SECRET = "test-signing-secret-at-least-32-characters-long";
const OTHER_SECRET = "a-completely-different-secret-also-32-chars";
const USER_ID = "6a1f6a0e-0f5f-4a1a-9f8a-3f4d5b6c7d8e";

const jwt = new JwtService({ secret: SECRET });
const user = { id: USER_ID, email: "admin@example.test", role: UserRole.ADMIN };

function makeUsers(found: typeof user | null = user): UsersService {
  return {
    findActiveByToken: jest.fn().mockResolvedValue(found),
  } as unknown as UsersService;
}

function makeContext(headers: Record<string, unknown>): {
  context: ExecutionContext;
  request: RequestWithUser;
} {
  const request: RequestWithUser & { headers: Record<string, unknown> } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

function bearer(token: string): Record<string, unknown> {
  return { authorization: `Bearer ${token}` };
}

async function expectUnauthenticated(
  guard: JwtAuthGuard,
  headers: Record<string, unknown>,
): Promise<ApiException> {
  const { context } = makeContext(headers);

  try {
    await guard.canActivate(context);
  } catch (error) {
    const failure = error as ApiException;

    expect(failure.getStatus()).toBe(401);
    expect(failure.code).toBe(ErrorCode.Unauthenticated);

    return failure;
  }

  throw new Error("expected the guard to reject");
}

describe("JwtAuthGuard", () => {
  it("accepts a valid token and attaches the live user", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });
    const { context, request } = makeContext(bearer(token));

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[AUTHENTICATED_USER]).toEqual(user);
  });

  it("rejects a request with no Authorization header", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));

    await expectUnauthenticated(guard, {});
  });

  it("rejects a malformed token", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));

    await expectUnauthenticated(guard, bearer("not-a-jwt"));
  });

  it("rejects an expired token", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    // Issued in the past and already expired, rather than waiting out a real TTL.
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: -1 });

    await expectUnauthenticated(guard, bearer(token));
  });

  it("rejects a token signed with the wrong key", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const forged = new JwtService({ secret: OTHER_SECRET }).sign(
      { sub: USER_ID },
      { algorithm: JWT_ALGORITHM, expiresIn: 900 },
    );

    await expectUnauthenticated(guard, bearer(forged));
  });

  /**
   * The `alg: none` attack. `jsonwebtoken` refuses to *sign* with `none`, so the token is
   * assembled by hand — which is exactly how an attacker would produce one.
   */
  it("rejects an unsigned token claiming `alg: none`", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const encode = (value: object): string =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) + 900,
    })}.`;

    await expectUnauthenticated(guard, bearer(unsigned));
  });

  it("rejects a token with no `sub` claim", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const token = jwt.sign({ role: "admin" }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });

    await expectUnauthenticated(guard, bearer(token));
  });

  /**
   * The revocation property that the database-backed lookup exists for: a valid, unexpired token
   * whose user no longer exists is rejected on the very next request, not 15 minutes later.
   */
  it("rejects a valid token whose user has been deleted", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers(null)));
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });

    await expectUnauthenticated(guard, bearer(token));
  });

  /**
   * The same property for the softer revocation ADR-012 added. `findActiveById` filters on
   * `status = active`, so a disabled account produces the identical `null` a deleted one does —
   * which is why this test looks like the one above and why the guard needs no status branch of its
   * own. The token itself is untouched and still verifies; what changed is the row behind it.
   */
  it("rejects a valid token whose user has been disabled", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers(null)));
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });

    await expectUnauthenticated(guard, bearer(token));
  });

  /**
   * Status is resolved, never asserted by the caller. A token carrying its own `status: "active"`
   * claim must not survive a disabled account — the guard reads the row and ignores the claim.
   */
  it("ignores a status claim smuggled into the token", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers(null)));
    const token = jwt.sign(
      { sub: USER_ID, status: "active", role: "admin" },
      { algorithm: JWT_ALGORITHM, expiresIn: 900 },
    );

    await expectUnauthenticated(guard, bearer(token));
  });

  /**
   * The credential cutoff is checked in the database, not here — but the guard has to hand the
   * lookup the one fact only the token knows: when it was minted. This asserts that `iat` reaches
   * `findActiveByToken` unmodified, because a guard that passed `Date.now()` instead would look
   * identical in every other test and would silently accept every revoked token ever issued.
   */
  it("passes the token's own iat to the account lookup, not the current time", async () => {
    const users = makeUsers();
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, users));
    // A few seconds in the past, not an arbitrary constant: jsonwebtoken derives `exp` from
    // whatever `iat` it is given, so a fixed historical value would sign an already-expired token
    // and the guard would reject it before the lookup was ever reached.
    const issuedAt = Math.floor(Date.now() / 1000) - 5;
    const token = jwt.sign(
      { sub: USER_ID, iat: issuedAt },
      { algorithm: JWT_ALGORITHM, expiresIn: 900 },
    );

    await guard.canActivate(makeContext(bearer(token)).context);

    expect(
      (users as unknown as { findActiveByToken: jest.Mock }).findActiveByToken,
    ).toHaveBeenCalledWith(USER_ID, issuedAt);
  });

  /**
   * A token whose `iat` predates the account's cutoff is refused, and the refusal is the database's
   * — `findActiveByToken` answers `null` for it exactly as it does for a deleted or disabled
   * account, which is why all three are one 401 here.
   */
  it("rejects a token the account lookup refuses on the cutoff", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers(null)));
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });

    await expectUnauthenticated(guard, bearer(token));
  });

  /**
   * `iat` is not optional to this guard. Every token it signs carries one, and a token without it
   * cannot be placed against the cutoff — so it is refused rather than quietly exempted from the
   * check, which would make omitting the claim a bypass.
   */
  it("rejects a token with no iat rather than skipping the cutoff check", async () => {
    const users = makeUsers();
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, users));
    // `noTimestamp` is jsonwebtoken's switch for omitting `iat`.
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, noTimestamp: true });

    await expectUnauthenticated(guard, bearer(token));
    expect(
      (users as unknown as { findActiveByToken: jest.Mock }).findActiveByToken,
    ).not.toHaveBeenCalled();
  });

  it("does not accept a token outside the Bearer scheme", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });

    // A bare token, a Basic credential, and a cookie are all "no token" to this guard.
    await expectUnauthenticated(guard, { authorization: token });
    await expectUnauthenticated(guard, { authorization: `Basic ${token}` });
    await expectUnauthenticated(guard, { cookie: `accessToken=${token}` });
  });

  it("accepts the scheme case-insensitively, as RFC 7235 requires", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const token = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });
    const { context } = makeContext({ authorization: `bEaReR ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  /**
   * Every failure mode must be indistinguishable. A caller that could tell "expired" from "forged"
   * from "deleted user" learns something about the account behind the token.
   */
  it("answers every failure with one identical message", async () => {
    const guard = new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers()));
    const expired = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: -1 });
    const forged = new JwtService({ secret: OTHER_SECRET }).sign(
      { sub: USER_ID },
      { algorithm: JWT_ALGORITHM, expiresIn: 900 },
    );
    const valid = jwt.sign({ sub: USER_ID }, { algorithm: JWT_ALGORITHM, expiresIn: 900 });

    const messages = [
      (await expectUnauthenticated(guard, {})).message,
      (await expectUnauthenticated(guard, bearer("garbage"))).message,
      (await expectUnauthenticated(guard, bearer(expired))).message,
      (await expectUnauthenticated(guard, bearer(forged))).message,
      (
        await expectUnauthenticated(
          new JwtAuthGuard(new AccessTokenVerifier(jwt, makeUsers(null))),
          bearer(valid),
        )
      ).message,
    ];

    expect(new Set(messages).size).toBe(1);
    // The library's own wording must not leak through.
    expect(messages[0]).not.toMatch(/jwt|expired|signature|malformed/i);
  });
});
