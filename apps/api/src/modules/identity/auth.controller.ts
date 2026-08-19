import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler";

import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { toWireRole } from "./user-role";

import type { AuthenticatedUser } from "./authenticated-user";
import type {
  AuthenticatedUserResponse,
  LoginResponse,
  RefreshResponse,
} from "./dto/login.response";

const OK_STATUS = 200;
const NO_CONTENT_STATUS = 204;

/**
 * `/auth/*` — API_CONTRACT_FINAL.md §2.2, now complete: login, refresh, logout, me.
 *
 * ── This controller reads no cookies and sets none ──────────────────────────
 *
 * §2.2 describes the refresh token as living in an httpOnly cookie, and it does — **`apps/web`'s**
 * cookie. §1 of the same document is explicit that no browser-originated call ever reaches NestJS;
 * every request here arrives server-side from Next.js, which is why `main.ts` runs with CORS off.
 * A browser's `Cookie` header therefore never gets this far, and a `Set-Cookie` from here would
 * land on a server-side `fetch` rather than on a browser.
 *
 * So the boundary is: this API issues and accepts the raw refresh token as a value, in the body,
 * over the trusted internal hop; `apps/web` owns the browser cookie — its name, its attributes,
 * setting it and clearing it. ADR-012 records that split. **No cookie parser, and no `Set-Cookie`,
 * appears anywhere in `apps/api`** — asserted by test, not left as an intention.
 *
 * ── Rate limited on its own budget ──────────────────────────────────────────
 *
 * `@SkipThrottle({ forms: true })` is load-bearing. `ThrottlerGuard` evaluates every named
 * throttler on every route it guards, so without it these routes would also consume — and be
 * blocked by — the 5/hour form-submission bucket, which is exactly the accidental sharing the
 * contract's separate row for login argues against.
 */
@SkipThrottle({ forms: true })
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * **200, not 201.** Nest answers a POST with 201 by default, and logging in creates no resource
   * the client can address — §8's status table reserves 201 for creation, and the `AuthSession`
   * row this now writes has no URL and is never served. `@HttpCode(200)` is the correction.
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
   * `POST /auth/refresh` — "Rotate access token" (§2.2), and the refresh token with it.
   *
   * ── Carries no `JwtAuthGuard`, deliberately ────────────────────────────────
   *
   * The entire point of this endpoint is to be reachable once the access token has expired;
   * requiring a valid one would make it useful only while it was unnecessary. The refresh token
   * **is** the authentication factor, which is why it is 256 bits of `randomBytes` rather than an
   * identifier — see `refresh-token.ts`.
   *
   * ── Not throttled by the login bucket, and not by a new one ────────────────
   *
   * §Rate limits budgets seven endpoint groups and refresh is not among them. Attaching the 5-per-
   * 15-minutes login limit here would cap a legitimate session at five renewals per quarter hour
   * across every tab a user has open, and inventing a separate budget would be inventing contract.
   * The endpoint is not a guessing surface in the way login is: there is no account to enumerate
   * and no password to try, only a 256-bit value that no amount of request volume makes reachable.
   * Recorded rather than silently chosen.
   *
   * **200**, matching login: rotation replaces a resource, it does not create an addressable one.
   */
  @HttpCode(OK_STATUS)
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto): Promise<RefreshResponse> {
    return this.auth.refresh(dto.refreshToken);
  }

  /**
   * `POST /auth/logout` — "Invalidate refresh token, clear cookie" (§2.2).
   *
   * The first half happens here. **The second half is `apps/web`'s**, because the cookie is
   * `apps/web`'s; this API has none to clear.
   *
   * ── Authenticated, per the contract's own **A** ────────────────────────────
   *
   * The access token identifies *who* is logging out, and `AuthSessionsService.revoke` puts that
   * id in its WHERE clause — so presenting another account's refresh token revokes nothing.
   * Without the guard there would be no id to scope to, and logout would become a way to end
   * strangers' sessions.
   *
   * A caller whose account has been deleted or disabled never reaches the handler: the guard
   * re-reads `sam_platform` and refuses. That is not a gap — their sessions are already unusable.
   *
   * ── 204, and the reason it is not 200 ──────────────────────────────────────
   *
   * §2.2 does not specify a status and §8's table has no row for "succeeded, nothing to say".
   * There is genuinely no representation to return: the session is gone, and a body describing
   * what was revoked would leak whether the presented token had still been live. 204 says exactly
   * that, and keeps the endpoint idempotent in shape as well as in effect — a second logout
   * answers identically to the first.
   */
  @UseGuards(JwtAuthGuard)
  @HttpCode(NO_CONTENT_STATUS)
  @Post("logout")
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto): Promise<void> {
    await this.auth.logout(user.id, dto.refreshToken);
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
   * ago is the role reported here — and a disabled or deleted account does not reach this handler
   * at all. `status` is not served: this answers only for active accounts, so the field would
   * carry one constant value. No session data appears here either.
   */
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUserResponse {
    return { id: user.id, email: user.email, role: toWireRole(user.role) };
  }
}
