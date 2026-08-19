import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { UserStatus } from "../../prisma/generated/client";

import { REFRESH_TOKEN_TTL_SECONDS } from "./session.config";
import { digestRefreshToken, generateRefreshToken } from "./refresh-token";

/**
 * The `auth_sessions` repository — the server-side half of a login (ADR-012).
 *
 * ── What a "session" is here, and what it is not ────────────────────────────
 *
 * One row is one live refresh credential. It is not a device record, not an activity log and not
 * an analytics surface: the table has six columns and none of them is an IP address, a user agent
 * or a `lastUsedAt`. Adding any of those would collect personal data that no endpoint needs and
 * that no document asks for.
 *
 * ── The raw token exists in exactly two places, and neither is this database ─
 *
 * It is returned to `apps/web`, and it is put by `apps/web` into that tier's own HttpOnly cookie.
 * What reaches PostgreSQL is `digestRefreshToken`'s output and only that. Nothing in this file
 * logs either value.
 */

/** What a caller receives when a session is created. The raw token is returned exactly once. */
export type IssuedSession = {
  /** Raw, un-digested, and never persisted in this form. Hand it to the BFF; log it nowhere. */
  readonly refreshToken: string;
  readonly expiresAt: Date;
};

/** What a successful rotation hands back. The presented token is revoked by the time this exists. */
export type RotatedSession = {
  readonly userId: string;
  /** The replacement, raw. The old one is dead. */
  readonly refreshToken: string;
  readonly expiresAt: Date;
};

@Injectable()
export class AuthSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A fresh session for a user who has just proved their password. */
  async issue(userId: string, now: Date = new Date()): Promise<IssuedSession> {
    const refreshToken = generateRefreshToken();
    const expiresAt = expiryFrom(now);

    await this.prisma.authSession.create({
      data: { userId, tokenHash: digestRefreshToken(refreshToken), expiresAt },
    });

    return { refreshToken, expiresAt };
  }

  /**
   * Exchanges a raw refresh token for a replacement, atomically. `null` for every reason a token
   * can be unusable — unknown, expired, already revoked, or belonging to a disabled or deleted
   * account — because the caller answers all of them with one message.
   *
   * ── The race, and why this is safe against it ──────────────────────────────
   *
   * Two requests can arrive carrying the same raw token: a retry, a double submit, two server
   * instances. Exactly one must win, and the loser must not receive a second replacement —
   * otherwise one token quietly becomes two live sessions.
   *
   * The claim is a **conditional UPDATE**, not a read followed by a write:
   *
   *     UPDATE auth_sessions SET revoked_at = now
   *      WHERE token_hash = ... AND revoked_at IS NULL AND expires_at > now AND <user is active>
   *
   * Under PostgreSQL's READ COMMITTED, the second transaction to reach that row blocks on the
   * first's lock, and when the first commits it **re-evaluates its own WHERE clause against the
   * new row version** — in which `revoked_at` is no longer NULL. So it matches nothing and reports
   * `count: 0`. That is the whole mechanism: no advisory lock, no in-process mutex, no Redis, and
   * nothing that stops working the moment a second container exists.
   *
   * Requiring `count === 1` rather than `>= 1` matters for the same reason the unique index on
   * `token_hash` does: one token names at most one row, and a claim that touched two would mean
   * that invariant had already been broken.
   *
   * ── Why the whole exchange is one transaction ──────────────────────────────
   *
   * The revoke and the insert must commit together or not at all. Committing the revoke alone
   * would log the user out while telling them they had refreshed; committing the insert alone
   * would leave both tokens live, which is exactly the state rotation exists to prevent. A throw
   * anywhere inside rolls the claim back and the presented token stays valid — the safe failure.
   *
   * ── The account check is part of the claim, not a step before it ───────────
   *
   * `user: { status: ACTIVE }` is a relation filter inside the same UPDATE, so a disabled account
   * cannot win the claim rather than being rejected after winning it. A deleted account needs no
   * clause at all: its rows are gone with it (ON DELETE CASCADE).
   */
  async rotate(rawToken: string, now: Date = new Date()): Promise<RotatedSession | null> {
    const presentedHash = digestRefreshToken(rawToken);
    const replacementToken = generateRefreshToken();
    const expiresAt = expiryFrom(now);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.authSession.updateMany({
          where: {
            tokenHash: presentedHash,
            revokedAt: null,
            expiresAt: { gt: now },
            user: { status: UserStatus.ACTIVE },
          },
          data: { revokedAt: now },
        });

        if (claimed.count !== 1) {
          return null;
        }

        // Read after the claim rather than before it: this transaction holds the row's lock, so
        // nothing else can change it underneath. Reading first would have been a check-then-act,
        // which is the shape the conditional UPDATE exists to avoid.
        const claimedSession = await tx.authSession.findUnique({
          where: { tokenHash: presentedHash },
          select: { userId: true },
        });

        if (claimedSession === null) {
          return null;
        }

        await tx.authSession.create({
          data: {
            userId: claimedSession.userId,
            tokenHash: digestRefreshToken(replacementToken),
            expiresAt,
          },
        });

        return { userId: claimedSession.userId, refreshToken: replacementToken, expiresAt };
      });
    } catch {
      // A rolled-back transaction leaves the presented token exactly as it was — still valid —
      // which is the failure to prefer. The error itself is discarded rather than surfaced: it can
      // quote a constraint name, and the caller answers every failure identically anyway.
      return null;
    }
  }

  /**
   * Revokes one session, scoped to its owner — the logout primitive.
   *
   * `userId` is in the WHERE clause and is **not** optional. Without it, a caller holding any
   * valid access token could revoke any session whose raw token they had obtained, which turns
   * logout into a denial-of-service primitive aimed at other accounts. With it, presenting someone
   * else's refresh token matches nothing and the caller has logged out only themselves.
   *
   * Returns how many rows changed, which the caller deliberately does not report: revoking an
   * unknown, already-revoked or foreign token is still a successful logout, because the end state
   * that was asked for — that token is not usable by this caller — holds either way.
   */
  async revoke(userId: string, rawToken: string, now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.authSession.updateMany({
      where: { userId, tokenHash: digestRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: now },
    });

    return count;
  }
}

/** Seven days from `now`, per `session.config.ts`. Never read from the environment. */
function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
