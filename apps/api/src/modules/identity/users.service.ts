import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { UserStatus } from "../../prisma/generated/client";

import type { AuthenticatedUser } from "./authenticated-user";
import type { UserRole } from "../../prisma/generated/client";

/**
 * The Identity & Access module's `User` repository — ARCHITECTURE.md §Modules lists "users, roles,
 * JWT, RBAC" as one module, and this is the only place that reads `users` as an entity.
 *
 * The modular-monolith rule applies to it in both directions: no other module may query `users`,
 * and this one queries nothing else. `Organization` is deliberately not read here even though
 * `User.organizationId` exists — no endpoint in this gate serves it. The one other reference to
 * `users` in the application is `AuthSessionsService`'s `user: { status: ACTIVE }` relation filter,
 * which is inside this same module and cannot return a user column to anyone.
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

/** One row of the Admin staff list. `status` is authoritative account state, not a display flag. */
export type AdminUserRow = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
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
   *
   * **Status is deliberately not filtered here.** A disabled account must still cost a full argon2
   * verification, or the response time would say "this address exists but is switched off" —
   * exactly the disclosure `AuthService`'s single message and decoy hash exist to prevent. The
   * status check happens after the password has been verified, and produces the same rejection.
   */
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }

  /**
   * Resolves an access token to the live user — and only if that token is still honoured.
   *
   * `null` for all three ways an access token stops working, which is why the guard needs no
   * branches of its own and why the caller cannot tell them apart:
   *
   *   1. **The row is gone.** Deleting a `User` revokes access on the very next request.
   *   2. **The account is `disabled`.** Same immediacy; the status is read from `sam_platform`
   *      every time and never from a claim, so an account switched off a second ago is refused now.
   *   3. **The token predates the account's credential cutoff** (ADR-012 §7). This is the one that
   *      makes disable a *revocation* rather than a suspension: re-enabling an account clears
   *      neither `credentials_revoked_at` nor the sessions, so a token minted before the disable
   *      stays dead forever — even though the account is active again and even though the token's
   *      own `exp` has not passed.
   *
   * ── The cutoff comparison, and why it is expressed this way ─────────────────
   *
   * A JWT `iat` is **whole seconds**; `credentials_revoked_at` is a microsecond-precision
   * `timestamptz`. Comparing them needs a rule that cannot round the wrong way, and the rule is:
   *
   *     accept ⟺ credentials_revoked_at IS NULL OR credentials_revoked_at < to_timestamp(iat)
   *
   * Reading it in wall-clock terms: **a token is rejected whenever its `iat` second is at or
   * before the second in which the revocation happened.** A token issued at 10.2 carries
   * `iat = 10`; a disable at 10.4 stores 10.4; `10.4 < 10.0` is false, so it is rejected — which
   * is correct, because it was issued before the disable. The rounding always resolves against the
   * token, never in its favour, so the boundary can reject up to one second more than strictly
   * necessary and never one microsecond less.
   *
   * That one second is a real and deliberate cost: if an account were disabled and re-enabled
   * inside a single second, a token minted in that same second would also be refused. It costs one
   * retry, it self-heals as soon as the clock ticks, and it is the direction to err in.
   *
   * The comparison is a `Date`, not arithmetic on seconds, precisely so no `floor`/`ceil` appears
   * in application code where it could be written the other way round by mistake.
   */
  async findActiveByToken(id: string, issuedAtSeconds: number): Promise<AuthenticatedUser | null> {
    // `findFirst` rather than `findUnique`: the filter is the primary key **and** the two
    // authorization predicates, and `findUnique` accepts only the key. Still one indexed lookup —
    // the extra predicates are applied to the row the index found, not to a scan.
    return this.prisma.user.findFirst({
      where: {
        id,
        status: UserStatus.ACTIVE,
        OR: [
          { credentialsRevokedAt: null },
          { credentialsRevokedAt: { lt: new Date(issuedAtSeconds * 1000) } },
        ],
      },
      select: IDENTITY_SELECT,
    });
  }

  /**
   * The same account gate without a token to date-check — used by `POST /auth/login`, which is
   * about to *mint* credentials rather than honour an existing one.
   *
   * There is deliberately no cutoff comparison here. A fresh login's token is issued now, so it is
   * necessarily after any past revocation; applying the boundary would only be able to reject a
   * credential that does not exist yet.
   */
  async findActiveById(id: string): Promise<AuthenticatedUser | null> {
    return this.prisma.user.findFirst({
      where: { id, status: UserStatus.ACTIVE },
      select: IDENTITY_SELECT,
    });
  }

  /**
   * Every user, for the Admin-only `GET /admin/users`.
   *
   * Unpaginated by decision, not by omission: `users` holds internal staff accounts, the RBAC
   * matrix gives only Admin any access to them at all, and inventing a page-size default for a
   * table with single-digit row counts would put a contract on the wire that the real Users CRUD
   * surface (§2.10) would then have to keep. `meta.total` is served so a client never has to count
   * the array itself.
   *
   * `status` is included because an Admin list of accounts that cannot show which of them are
   * switched off is a list that misleads — the one caller of this endpoint is the surface that
   * would eventually operate the switch. It is read-only here; no endpoint in this gate writes it.
   */
  async listAll(): Promise<AdminUserRow[]> {
    return this.prisma.user.findMany({
      select: { ...IDENTITY_SELECT, status: true },
      orderBy: { email: "asc" },
    });
  }
}
