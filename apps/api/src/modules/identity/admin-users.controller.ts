import { Controller, Get, Header, UseGuards } from "@nestjs/common";

import { withMeta } from "../../common/http/with-meta";

import { Roles } from "./decorators/roles.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { UserRole } from "../../prisma/generated/client";
import { UsersService } from "./users.service";
import { toWireRole } from "./user-role";

import type { AuthenticatedUserResponse } from "./dto/login.response";
import type { ResponseWithMeta } from "../../common/http/with-meta";

/**
 * `GET /admin/users` — API_CONTRACT_FINAL.md §2.10, "Users | `/admin/users` (CRUD, role
 * assignment) | Admin".
 *
 * ── The RBAC proof, and the smallest one the contract already names ─────────
 *
 * This gate needed one protected endpoint that a permitted role reaches and a wrong role does not.
 * Inventing a path for it (`/admin/ping`, `/admin/me`) would have put a route on the wire that no
 * document contracts; §2.10 already contracts this one and already assigns it to Admin alone, so
 * the proof is a real endpoint rather than a scaffold that later has to be removed.
 *
 * **Read-only, deliberately.** The contract says CRUD; this implements the list and nothing else.
 * Creating and updating users, and above all assigning roles, is privilege management — it needs
 * its own gate, and a half-built one is worse than none.
 *
 * ── Why it lives in the Identity module ─────────────────────────────────────
 *
 * `User` is the Identity & Access module's entity (ARCHITECTURE.md §Modules). A separate "Admin"
 * module serving this would have to query `users` itself, which is exactly the cross-module
 * repository access the modular-monolith rule forbids. `/admin/*` is a URL namespace, not a module.
 *
 * ── Never cached ────────────────────────────────────────────────────────────
 *
 * `Cache-Control: no-store` is mandatory on every `/admin/*` response (§2.10), and it is set here
 * rather than left to a proxy: it is the header that keeps a staff list out of any intermediary,
 * and §2.10's whole argument for a separate admin namespace is that this should be structural.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * The staff list: `id`, `email`, `role`, and nothing else.
   *
   * `passwordHash` cannot appear here even by mistake — `UsersService.listAll` selects three
   * columns explicitly, so the hash is never in the object this maps over. `organizationId` and
   * `createdAt` are omitted because no consumer of this gate needs them.
   */
  @Header("Cache-Control", "no-store")
  @Get()
  async list(): Promise<ResponseWithMeta<AuthenticatedUserResponse[]>> {
    const users = await this.users.listAll();

    return withMeta(
      users.map((user) => ({ id: user.id, email: user.email, role: toWireRole(user.role) })),
      { total: users.length },
    );
  }
}
