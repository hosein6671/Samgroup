import { Injectable, OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";

import { ACCESS_TOKEN_TTL_SECONDS, JWT_ALGORITHM } from "./jwt.config";
import { PasswordService } from "./password.service";
import { UsersService } from "./users.service";
import { toWireRole } from "./user-role";

import type { LoginDto } from "./dto/login.dto";
import type { LoginResponse } from "./dto/login.response";

const UNAUTHORIZED_STATUS = 401;

/**
 * The one message a failed login ever produces.
 *
 * It names neither the email nor which half was wrong, because "no such account" and "wrong
 * password" must be indistinguishable: a login endpoint that distinguishes them is an account
 * enumeration oracle, and the accounts here are named after real staff.
 */
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

@Injectable()
export class AuthService implements OnModuleInit {
  /**
   * A hash of a value no account has, verified against when the email is unknown.
   *
   * Without it the two failure modes are distinguishable by a stopwatch rather than by the
   * response: an unknown email would return as soon as the `SELECT` misses, while a wrong password
   * would first spend argon2's ~50 ms of deliberate work. Verifying this decoy makes both paths do
   * the same amount of work, so the generic message above is actually generic.
   *
   * Built once at startup from 32 random bytes. No literal password appears in this file, and
   * nothing can authenticate against the result because nothing knows the input — it is discarded
   * as soon as it is hashed.
   */
  private decoyHash = "";

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Hashing the decoy costs one argon2 run and is done at startup rather than per request. It is
   * also what makes the timing equal: the decoy is hashed with `ARGON2_OPTIONS`, the same
   * parameters every stored hash carries, so verifying it costs what verifying a real one costs.
   */
  async onModuleInit(): Promise<void> {
    this.decoyHash = await this.passwords.hash(randomBytes(32).toString("hex"));
  }

  /**
   * `POST /auth/login` — API_CONTRACT_FINAL.md §2.2.
   *
   * ── What this deliberately does not check ───────────────────────────────────
   *
   * There is no account-status check, because `users` has no status column. `schema.prisma` and
   * DATA_MODEL.md §1 both give `User` exactly six fields — `id`, `email`, `passwordHash`, `role`,
   * `organizationId`, `createdAt` — and no `isActive`, `disabledAt` or equivalent exists anywhere
   * in the data model. Adding one is a migration and a decision about what "disabled" means for
   * in-flight tokens, so it is reported rather than invented. **Deleting the `User` row is
   * therefore the only revocation this gate has**, and `JwtAuthGuard` is built so that it takes
   * effect on the very next request rather than 15 minutes later.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const credentials = await this.users.findCredentialsByEmail(dto.email);

    // The decoy branch: same work, same message, same status. Never an early return.
    const storedHash = credentials?.passwordHash ?? this.decoyHash;
    const passwordMatches = await this.passwords.verify(storedHash, dto.password);

    if (credentials === null || !passwordMatches) {
      throw new ApiException(
        UNAUTHORIZED_STATUS,
        ErrorCode.Unauthenticated,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    // Re-read through the identity projection so the response is assembled from a shape that
    // cannot contain a password hash, rather than from the credential row that can.
    const user = await this.users.findAuthenticatedById(credentials.id);

    if (user === null) {
      // The row was deleted between the two queries. Reporting it as a failed login is both
      // accurate and the same message as every other failure.
      throw new ApiException(
        UNAUTHORIZED_STATUS,
        ErrorCode.Unauthenticated,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    return {
      accessToken: await this.jwt.signAsync(
        // `sub` is the whole payload. `expiresIn` and the algorithm come from the module
        // registration; `iat`/`exp` are the signer's to set.
        { sub: user.id },
        { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      ),
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: user.id, email: user.email, role: toWireRole(user.role) },
    };
  }
}
