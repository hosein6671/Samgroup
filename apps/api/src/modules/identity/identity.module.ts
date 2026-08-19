import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../prisma/prisma.module";

import { AdminUsersController } from "./admin-users.controller";
import { AuthController } from "./auth.controller";
import { AccessTokenVerifier } from "./access-token-verifier";
import { AuthService } from "./auth.service";
import { AuthSessionsService } from "./auth-sessions.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PasswordService } from "./password.service";
import { RolesGuard } from "./guards/roles.guard";
import { UsersService } from "./users.service";
import { ACCESS_TOKEN_TTL_SECONDS, JWT_ALGORITHM } from "./jwt.config";

/**
 * Identity & Access — ARCHITECTURE.md §Modules, "users, roles, JWT, RBAC".
 *
 * Owns `User` in `sam_platform` and is the only module that queries it. It owns the `/auth/*`
 * surface and the `/admin/users` surface, because both read that entity.
 *
 * ── This module has nothing to do with Payload ──────────────────────────────
 *
 * ADR-006 is absolute here: Payload keeps its own admin users in `sam_cms`, hashes their passwords
 * with its own implementation, issues its own sessions, and shares no cookie with this application.
 * Nothing in this module reads, writes, mirrors, syncs or exchanges anything with a Payload
 * account, and `apps/api`'s existing Payload access — the Content module's service API key — is a
 * service credential, never a user identity. A token issued here is not accepted at
 * `cms.<domain>/admin`, and a Payload session is not accepted here.
 *
 * ── The guards are providers, not APP_GUARDs ────────────────────────────────
 *
 * Registering either globally would authenticate the entire platform, and the platform is
 * deliberately public: SECURITY.md says "the public site is entirely unauthenticated in Phase 1",
 * and every catalog, blog, content, SEO and forms endpoint must stay reachable without a token.
 * The guards are attached with `@UseGuards` on the routes that need them, which keeps "public by
 * default, protected by declaration" visible at each controller — and is asserted by test.
 */
@Module({
  imports: [
    PrismaModule,
    /*
     * The signing key is read from configuration at module initialisation and exists only in the
     * process — never in this repository, never in an image, never in a log line. `getOrThrow`
     * rather than `get`: `env.validation.ts` has already refused to boot without it, and this is
     * the second lock on the same door, because a JwtModule that silently registered with
     * `secret: undefined` would sign tokens anyone could forge.
     */
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("jwtSecret"),
        signOptions: { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
        verifyOptions: { algorithms: [JWT_ALGORITHM] },
      }),
    }),
  ],
  controllers: [AuthController, AdminUsersController],
  providers: [
    AuthService,
    AuthSessionsService,
    UsersService,
    PasswordService,
    AccessTokenVerifier,
    JwtAuthGuard,
    RolesGuard,
  ],
  /*
   * The module's published surface: two guards, and the one capability they need.
   *
   * ── Why the third entry is here, and why it is not `UsersService` ──────────
   *
   * **Nest constructs a class-referenced enhancer in the module that declares the controller, not
   * in the module that exported it.** `DependenciesScanner` inserts every class named in
   * `@UseGuards()` into the *host* module's injectables, so `FormsModule` builds its own
   * `JwtAuthGuard` and whatever that guard injects has to resolve there. Exporting the guard class
   * alone is not enough to make it usable — a fact no unit test catches, because a controller spec
   * overrides the guard, so the application boots green in tests and fails at startup with
   * `Nest can't resolve dependencies of the JwtAuthGuard`. Measured from a real boot, not theorised.
   *
   * The first answer was to export `JwtModule` and `UsersService` as well. That was wrong: it
   * handed every consuming module the `users` repository — `findCredentialsByEmail` (the password
   * hash) and `listAll` (the whole staff table) — to solve a wiring problem. Nobody had to *use*
   * it for the boundary to be gone.
   *
   * `AccessTokenVerifier` replaces both. It is the entire authentication capability the platform
   * shares, as one method: an `Authorization` header value in, the live authenticated user or
   * `null` out. It exposes no Prisma, no repository, no lookup by id or email, no password check,
   * no token minting and no session mutation — see its own file.
   *
   * ── What stays inside ──────────────────────────────────────────────────────
   *
   * `UsersService`, `AuthSessionsService`, `AuthService`, `PasswordService` and `JwtModule` are
   * **not** exported. `User` and `AuthSession` are this module's entities and every route that
   * reads or writes them lives here; a second notion of "logged in", or a second reader of
   * `users`, is exactly what the modular-monolith rule exists to prevent. `identity.module.spec.ts`
   * asserts all of this against the real metadata and against the source of every other module.
   */
  exports: [JwtAuthGuard, RolesGuard, AccessTokenVerifier],
})
export class IdentityModule {}
