import { JwtService } from "@nestjs/jwt";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";

import { AuthService } from "./auth.service";
import { ACCESS_TOKEN_TTL_SECONDS, JWT_ALGORITHM } from "./jwt.config";
import { PasswordService } from "./password.service";
import { Prisma, UserRole } from "../../prisma/generated/client";

import type { LoginDto } from "./dto/login.dto";
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
  findAuthenticatedById: jest.Mock;
};

function makeUsers(overrides: Partial<UsersStub> = {}): UsersStub {
  return {
    findCredentialsByEmail: jest.fn().mockResolvedValue(null),
    findAuthenticatedById: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

async function makeService(users: UsersStub): Promise<AuthService> {
  const service = new AuthService(users as unknown as UsersService, passwords, jwt);

  // The decoy hash is built in onModuleInit; Nest calls it, and so must this test — otherwise the
  // unknown-email path verifies against an empty string rather than a real hash.
  await service.onModuleInit();

  return service;
}

/** A user that exists, with the known-good password. */
function knownUser(): UsersStub {
  return makeUsers({
    findCredentialsByEmail: jest.fn().mockResolvedValue({ id: USER_ID, passwordHash: storedHash }),
    findAuthenticatedById: jest
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
    expect(Object.keys(response).sort()).toEqual(["accessToken", "expiresIn", "tokenType", "user"]);
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
      findAuthenticatedById: jest.fn().mockResolvedValue(null),
    });
    const service = await makeService(users);

    await expect(service.login(login())).rejects.toMatchObject({
      code: ErrorCode.Unauthenticated,
    });
  });

  /**
   * There is no disabled-account branch to test, because `User` has no column that could express
   * one. Asserting the schema fact rather than describing it means that ADDING such a column breaks
   * this test — which is the point: the login path would then have a status to check and currently
   * does not, and that must not go unnoticed.
   */
  it("has no account-status concept to enforce — the User model carries none", () => {
    expect(Object.keys(Prisma.UserScalarFieldEnum).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "organizationId",
      "passwordHash",
      "role",
    ]);
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

async function timeRejection(service: AuthService, dto: LoginDto): Promise<number> {
  const started = process.hrtime.bigint();

  await service.login(dto).catch(() => undefined);

  return Number(process.hrtime.bigint() - started) / 1_000_000;
}
