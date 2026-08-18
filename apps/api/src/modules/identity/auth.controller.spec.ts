import { ValidationPipe } from "@nestjs/common";

import { validationExceptionFactory } from "../../common/validation/validation-exception.factory";
import { UserRole } from "../../prisma/generated/client";

import { AdminUsersController } from "./admin-users.controller";
import { AuthController } from "./auth.controller";
import { LoginDto } from "./dto/login.dto";
import { toWireRole } from "./user-role";

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
});

describe("AdminUsersController", () => {
  it("serves id, email and role only, with a total", async () => {
    const users = {
      listAll: jest
        .fn()
        .mockResolvedValue([{ id: "a", email: "a@example.test", role: UserRole.ADMIN }]),
    } as unknown as UsersService;

    const result = await new AdminUsersController(users).list();

    expect(result.data).toEqual([{ id: "a", email: "a@example.test", role: "admin" }]);
    expect(result.meta).toEqual({ total: 1 });
    expect(JSON.stringify(result)).not.toContain("passwordHash");
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
