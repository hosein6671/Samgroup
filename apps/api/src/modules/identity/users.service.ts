import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

import type { AuthenticatedUser } from "./authenticated-user";
import type { UserRole } from "../../prisma/generated/client";

/**
 * The Identity & Access module's `User` repository — ARCHITECTURE.md §Modules lists "users, roles,
 * JWT, RBAC" as one module, and this is the only place in the application that queries `users`.
 *
 * The modular-monolith rule applies to it in both directions: no other module may query `users`,
 * and this one queries nothing else. `Organization` is deliberately not read here even though
 * `User.organizationId` exists — no endpoint in this gate serves it.
 */

/**
 * The columns any identity read is allowed to return.
 *
 * **`passwordHash` is absent, and its absence is the enforcement.** Prisma returns every scalar
 * when no `select` is given, so a query written without one would put the hash into a service
 * return type and one careless spread away from a response body. The only method permitted to
 * select it is `findCredentialsByEmail`, which returns it under a name that cannot be mistaken for
 * a response shape.
 */
const IDENTITY_SELECT = { id: true, email: true, role: true } as const;

/** What `AuthService` needs to check a password, and nothing else. */
export type UserCredentials = {
  id: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The credential lookup behind `POST /auth/login`.
   *
   * Email is matched exactly as stored. `users.email` is a plain `text` column with a
   * case-sensitive unique index, so `Admin@example.com` and `admin@example.com` are two different
   * accounts to PostgreSQL. Normalising the lookup here (lower-casing, or a citext column) would
   * change what the unique index means and is a schema decision, not a login decision — recorded
   * rather than taken. In practice the bootstrap script writes the address exactly as supplied and
   * this reads it back the same way.
   */
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }

  /**
   * Resolves a token's `sub` to the live user.
   *
   * `null` for an id that no longer exists, which is what makes deleting a `User` take effect
   * immediately rather than at the end of the token's remaining lifetime.
   */
  async findAuthenticatedById(id: string): Promise<AuthenticatedUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: IDENTITY_SELECT });
  }

  /**
   * Every user, for the Admin-only `GET /admin/users`.
   *
   * Unpaginated by decision, not by omission: `users` holds internal staff accounts, the RBAC
   * matrix gives only Admin any access to them at all, and inventing a page-size default for a
   * table with single-digit row counts would put a contract on the wire that the real Users CRUD
   * surface (§2.10) would then have to keep. `meta.total` is served so a client never has to count
   * the array itself.
   */
  async listAll(): Promise<{ id: string; email: string; role: UserRole }[]> {
    return this.prisma.user.findMany({ select: IDENTITY_SELECT, orderBy: { email: "asc" } });
  }
}
