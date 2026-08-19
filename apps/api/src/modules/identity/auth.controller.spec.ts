import { ValidationPipe } from "@nestjs/common";

import { validationExceptionFactory } from "../../common/validation/validation-exception.factory";
import { UserRole } from "../../prisma/generated/client";

import { AdminUsersController } from "./admin-users.controller";
import { AuthController } from "./auth.controller";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { toWireRole } from "./user-role";
import { toWireStatus } from "./user-status";
import { UserStatus } from "../../prisma/generated/client";

import type { AuthService } from "./auth.service";
import type { ApiErrorDetail } from "../../common/http/api-response.types";
import type { UsersService } from "./users.service";

/**
 * The `/auth/*` and `/admin/users` surfaces at the boundary: what the validation pipe accepts,
 * what the handlers return, and which throttler each controller is subject to.
 */

/** The application's actual global pipe, constructed exactly as main.ts constructs it. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

const metadata = { type: "body" as const, metatype: LoginDto };

async function reject(body: unknown): Promise<ApiErrorDetail[]> {
  try {
    await pipe.transform(body, metadata);
  } catch (error) {
    const failure = error as { details?: ApiErrorDetail[] };

    return failure.details ?? [];
  }

  throw new Error("expected the pipe to reject");
}

/** The distinct DTO fields a rejection blamed, in a stable order. */
function fields(details: ApiErrorDetail[]): string[] {
  return [...new Set(details.map((detail) => detail.field))].sort();
}

describe("LoginDto, under the global validation pipe", () => {
  it("accepts an email and a password", async () => {
    const value = await pipe.transform(
      { email: "admin@example.test", password: "correct horse battery staple" },
      metadata,
    );

    expect(value).toEqual({
      email: "admin@example.test",
      password: "correct horse battery staple",
    });
  });

  /**
   * The privilege-escalation guarantee at the outermost boundary: `role` is not a field a client
   * can send and have ignored — sending it is a 400 that names it.
   */
  it("rejects a `role` field by name rather than stripping it", async () => {
    const details = await reject({
      email: "admin@example.test",
      password: "correct horse battery staple",
      role: "admin",
    });

    expect(details.map((detail) => detail.field)).toContain("role");
  });

  it("rejects any other unknown field", async () => {
    for (const field of ["id", "userId", "isAdmin", "organizationId", "passwordHash"]) {
      const details = await reject({
        email: "admin@example.test",
        password: "correct horse battery staple",
        [field]: "anything",
      });

      expect(details.map((detail) => detail.field)).toContain(field);
    }
  });

  /**
   * Asserted on the SET of fields blamed, not on the list: one property can legitimately fail
   * several constraints at once (`isString`, `isNotEmpty`, `isEmail`) and produce a detail for
   * each. What the contract guarantees is that every detail names a real DTO field the frontend can
   * map back to an input — so the assertion is that nothing but `email` is blamed.
   */
  it("rejects a missing or malformed email, blaming only email", async () => {
    expect(fields(await reject({ password: "correct horse battery staple" }))).toEqual(["email"]);
    expect(fields(await reject({ email: "not-an-email", password: "correct horse" }))).toEqual([
      "email",
    ]);
  });

  it("rejects a missing or empty password, blaming only password", async () => {
    expect(fields(await reject({ email: "admin@example.test" }))).toEqual(["password"]);
    expect(fields(await reject({ email: "admin@example.test", password: "" }))).toEqual([
      "password",
    ]);
  });

  it("trims the email but never the password", async () => {
    const value = (await pipe.transform(
      { email: "  admin@example.test  ", password: "  spaced password  " },
      metadata,
    )) as LoginDto;

    expect(value.email).toBe("admin@example.test");
    // A credential is never silently altered — see the field's own note.
    expect(value.password).toBe("  spaced password  ");
  });
});

describe("AuthController", () => {
  it("delegates login to the service unchanged", async () => {
    const response = {
      accessToken: "token",
      tokenType: "Bearer" as const,
      expiresIn: 900,
      refreshToken: "raw-refresh",
      refreshExpiresIn: 604_800,
      user: { id: "id", email: "admin@example.test", role: "admin" },
    };
    const auth = { login: jest.fn().mockResolvedValue(response) } as unknown as AuthService;

    await expect(
      new AuthController(auth).login({ email: "admin@example.test", password: "x" } as LoginDto),
    ).resolves.toBe(response);
  });

  it("serves the guard-resolved identity from GET /auth/me, and nothing more", () => {
    const controller = new AuthController({} as AuthService);

    const body = controller.me({
      id: "6a1f6a0e-0f5f-4a1a-9f8a-3f4d5b6c7d8e",
      email: "manager@example.test",
      role: UserRole.CONTENT_MANAGER,
    });

    expect(body).toEqual({
      id: "6a1f6a0e-0f5f-4a1a-9f8a-3f4d5b6c7d8e",
      email: "manager@example.test",
      role: "content_manager",
    });
    expect(Object.keys(body).sort()).toEqual(["email", "id", "role"]);
  });

  it("passes the raw refresh token to the service and returns its answer unchanged", async () => {
    const response = {
      accessToken: "new-token",
      tokenType: "Bearer" as const,
      expiresIn: 900,
      refreshToken: "rotated-refresh",
      refreshExpiresIn: 604_800,
    };
    const auth = { refresh: jest.fn().mockResolvedValue(response) } as unknown as AuthService;

    await expect(
      new AuthController(auth).refresh({ refreshToken: "raw-refresh" } as RefreshDto),
    ).resolves.toBe(response);
    expect(auth.refresh).toHaveBeenCalledWith("raw-refresh");
  });

  /**
   * The scoping guarantee, at the boundary: the id comes from the guard-resolved user, never from
   * the body. A caller cannot name whose session to end.
   */
  it("scopes logout to the authenticated caller, not to anything in the body", async () => {
    const auth = { logout: jest.fn().mockResolvedValue(undefined) } as unknown as AuthService;
    const caller = {
      id: "6a1f6a0e-0f5f-4a1a-9f8a-3f4d5b6c7d8e",
      email: "manager@example.test",
      role: UserRole.CONTENT_MANAGER,
    };

    const body = await new AuthController(auth).logout(caller, {
      refreshToken: "raw-refresh",
    } as LogoutDto);

    expect(auth.logout).toHaveBeenCalledWith(caller.id, "raw-refresh");
    // 204: nothing is returned, so nothing about the session can leak through the response.
    expect(body).toBeUndefined();
  });
});

/**
 * The BFF boundary, asserted rather than described (ADR-012).
 *
 * `apps/web` owns the browser's HttpOnly refresh cookie. This API receives the raw token as a body
 * value over the trusted internal hop, and must never read, set or clear a cookie — a `Set-Cookie`
 * here would land on a server-side `fetch`, not on a browser, and would put a second, disagreeing
 * copy of the session into the architecture.
 */
describe("the cookie boundary", () => {
  it("has no cookie dependency in apps/api", () => {
    const manifest = require("../../../package.json") as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

    expect(declared.filter((name) => name.includes("cookie"))).toEqual([]);
  });

  it("never sets or reads a cookie anywhere in the identity module", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const root = path.join(__dirname);

    const sources = fs
      .readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".spec.ts"))
      .map((entry) => fs.readFileSync(path.join(root, entry), "utf8"));

    expect(sources.length).toBeGreaterThan(0);

    for (const source of sources) {
      // Comments are stripped first. Prose about cookies is expected here — this module documents
      // the boundary at length, and a doc comment explaining that no Set-Cookie appears anywhere
      // must not be the thing that fails the assertion. Executable code is what is checked.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

      expect(code).not.toMatch(/cookie/i);
    }
  });
});

describe("AdminUsersController", () => {
  it("serves id, email, role and status only, with a total", async () => {
    const users = {
      listAll: jest.fn().mockResolvedValue([
        { id: "a", email: "a@example.test", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        {
          id: "b",
          email: "b@example.test",
          role: UserRole.SALES_EXPERT,
          status: UserStatus.DISABLED,
        },
      ]),
    } as unknown as UsersService;

    const result = await new AdminUsersController(users).list();

    expect(result.data).toEqual([
      { id: "a", email: "a@example.test", role: "admin", status: "active" },
      { id: "b", email: "b@example.test", role: "sales_expert", status: "disabled" },
    ]);
    expect(result.meta).toEqual({ total: 2 });
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });
});

describe("the account-status vocabulary on the wire", () => {
  it("serves the two physical enum labels and no others", () => {
    expect(Object.values(UserStatus).map(toWireStatus).sort()).toEqual(["active", "disabled"]);
  });

  /**
   * ADR-012 fixes the vocabulary at two values. A third member appearing in the Prisma enum would
   * be a lifecycle state nothing in this module enforces, and it must not arrive unnoticed — the
   * same guard `UserRole` carries for the RBAC matrix.
   */
  it("has exactly the two states ADR-012 defines", () => {
    expect(Object.values(UserStatus).sort()).toEqual(["ACTIVE", "DISABLED"]);
  });
});

describe("the role vocabulary on the wire", () => {
  it("serves the four physical enum labels and no others", () => {
    expect(Object.values(UserRole).map(toWireRole).sort()).toEqual([
      "admin",
      "content_manager",
      "customer",
      "sales_expert",
    ]);
  });

  /**
   * SECURITY.md's matrix has exactly four rows. A fifth member appearing in the Prisma enum would
   * be a role nothing in this module authorizes, and it must not arrive unnoticed.
   */
  it("has exactly the four roles the RBAC matrix defines", () => {
    expect(Object.values(UserRole).sort()).toEqual([
      "ADMIN",
      "CONTENT_MANAGER",
      "CUSTOMER",
      "SALES_EXPERT",
    ]);
  });
});
