import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler";

import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { toWireRole } from "./user-role";

import type { AuthenticatedUser } from "./authenticated-user";
import type { AuthenticatedUserResponse, LoginResponse } from "./dto/login.response";

const OK_STATUS = 200;

/**
 * `/auth/*` — API_CONTRACT_FINAL.md §2.2.
 *
 * ── Two of the four contracted paths ────────────────────────────────────────
 *
 * `POST /auth/login` and `GET /auth/me` are implemented. **`POST /auth/refresh` and
 * `POST /auth/logout` are not**, and their absence is a reported gap rather than an oversight:
 * §2.2 defines logout as "invalidate refresh token", which requires server-side token state that
 * `sam_platform` has no table for — DATA_MODEL.md models no session or refresh-token entity — and
 * inventing one is a schema decision this gate does not take. Issuing a refresh token that nothing
 * can redeem or revoke would be worse than issuing none.
 *
 * The observable consequence, stated so nobody has to discover it: **a session lasts 15 minutes and
 * then the user logs in again.** No token is silently long-lived to compensate.
 *
 * ── Rate limited on its own budget ──────────────────────────────────────────
 *
 * `@SkipThrottle({ forms: true })` is load-bearing. `ThrottlerGuard` evaluates every named
 * throttler on every route it guards, so without it login would also consume — and be blocked by —
 * the 5/hour form-submission bucket, which is exactly the accidental sharing the contract's
 * separate row for login argues against.
 */
@SkipThrottle({ forms: true })
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * **200, not 201.** Nest answers a POST with 201 by default, and logging in creates no resource —
   * §8's status table reserves 201 for creation. `@HttpCode(200)` is the correction.
   *
   * `LoginDto` is imported as a value, never with `import type`: the global pipe finds the class
   * through `design:paramtypes`, and a type-only import erases it — the same trap
   * `inquiries.controller.ts` documents from measurement.
   *
   * `ThrottlerGuard` is attached to this handler rather than the class so that `GET /auth/me`,
   * which is already gated by a token, does not consume the credential-stuffing budget.
   */
  @UseGuards(ThrottlerGuard)
  @HttpCode(OK_STATUS)
  @Post("login")
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto);
  }

  /**
   * `GET /auth/me` — "Current user + role, for admin-surface authorization" (§2.2).
   *
   * **Authenticated, but not role-gated.** Every role that can hold a token may ask who it is; the
   * endpoint discloses nothing the caller did not already prove. `RolesGuard` is deliberately not
   * applied — it denies by default, so applying it here would need a `@Roles()` listing all four
   * roles, which says the same thing less clearly.
   *
   * The value comes from `JwtAuthGuard`'s live read of `sam_platform`, so a role changed a minute
   * ago is the role reported here.
   */
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUserResponse {
    return { id: user.id, email: user.email, role: toWireRole(user.role) };
  }
}
