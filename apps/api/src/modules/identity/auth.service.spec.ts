import { JwtService } from "@nestjs/jwt";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";

import { AuthService } from "./auth.service";
import { ACCESS_TOKEN_TTL_SECONDS, JWT_ALGORITHM } from "./jwt.config";
import { PasswordService } from "./password.service";
import { REFRESH_TOKEN_TTL_SECONDS } from "./session.config";
import { Prisma, UserRole } from "../../prisma/generated/client";

import type { LoginDto } from "./dto/login.dto";
import type { AuthSessionsService } from "./auth-sessions.service";
import type { UsersService } from "./users.service";

/**
 * The login path, exercised against the **real** `PasswordService` and the **real** `JwtService`.
 *
 * Only the database is faked. A test that stubbed argon2 would prove nothing about whether a
 * password actually verifies, and one that stubbed the signer would prove nothing about the claims
 * that reach the wire — both are the parts a reviewer needs evidence for.
 */

const SECRET = "test-signing-secret-at-least-32-characters-long";
const PASSWORD = "correct horse battery staple";
const EMAIL = "admin@example.test";
const USER_ID = "6a1f6a0e-0f5f-4a1a-9f8a-3f4d5b6c7d8e";

const passwords = new PasswordService();
const jwt = new JwtService({ secret: SECRET });

/** One argon2 hash, computed once — each one costs ~50 ms by design. */
let storedHash: string;

beforeAll(async () => {
  storedHash = await passwords.hash(PASSWORD);
}, 30_000);

type UsersStub = {
  findCredentialsByEmail: jest.Mock;
  findActiveById: jest.Mock;
};

type SessionsStub = {
  issue: jest.Mock;
  rotate: jest.Mock;
  revoke: jest.Mock;
};

/** Stand-ins for raw refresh tokens. Nothing here mints one against a database. */
const RAW_REFRESH = "stub-refresh-token";
const ROTATED_REFRESH = "stub-rotated-refresh-token";

function makeUsers(overrides: Partial<UsersStub> = {}): UsersStub {
  return {
    findCredentialsByEmail: jest.fn().mockResolvedValue(null),
    findActiveById: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeSessions(overrides: Partial<SessionsStub> = {}): SessionsStub {
  return {
    issue: jest.fn().mockResolvedValue({ refreshToken: RAW_REFRESH, expiresAt: new Date() }),
    rotate: jest.fn().mockResolvedValue(null),
    revoke: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

async function makeService(
  users: UsersStub,
  sessions: SessionsStub = makeSessions(),
): Promise<AuthService> {
  const service = new AuthService(
    users as unknown as UsersService,
    sessions as unknown as AuthSessionsService,
    passwords,
    jwt,
  );

  // The decoy hash is built in onModuleInit; Nest calls it, and so must this test — otherwise the
  // unknown-email path verifies against an empty string rather than a real hash.
  await service.onModuleInit();

  return service;
}

/** A user that exists, with the known-good password. */
function knownUser(): UsersStub {
  return makeUsers({
    findCredentialsByEmail: jest.fn().mockResolvedValue({ id: USER_ID, passwordHash: storedHash }),
    findActiveById: jest
      .fn()
      .mockResolvedValue({ id: USER_ID, email: EMAIL, role: UserRole.CONTENT_MANAGER }),
  });
}

function login(email = EMAIL, password = PASSWORD): LoginDto {
  return { email, password } as LoginDto;
}

describe("AuthService.login", () => {
  it("issues a token for valid credentials", async () => {
    const service = await makeService(knownUser());

    const response = await service.login(login());

    expect(response.tokenType).toBe("Bearer");
    expect(response.expiresIn).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(response.accessToken).toEqual(expect.any(String));
  });

  it("serves the user's id, email and role — and nothing else", async () => {
    const service = await makeService(knownUser());

    const response = await service.login(login());

    // The role is the physical enum label, not the TypeScript member name.
    expect(response.user).toEqual({ id: USER_ID, email: EMAIL, role: "content_manager" });
    expect(Object.keys(response).sort()).toEqual([
      "accessToken",
      "expiresIn",
      "refreshExpiresIn",
      "refreshToken",
      "tokenType",
      "user",
    ]);
  });

  it("never returns a password hash anywhere in the response", async () => {
    const service = await makeService(knownUser());

    const response = await service.login(login());

    // Serialized rather than key-checked: this catches a hash smuggled at any depth, including
    // inside the token's own payload.
    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain(storedHash);
    expect(serialized).not.toContain("$argon2");
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain("passwordHash");
  });

  it("puts only `sub`, `iat` and `exp` in the token", async () => {
    const service = await makeService(knownUser());

    const { accessToken } = await service.login(login());
    const claims = jwt.verify<Record<string, unknown>>(accessToken, {
      secret: SECRET,
      algorithms: [JWT_ALGORITHM],
    });

    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sub"]);
    expect(claims.sub).toBe(USER_ID);
    // No email, no role: the role is resolved live by JwtAuthGuard, never carried in the token.
    expect(claims).not.toHaveProperty("email");
    expect(claims).not.toHaveProperty("role");
  });

  it("signs a token that expires in 15 minutes", async () => {
    const service = await makeService(knownUser());

    const { accessToken } = await service.login(login());
    const claims = jwt.verify<{ iat: number; exp: number }>(accessToken, {
      secret: SECRET,
      algorithms: [JWT_ALGORITHM],
    });

    expect(claims.exp - claims.iat).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });

  it("rejects a wrong password with 401 UNAUTHENTICATED", async () => {
    const service = await makeService(knownUser());

    await expect(service.login(login(EMAIL, "not the password"))).rejects.toMatchObject({
      code: ErrorCode.Unauthenticated,
    });
  });

  it("rejects an unknown email with 401 UNAUTHENTICATED", async () => {
    const service = await makeService(makeUsers());

    await expect(service.login(login("nobody@example.test"))).rejects.toMatchObject({
      code: ErrorCode.Unauthenticated,
    });
  });

  /**
   * The account-enumeration guarantee, and the reason `AuthService` verifies a decoy hash rather
   * than returning early: an attacker must not be able to tell "no such account" from "wrong
   * password" by the response.
   */
  it("answers an unknown email and a wrong password identically", async () => {
    const unknown = await capture(await makeService(makeUsers()), login("nobody@example.test"));
    const wrong = await capture(await makeService(knownUser()), login(EMAIL, "wrong"));

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.status).toBe(401);
    expect(unknown.code).toBe(wrong.code);
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.details).toBeUndefined();
    expect(wrong.details).toBeUndefined();
  });

  it("names neither the email nor which half was wrong", async () => {
    const failure = await capture(await makeService(knownUser()), login(EMAIL, "wrong"));

    expect(failure.message).not.toContain(EMAIL);
    expect(failure.message).not.toMatch(/password is|no such|not found|unknown user/i);
  });

  /**
   * The one enumeration channel a shared message does not close. Both paths must do argon2's work.
   *
   * Asserted as a ratio rather than an absolute duration: a CI machine's absolute timings are
   * meaningless, but "the unknown-email path is not an order of magnitude faster" is not.
   */
  it("spends comparable time on an unknown email as on a wrong password", async () => {
    const unknownService = await makeService(makeUsers());
    const knownService = await makeService(knownUser());

    const unknownMs = await timeRejection(unknownService, login("nobody@example.test"));
    const wrongMs = await timeRejection(knownService, login(EMAIL, "wrong"));

    expect(unknownMs).toBeGreaterThan(wrongMs / 4);
  }, 30_000);

  it("rejects a login whose user disappears between the two reads", async () => {
    // Credentials verify, but the row is gone by the time the identity projection is read.
    const users = makeUsers({
      findCredentialsByEmail: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, passwordHash: storedHash }),
      findActiveById: jest.fn().mockResolvedValue(null),
    });
    const service = await makeService(users);

    await expect(service.login(login())).rejects.toMatchObject({
      code: ErrorCode.Unauthenticated,
    });
  });

  /**
   * The successor to this file's previous canary, which asserted that `User` had exactly six
   * fields and therefore no status for login to check. It has seven now (ADR-012). The assertion is
   * kept in the same spirit: a column added to the identity model must break a test rather than
   * pass unnoticed, because every one of them is a decision about whether login should consult it.
   */
  it("enforces account status against the exact User model that exists", () => {
    expect(Object.keys(Prisma.UserScalarFieldEnum).sort()).toEqual([
      "createdAt",
      "credentialsRevokedAt",
      "email",
      "id",
      "organizationId",
      "passwordHash",
      "role",
      "status",
    ]);
  });

  /**
   * A disabled account reaches `findActiveById`, which filters on status and answers `null` — the
   * same `null` a deleted row produces, and deliberately the same rejection.
   */
  it("rejects a disabled account with the same failure as an unknown email", async () => {
    const disabled = makeUsers({
      findCredentialsByEmail: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, passwordHash: storedHash }),
      // The status filter lives in the query; a disabled row simply does not come back.
      findActiveById: jest.fn().mockResolvedValue(null),
    });

    const refused = await capture(await makeService(disabled), login());
    const unknown = await capture(await makeService(makeUsers()), login("nobody@example.test"));

    expect(refused.status).toBe(unknown.status);
    expect(refused.code).toBe(unknown.code);
    expect(refused.message).toBe(unknown.message);
    expect(refused.message).not.toMatch(/disabled|inactive|suspended|locked/i);
  });

  it("verifies the password before consulting status, so a disabled account still costs argon2", async () => {
    const disabled = makeUsers({
      findCredentialsByEmail: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, passwordHash: storedHash }),
      findActiveById: jest.fn().mockResolvedValue(null),
    });

    await (await makeService(disabled)).login(login()).catch(() => undefined);

    // The status read happened at all, which is only reachable once the password has verified: an
    // early status check would have rejected before this call.
    expect(disabled.findActiveById).toHaveBeenCalledWith(USER_ID);
  });

  it("creates exactly one session, for the authenticated user", async () => {
    const sessions = makeSessions();

    await (await makeService(knownUser(), sessions)).login(login());

    expect(sessions.issue).toHaveBeenCalledTimes(1);
    expect(sessions.issue).toHaveBeenCalledWith(USER_ID);
  });

  it("creates no session for a failed login", async () => {
    const sessions = makeSessions();

    await (
      await makeService(knownUser(), sessions)
    )
      .login(login(EMAIL, "wrong"))
      .catch(() => undefined);

    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it("serves the issued refresh token, with a 7-day lifetime", async () => {
    const response = await (await makeService(knownUser())).login(login());

    expect(response.refreshToken).toBe(RAW_REFRESH);
    expect(response.refreshExpiresIn).toBe(REFRESH_TOKEN_TTL_SECONDS);
    expect(response.refreshExpiresIn).toBe(7 * 24 * 60 * 60);
  });

  it("keeps the refresh token out of the access token", async () => {
    const { accessToken } = await (await makeService(knownUser())).login(login());

    expect(accessToken).not.toContain(RAW_REFRESH);
  });
});

describe("AuthService.refresh", () => {
  function rotating(): SessionsStub {
    return makeSessions({
      rotate: jest.fn().mockResolvedValue({
        userId: USER_ID,
        refreshToken: ROTATED_REFRESH,
        expiresAt: new Date(),
      }),
    });
  }

  it("issues a new access token and a rotated refresh token", async () => {
    const service = await makeService(makeUsers(), rotating());

    const response = await service.refresh(RAW_REFRESH);

    expect(response.tokenType).toBe("Bearer");
    expect(response.expiresIn).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(response.refreshToken).toBe(ROTATED_REFRESH);
    expect(response.refreshToken).not.toBe(RAW_REFRESH);
    expect(response.refreshExpiresIn).toBe(REFRESH_TOKEN_TTL_SECONDS);
  });

  it("signs the replacement token for the session owner, with login's exact claims", async () => {
    const service = await makeService(makeUsers(), rotating());

    const { accessToken } = await service.refresh(RAW_REFRESH);
    const claims = jwt.verify<Record<string, unknown>>(accessToken, {
      secret: SECRET,
      algorithms: [JWT_ALGORITHM],
    });

    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sub"]);
    expect(claims.sub).toBe(USER_ID);
    expect(claims).not.toHaveProperty("role");
    expect(claims).not.toHaveProperty("status");
  });

  it("serves no identity and no session internals", async () => {
    const service = await makeService(makeUsers(), rotating());

    const response = await service.refresh(RAW_REFRESH);

    expect(Object.keys(response).sort()).toEqual([
      "accessToken",
      "expiresIn",
      "refreshExpiresIn",
      "refreshToken",
      "tokenType",
    ]);
    expect(response).not.toHaveProperty("user");
    expect(JSON.stringify(response)).not.toContain("tokenHash");
  });

  /**
   * `rotate` collapses unknown, expired, revoked, already-rotated, deleted and disabled into one
   * `null`; this asserts the service does not re-expand them into distinguishable answers.
   */
  it("answers every unusable token with one generic 401", async () => {
    const service = await makeService(makeUsers(), makeSessions());

    const failure = await captureRefresh(service, RAW_REFRESH);

    expect(failure.status).toBe(401);
    expect(failure.code).toBe(ErrorCode.Unauthenticated);
    expect(failure.details).toBeUndefined();
    expect(failure.message).not.toMatch(/expired|revoked|unknown|disabled|deleted|malformed/i);
  });

  it("never echoes the presented token back in the failure", async () => {
    const service = await makeService(makeUsers(), makeSessions());

    const failure = await captureRefresh(service, RAW_REFRESH);

    expect(failure.message).not.toContain(RAW_REFRESH);
  });
});

describe("AuthService.logout", () => {
  it("revokes the caller's own session, scoped by the authenticated user id", async () => {
    const sessions = makeSessions();

    await (await makeService(makeUsers(), sessions)).logout(USER_ID, RAW_REFRESH);

    expect(sessions.revoke).toHaveBeenCalledWith(USER_ID, RAW_REFRESH);
  });

  /**
   * Idempotency at this layer: `revoke` reporting that it changed nothing is neither an error nor
   * reported. A second logout, an already-rotated token and another account's token all land here.
   */
  it("succeeds when nothing was revoked", async () => {
    const sessions = makeSessions({ revoke: jest.fn().mockResolvedValue(0) });

    await expect(
      (await makeService(makeUsers(), sessions)).logout(USER_ID, RAW_REFRESH),
    ).resolves.toBeUndefined();
  });

  it("returns nothing, so no session state can leak through it", async () => {
    const result = await (
      await makeService(makeUsers(), makeSessions())
    ).logout(USER_ID, RAW_REFRESH);

    expect(result).toBeUndefined();
  });

  /**
   * There is no access-token deny-list, and this is where its absence is recorded: logout revokes
   * and does nothing else. An implementation that started tracking issued access tokens would need
   * another collaborator, and this assertion would fail.
   */
  it("does nothing but revoke", async () => {
    const sessions = makeSessions();

    await (await makeService(makeUsers(), sessions)).logout(USER_ID, RAW_REFRESH);

    expect(sessions.issue).not.toHaveBeenCalled();
    expect(sessions.rotate).not.toHaveBeenCalled();
    expect(sessions.revoke).toHaveBeenCalledTimes(1);
  });
});

async function capture(
  service: AuthService,
  dto: LoginDto,
): Promise<{ status: number; code: string; message: string; details: unknown }> {
  try {
    await service.login(dto);
  } catch (error) {
    const failure = error as ApiException;

    return {
      status: failure.getStatus(),
      code: failure.code,
      message: failure.message,
      details: failure.details,
    };
  }

  throw new Error("expected login to reject");
}

async function captureRefresh(
  service: AuthService,
  rawToken: string,
): Promise<{ status: number; code: string; message: string; details: unknown }> {
  try {
    await service.refresh(rawToken);
  } catch (error) {
    const failure = error as ApiException;

    return {
      status: failure.getStatus(),
      code: failure.code,
      message: failure.message,
      details: failure.details,
    };
  }

  throw new Error("expected refresh to reject");
}

async function timeRejection(service: AuthService, dto: LoginDto): Promise<number> {
  const started = process.hrtime.bigint();

  await service.login(dto).catch(() => undefined);

  return Number(process.hrtime.bigint() - started) / 1_000_000;
}
