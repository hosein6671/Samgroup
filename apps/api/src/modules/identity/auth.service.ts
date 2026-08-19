import { Injectable, OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";

import { ACCESS_TOKEN_TTL_SECONDS, JWT_ALGORITHM } from "./jwt.config";
import { AuthSessionsService } from "./auth-sessions.service";
import { PasswordService } from "./password.service";
import { REFRESH_TOKEN_TTL_SECONDS } from "./session.config";
import { UsersService } from "./users.service";
import { toWireRole } from "./user-role";

import type { LoginDto } from "./dto/login.dto";
import type { LoginResponse, RefreshResponse } from "./dto/login.response";

const UNAUTHORIZED_STATUS = 401;

/**
 * The one message a failed login ever produces.
 *
 * It names neither the email nor which half was wrong, because "no such account", "wrong password"
 * and "that account is switched off" must be indistinguishable: a login endpoint that separates
 * them is an account enumeration oracle, and the accounts here are named after real staff.
 * **Account status is inside that set deliberately** — telling an attacker they found a real
 * address that is merely disabled is most of what they wanted to know.
 */
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

/**
 * The one message a failed refresh ever produces.
 *
 * Unknown token, expired session, already-rotated token, revoked session, deleted account,
 * disabled account — one message for all six. The client can do exactly one thing about any of
 * them (log in again), and distinguishing them tells a holder of a stolen or stale token exactly
 * how stale it is. No token material is ever echoed back.
 */
const INVALID_SESSION_MESSAGE = "The session could not be refreshed.";

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
    private readonly sessions: AuthSessionsService,
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
   * `POST /auth/login` — API_CONTRACT_FINAL.md §2.2 and ADR-012.
   *
   * ── Where the account-status check sits, and why there ──────────────────────
   *
   * **After** the password verification, not before it. `findCredentialsByEmail` deliberately does
   * not filter on status, so a disabled account still costs a full argon2 run; short-circuiting on
   * status would make a disabled account answer measurably faster than an active one with a wrong
   * password, which is the timing oracle the decoy hash exists to close. The status filter lives in
   * `findActiveById` below, whose `null` is answered with the same message as every other failure.
   *
   * A disabled account therefore cannot log in, cannot be distinguished from one that does not
   * exist, and — because no session is created — gains no refresh token to hold.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const credentials = await this.users.findCredentialsByEmail(dto.email);

    // The decoy branch: same work, same message, same status. Never an early return.
    const storedHash = credentials?.passwordHash ?? this.decoyHash;
    const passwordMatches = await this.passwords.verify(storedHash, dto.password);

    if (credentials === null || !passwordMatches) {
      throw invalidCredentials();
    }

    // Re-read through the identity projection so the response is assembled from a shape that
    // cannot contain a password hash, rather than from the credential row that can. This read is
    // also the account-status gate: it returns `null` for a disabled account and for one deleted
    // between the two queries, and both are reported as a failed login.
    const user = await this.users.findActiveById(credentials.id);

    if (user === null) {
      throw invalidCredentials();
    }

    const session = await this.sessions.issue(user.id);

    return {
      accessToken: await this.signAccessToken(user.id),
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: session.refreshToken,
      refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      user: { id: user.id, email: user.email, role: toWireRole(user.role) },
    };
  }

  /**
   * `POST /auth/refresh` — ADR-012.
   *
   * ── The whole exchange is one call, on purpose ──────────────────────────────
   *
   * Every check that decides whether this refresh may happen — the token is known, unexpired,
   * unrevoked, and its account is active — is inside `AuthSessionsService.rotate`'s single
   * conditional UPDATE, together with the revoke and the replacement insert. Splitting them across
   * this service would reintroduce the check-then-act window that rotation exists to close, and
   * would let two concurrent requests each believe they had won.
   *
   * So there is nothing to branch on here but success or failure, and failure has one shape.
   *
   * ── No role, no email, no identity ──────────────────────────────────────────
   *
   * The new access token carries `sub` and nothing else, exactly as the login-issued one does; the
   * response carries no `user` object. Refresh proves possession of a session, not of a password.
   */
  async refresh(rawRefreshToken: string): Promise<RefreshResponse> {
    const rotated = await this.sessions.rotate(rawRefreshToken);

    if (rotated === null) {
      throw invalidSession();
    }

    return {
      accessToken: await this.signAccessToken(rotated.userId),
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rotated.refreshToken,
      refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
    };
  }

  /**
   * `POST /auth/logout` — ADR-012.
   *
   * ── Idempotent, and it returns nothing ──────────────────────────────────────
   *
   * The row count is discarded rather than reported. Logging out twice, logging out with a token
   * that had already been rotated, or presenting another account's token all end in the same
   * state — that token is not usable by this caller — and reporting which case it was would tell
   * the caller whether a token they hold is live somewhere else. A second logout is a success.
   *
   * Revocation is scoped to the authenticated caller inside `AuthSessionsService.revoke`; nothing
   * here can end a session belonging to anyone else.
   *
   * ── What logout deliberately does not do ────────────────────────────────────
   *
   * It does not blacklist the access token, which stays technically valid for the remainder of its
   * 15 minutes. Keeping a deny-list would mean persisting every access token ever issued in order
   * to answer a question that expires on its own, and the platform already has a stronger answer
   * for the case that matters: disabling or deleting the account fails the *next* authenticated
   * request, because `JwtAuthGuard` re-reads `sam_platform` every time.
   *
   * It also clears no cookie. This API sets none — see `RefreshDto`.
   */
  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    await this.sessions.revoke(userId, rawRefreshToken);
  }

  /**
   * The access token, unchanged by this gate: HS256, 15 minutes, `sub` as the entire payload.
   *
   * `iat`/`exp` are the signer's to set, and no `role`, `email` or `status` claim was added —
   * every one of those is resolved from `sam_platform` per request precisely so that a change
   * takes effect immediately rather than at the end of a token's life.
   */
  private async signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
  }
}

function invalidCredentials(): ApiException {
  return new ApiException(
    UNAUTHORIZED_STATUS,
    ErrorCode.Unauthenticated,
    INVALID_CREDENTIALS_MESSAGE,
  );
}

function invalidSession(): ApiException {
  return new ApiException(UNAUTHORIZED_STATUS, ErrorCode.Unauthenticated, INVALID_SESSION_MESSAGE);
}
