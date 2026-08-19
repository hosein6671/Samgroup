import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../prisma/prisma.module";

import { AdminUsersController } from "./admin-users.controller";
import { AuthController } from "./auth.controller";
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
    JwtAuthGuard,
    RolesGuard,
  ],
  /*
   * Exported so a later module can protect its own routes with `@UseGuards(JwtAuthGuard)` without
   * duplicating identity logic. `UsersService` and `AuthSessionsService` are deliberately NOT
   * exported: no other module has a reason to read `users` or `auth_sessions`, and exporting
   * either now would invite one to. A session table reachable from outside Identity is how a
   * second, disagreeing notion of "logged in" gets built.
   */
  exports: [JwtAuthGuard, RolesGuard],
})
export class IdentityModule {}
