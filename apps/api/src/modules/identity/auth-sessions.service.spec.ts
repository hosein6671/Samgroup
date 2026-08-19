import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { UserRole, UserStatus } from "../../prisma/generated/client";

import { AuthSessionsService } from "./auth-sessions.service";
import { UsersService } from "./users.service";
import { digestRefreshToken, generateRefreshToken } from "./refresh-token";
import { REFRESH_TOKEN_TTL_SECONDS } from "./session.config";

/**
 * Rotation, revocation and the concurrency guarantee, against a **real PostgreSQL**.
 *
 * ── Why this one suite is not mocked ────────────────────────────────────────
 *
 * Everything this file asserts is a property of the database, not of the TypeScript around it. The
 * single-winner guarantee is PostgreSQL's READ COMMITTED re-evaluating a conditional UPDATE's WHERE
 * clause after the row it blocked on was committed by someone else; a mocked Prisma would return
 * whatever `count` the mock was told to, and would prove that the test author believed the
 * mechanism worked. `ON DELETE CASCADE` and the unique index on `token_hash` are the same kind of
 * fact. So this suite runs against the real thing or it does not run.
 *
 * ── Opt-in, and skipped rather than failed when there is no database ────────
 *
 * `SAM_TEST_AUTH_SESSIONS_DATABASE_URL` arms it, process-scoped, following the precedent every
 * seed script in this repository sets — no `.env` file is read and no default is compiled in. With
 * the variable unset the suite skips, so `pnpm test` stays green on a machine with no PostgreSQL
 * and in a pipeline that has not provisioned one. **A skipped run proves nothing**, which is why
 * the gate report states separately that it was executed and against what.
 *
 *   SAM_TEST_AUTH_SESSIONS_DATABASE_URL=postgresql://... \
 *   NODE_OPTIONS=--experimental-vm-modules pnpm --filter @sam-group/api test
 *
 * `--experimental-vm-modules` is not optional and is not about this file: Prisma 7's client engine
 * loads its query compiler through a dynamic `import()` of a WASM module, which Jest's CommonJS VM
 * refuses without the flag ("A dynamic import callback was invoked without
 * --experimental-vm-modules"). Measured, not guessed — the suite fails to start without it. It is
 * left off the default `test` script deliberately, so the flag arrives with the database rather
 * than being carried by every unit run that has no use for it.
 *
 * ── It cleans up after itself ───────────────────────────────────────────────
 *
 * Every row it creates hangs off users whose email carries `TEST_EMAIL_PREFIX`, and those users are
 * deleted in `afterAll` — which takes their sessions with them through the FK. Nothing else in
 * `sam_platform` is read or written.
 */

const DATABASE_URL = process.env.SAM_TEST_AUTH_SESSIONS_DATABASE_URL;
const describeWithDatabase = DATABASE_URL === undefined ? describe.skip : describe;

/** Every row this suite creates is identifiable by this, and nothing else in `users` matches it. */
const TEST_EMAIL_PREFIX = "auth-sessions-spec-";

/**
 * A hash-shaped constant, not a real credential: no test here logs in, so no password is verified
 * and this value only has to satisfy the column's NOT NULL.
 */
const UNUSABLE_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$not-a-real-hash$not-a-real-hash";

describeWithDatabase("AuthSessionsService, against PostgreSQL", () => {
  let prisma: PrismaService;
  let sessions: AuthSessionsService;
  let users: UsersService;

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService({ databaseUrl: DATABASE_URL }));
    await prisma.onModuleInit();
    sessions = new AuthSessionsService(prisma);
    users = new UsersService(prisma);

    // Refuse to run anywhere but sam_platform, asked of the server rather than parsed out of the
    // URL — the same guard `seed-admin.ts` applies, and for the same ADR-002 reason.
    const rows = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    const database = rows[0]?.current_database;

    if (database !== "sam_platform") {
      throw new Error(`Refusing to run against '${String(database)}'. Expected 'sam_platform'.`);
    }
  }, 30_000);

  afterAll(async () => {
    if (prisma !== undefined) {
      // Sessions go with the users, through ON DELETE CASCADE — which the last test asserts.
      await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
      await prisma.onModuleDestroy();
    }
  });

  async function createUser(status: UserStatus = UserStatus.ACTIVE): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}${randomUUID()}@example.test`,
        passwordHash: UNUSABLE_PASSWORD_HASH,
        role: UserRole.ADMIN,
        status,
      },
      select: { id: true },
    });

    return user.id;
  }

  /**
   * A status transition written the only way this platform can write one: **a direct UPDATE**.
   * There is no disable endpoint, deliberately, which is exactly why the invariant is enforced by
   * database triggers rather than by a service — a test that called a service would be testing a
   * path that production does not have.
   */
  async function disable(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.DISABLED } });
  }

  async function enable(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
  }

  async function readUser(userId: string): Promise<{ credentialsRevokedAt: Date | null }> {
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credentialsRevokedAt: true },
    });

    return row;
  }

  /** The cutoff as whole seconds, for building `iat` values around it. */
  async function cutoffSeconds(userId: string): Promise<number> {
    const { credentialsRevokedAt } = await readUser(userId);

    return Math.floor((credentialsRevokedAt?.getTime() ?? 0) / 1000);
  }

  /** `iat` as the JWT signer writes it: whole seconds. */
  function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  // ── Issuing ───────────────────────────────────────────────────────────────

  describe("issue", () => {
    it("creates exactly one row, and stores the digest rather than the token", async () => {
      const userId = await createUser();

      const issued = await sessions.issue(userId);

      const rows = await prisma.authSession.findMany({ where: { userId } });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).toBe(digestRefreshToken(issued.refreshToken));
      expect(rows[0]?.tokenHash).not.toBe(issued.refreshToken);
      expect(rows[0]?.revokedAt).toBeNull();
    });

    /**
     * The claim the whole persistence design rests on, checked against the table itself rather than
     * against the object the service returned: the raw token appears in no column of no row.
     */
    it("puts the raw token nowhere in the database", async () => {
      const userId = await createUser();

      const issued = await sessions.issue(userId);

      const [row] = await prisma.authSession.findMany({ where: { userId } });

      expect(JSON.stringify(row)).not.toContain(issued.refreshToken);
    });

    it("expires seven days out", async () => {
      const now = new Date("2026-08-19T12:00:00.000Z");
      const userId = await createUser();

      const issued = await sessions.issue(userId, now);

      expect(issued.expiresAt.getTime() - now.getTime()).toBe(REFRESH_TOKEN_TTL_SECONDS * 1000);
    });

    it("allows a user to hold several sessions at once", async () => {
      const userId = await createUser();

      await sessions.issue(userId);
      await sessions.issue(userId);

      // Nothing caps concurrent sessions, and nothing in this platform contracts a cap. A second
      // browser is not a security event.
      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(2);
    });
  });

  // ── Rotation ──────────────────────────────────────────────────────────────

  describe("rotate", () => {
    it("issues a replacement and revokes the token that was presented", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      const rotated = await sessions.rotate(issued.refreshToken);

      expect(rotated?.userId).toBe(userId);
      expect(rotated?.refreshToken).not.toBe(issued.refreshToken);

      const old = await prisma.authSession.findUnique({
        where: { tokenHash: digestRefreshToken(issued.refreshToken) },
      });

      expect(old?.revokedAt).not.toBeNull();
    });

    it("leaves exactly one usable session behind", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await sessions.rotate(issued.refreshToken);

      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(1);
      expect(await prisma.authSession.count({ where: { userId } })).toBe(2);
    });

    it("refuses the old token immediately, and accepts the new one", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      const rotated = await sessions.rotate(issued.refreshToken);

      expect(await sessions.rotate(issued.refreshToken)).toBeNull();
      expect(await sessions.rotate(rotated!.refreshToken)).not.toBeNull();
    });

    it("refuses an expired session", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await prisma.authSession.update({
        where: { tokenHash: digestRefreshToken(issued.refreshToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      expect(await sessions.rotate(issued.refreshToken)).toBeNull();
    });

    it("refuses a session revoked by logout", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await sessions.revoke(userId, issued.refreshToken);

      expect(await sessions.rotate(issued.refreshToken)).toBeNull();
    });

    it("refuses a token that matches nothing", async () => {
      expect(await sessions.rotate(generateRefreshToken())).toBeNull();
    });

    it("refuses a malformed token without throwing", async () => {
      expect(await sessions.rotate("")).toBeNull();
      expect(await sessions.rotate("not-a-token")).toBeNull();
      expect(await sessions.rotate("../../etc/passwd")).toBeNull();
    });

    /**
     * The account-status enforcement, at the session layer rather than only at the guard. The row
     * is kept — revocation is a flag, not a delete — but it is revoked, permanently.
     */
    it("refuses a disabled account, and its session is revoked rather than deleted", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await disable(userId);

      expect(await sessions.rotate(issued.refreshToken)).toBeNull();

      const row = await prisma.authSession.findUnique({
        where: { tokenHash: digestRefreshToken(issued.refreshToken) },
      });

      expect(row).not.toBeNull();
      expect(row?.revokedAt).not.toBeNull();
    });

    it("refuses a deleted account — its rows are gone with it", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await prisma.user.delete({ where: { id: userId } });

      expect(await sessions.rotate(issued.refreshToken)).toBeNull();
    });

    /**
     * A rotation that fails must not leave a half-rotated state — no replacement session, and no
     * collateral damage to the account's other sessions.
     *
     * This deliberately does **not** use a disabled account as the failure mode any more. Under
     * ADR-012 §7 disabling permanently revokes the session, so "the presented token still works
     * afterwards" is no longer true there — and asserting that it was is exactly the suspension
     * behaviour the security review rejected. An unknown token is the failure that is still
     * reachable without destroying the credential.
     */
    it("creates nothing and touches nothing when the rotation fails", async () => {
      const userId = await createUser();
      const live = await sessions.issue(userId);

      expect(await sessions.rotate(generateRefreshToken())).toBeNull();

      expect(await prisma.authSession.count({ where: { userId } })).toBe(1);
      expect(await sessions.rotate(live.refreshToken)).not.toBeNull();
    });
  });

  // ── The race ──────────────────────────────────────────────────────────────

  describe("concurrent rotation of one token", () => {
    /**
     * The guarantee this whole design exists for, proven against the database rather than argued.
     *
     * Two rotations are started with the same raw token and neither is awaited before the other
     * begins, so both conditional UPDATEs are in flight at once. PostgreSQL serializes them on the
     * row lock; the loser re-evaluates its WHERE clause against the committed new version, finds
     * `revoked_at` set, and matches nothing.
     *
     * If this ever fails, one stolen token has become two live sessions.
     */
    it("lets exactly one win", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      const [first, second] = await Promise.all([
        sessions.rotate(issued.refreshToken),
        sessions.rotate(issued.refreshToken),
      ]);

      const winners = [first, second].filter((result) => result !== null);

      expect(winners).toHaveLength(1);
      expect([first, second].filter((result) => result === null)).toHaveLength(1);
    });

    it("creates exactly one replacement, and leaves exactly one usable session", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await Promise.all([
        sessions.rotate(issued.refreshToken),
        sessions.rotate(issued.refreshToken),
      ]);

      // Two rows total — the original, now revoked, and one replacement. Not three.
      expect(await prisma.authSession.count({ where: { userId } })).toBe(2);
      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(1);
    });

    it("makes the winner's token the only usable one", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      const results = await Promise.all([
        sessions.rotate(issued.refreshToken),
        sessions.rotate(issued.refreshToken),
      ]);
      const winner = results.find((result) => result !== null);

      expect(await sessions.rotate(issued.refreshToken)).toBeNull();
      expect(await sessions.rotate(winner!.refreshToken)).not.toBeNull();
    });

    it("holds under more than two racers", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      const results = await Promise.all(
        Array.from({ length: 8 }, () => sessions.rotate(issued.refreshToken)),
      );

      expect(results.filter((result) => result !== null)).toHaveLength(1);
      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(1);
    });
  });

  // ── Revocation ────────────────────────────────────────────────────────────

  describe("revoke", () => {
    it("revokes the caller's own session", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      expect(await sessions.revoke(userId, issued.refreshToken)).toBe(1);
      expect(await sessions.rotate(issued.refreshToken)).toBeNull();
    });

    it("is idempotent — a second revoke changes nothing and does not throw", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await sessions.revoke(userId, issued.refreshToken);

      expect(await sessions.revoke(userId, issued.refreshToken)).toBe(0);
    });

    it("reports zero for a token that matches nothing", async () => {
      const userId = await createUser();

      expect(await sessions.revoke(userId, generateRefreshToken())).toBe(0);
    });

    /**
     * The isolation property `userId` is in the WHERE clause for. Without it, anyone holding a
     * valid access token and someone else's refresh token could end that person's session.
     */
    it("cannot revoke another account's session", async () => {
      const victimId = await createUser();
      const attackerId = await createUser();
      const victimSession = await sessions.issue(victimId);

      expect(await sessions.revoke(attackerId, victimSession.refreshToken)).toBe(0);
      // Still usable: the attacker's logout did nothing at all.
      expect(await sessions.rotate(victimSession.refreshToken)).not.toBeNull();
    });

    it("leaves the user's other sessions alone", async () => {
      const userId = await createUser();
      const first = await sessions.issue(userId);
      const second = await sessions.issue(userId);

      await sessions.revoke(userId, first.refreshToken);

      expect(await sessions.rotate(first.refreshToken)).toBeNull();
      expect(await sessions.rotate(second.refreshToken)).not.toBeNull();
    });
  });

  // ── Schema-level guarantees ───────────────────────────────────────────────

  describe("the table's own constraints", () => {
    it("refuses two sessions with the same digest", async () => {
      const userId = await createUser();
      const issued = await sessions.issue(userId);

      await expect(
        prisma.authSession.create({
          data: {
            userId,
            tokenHash: digestRefreshToken(issued.refreshToken),
            expiresAt: new Date(Date.now() + 1000),
          },
        }),
      ).rejects.toThrow();
    });

    it("takes a user's sessions with them when the user is deleted", async () => {
      const userId = await createUser();
      await sessions.issue(userId);
      await sessions.issue(userId);

      await prisma.user.delete({ where: { id: userId } });

      expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
    });

    it("defaults a new user to active without being told to", async () => {
      const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@example.test`;

      // A raw INSERT that names no status — the case the column default exists for.
      await prisma.$executeRaw`
        INSERT INTO users (id, email, password_hash, role)
        VALUES (gen_random_uuid(), ${email}, ${UNUSABLE_PASSWORD_HASH}, 'admin')
      `;

      const user = await prisma.user.findUnique({ where: { email }, select: { status: true } });

      expect(user?.status).toBe(UserStatus.ACTIVE);
    });

    it("creates a user with no credential cutoff", async () => {
      const userId = await createUser();

      expect((await readUser(userId)).credentialsRevokedAt).toBeNull();
    });

    /**
     * The bootstrap script's idempotence, asserted at the level that matters here: a rerun reads
     * the existing row and returns, so nothing about a disabled admin changes. Modelled as the
     * script's own two steps — the uniqueness lookup, then the early return — because importing the
     * script would run its opt-in guards and its database check.
     */
    it("leaves a disabled admin's status, password and cutoff untouched on a bootstrap rerun", async () => {
      const userId = await createUser();
      await disable(userId);

      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, status: true, passwordHash: true, credentialsRevokedAt: true },
      });

      // What seed-admin.ts does on a rerun: find by email, discover a row, change nothing.
      const existing = await prisma.user.findUnique({
        where: { email: before.email },
        select: { id: true },
      });

      expect(existing).not.toBeNull();

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, status: true, passwordHash: true, credentialsRevokedAt: true },
      });

      expect(after).toEqual(before);
      expect(after.status).toBe(UserStatus.DISABLED);
    });
  });

  // ── Permanent credential revocation (ADR-012 §7) ──────────────────────────

  /**
   * The correction this section exists for: **disable is revocation, not suspension.**
   *
   * The first implementation of account status made `disabled` a gate that every path re-checked,
   * which meant re-enabling the account brought every credential minted before the disable back to
   * life — an unexpired access token and a 7-day refresh session alike. These tests assert the
   * replacement: a disable draws a line, and nothing issued at or before that line ever works
   * again, no matter what happens to the account afterwards.
   */
  describe("disabling revokes credentials permanently", () => {
    it("revokes every live session the moment the account is disabled", async () => {
      const userId = await createUser();
      const first = await sessions.issue(userId);
      const second = await sessions.issue(userId);

      await disable(userId);

      expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(0);
      expect(await sessions.rotate(first.refreshToken)).toBeNull();
      expect(await sessions.rotate(second.refreshToken)).toBeNull();
    });

    it("stamps a credential cutoff that was NULL before", async () => {
      const userId = await createUser();

      expect((await readUser(userId)).credentialsRevokedAt).toBeNull();

      await disable(userId);

      expect((await readUser(userId)).credentialsRevokedAt).not.toBeNull();
    });

    /**
     * The heart of it. Re-enabling restores the ability to authenticate — it restores nothing that
     * was already issued.
     */
    it("keeps pre-disable refresh tokens dead after the account is re-enabled", async () => {
      const userId = await createUser();
      const before = await sessions.issue(userId);

      await disable(userId);
      await enable(userId);

      expect(await sessions.rotate(before.refreshToken)).toBeNull();
      // ...while the account itself works again, and a new session rotates normally.
      const after = await sessions.issue(userId);
      expect(await sessions.rotate(after.refreshToken)).not.toBeNull();
    });

    it("keeps pre-disable access tokens dead after the account is re-enabled", async () => {
      const userId = await createUser();
      const issuedAt = nowSeconds();

      // Valid before the disable.
      expect(await users.findActiveByToken(userId, issuedAt)).not.toBeNull();

      await disable(userId);
      await enable(userId);

      // Still refused, even though the account is active again and `exp` has not passed.
      expect(await users.findActiveByToken(userId, issuedAt)).toBeNull();
      // A token minted after the cutoff is honoured, which is what proves the account itself is
      // usable and the refusal above is about the credential rather than the user.
      expect(
        await users.findActiveByToken(userId, (await cutoffSeconds(userId)) + 1),
      ).not.toBeNull();
    });

    it("does not clear or lower the cutoff when the account is re-enabled", async () => {
      const userId = await createUser();

      await disable(userId);
      const afterDisable = (await readUser(userId)).credentialsRevokedAt;

      await enable(userId);

      expect((await readUser(userId)).credentialsRevokedAt).toEqual(afterDisable);
    });

    /**
     * The monotonicity guard, tested against the database directly because that is the only place
     * it lives — there is no status-management endpoint, so a hand-written UPDATE is exactly the
     * shape of the attack this refuses.
     */
    it("refuses an UPDATE that clears the cutoff", async () => {
      const userId = await createUser();
      await disable(userId);

      await expect(
        prisma.$executeRaw`UPDATE users SET credentials_revoked_at = NULL WHERE id = ${userId}::uuid`,
      ).rejects.toThrow();
    });

    it("refuses an UPDATE that moves the cutoff backwards", async () => {
      const userId = await createUser();
      await disable(userId);

      await expect(
        prisma.$executeRaw`UPDATE users SET credentials_revoked_at = TIMESTAMPTZ '2000-01-01' WHERE id = ${userId}::uuid`,
      ).rejects.toThrow();
    });

    it("is idempotent — disabling an already-disabled account moves nothing", async () => {
      const userId = await createUser();
      await disable(userId);
      const first = (await readUser(userId)).credentialsRevokedAt;

      await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.DISABLED } });

      expect((await readUser(userId)).credentialsRevokedAt).toEqual(first);
    });

    it("advances the cutoff on a second, later disable", async () => {
      const userId = await createUser();
      await disable(userId);
      const first = (await readUser(userId)).credentialsRevokedAt;

      await enable(userId);
      await disable(userId);

      // Strictly later: the trigger stamps `clock_timestamp()`, not the transaction's start time,
      // so two disables in two statements cannot collide on one value.
      expect((await readUser(userId)).credentialsRevokedAt?.getTime()).toBeGreaterThan(
        first!.getTime(),
      );
    });

    it("does not touch another account's sessions or cutoff", async () => {
      const victimId = await createUser();
      const bystanderId = await createUser();
      const bystanderSession = await sessions.issue(bystanderId);
      await sessions.issue(victimId);

      await disable(victimId);

      expect((await readUser(bystanderId)).credentialsRevokedAt).toBeNull();
      expect(
        await prisma.authSession.count({ where: { userId: bystanderId, revokedAt: null } }),
      ).toBe(1);
      expect(await sessions.rotate(bystanderSession.refreshToken)).not.toBeNull();
    });

    /**
     * The same-second case, made deterministic instead of slept on.
     *
     * The cutoff is written by the database with microsecond precision; a JWT `iat` is whole
     * seconds. This drives the exact boundary by computing the `iat` values around a real cutoff
     * rather than by waiting for a clock to tick, so it proves the rule at its edge and cannot
     * flake:
     *
     *   - `iat` in the SAME second as the cutoff → rejected (rounding never favours the token)
     *   - `iat` one second before        → rejected
     *   - `iat` one second after         → accepted
     */
    it("resolves the same-second boundary against the token, deterministically", async () => {
      const userId = await createUser();
      await disable(userId);
      await enable(userId);

      const cutoff = (await readUser(userId)).credentialsRevokedAt!;
      const cutoffSecond = Math.floor(cutoff.getTime() / 1000);

      expect(await users.findActiveByToken(userId, cutoffSecond - 1)).toBeNull();
      expect(await users.findActiveByToken(userId, cutoffSecond)).toBeNull();
      expect(await users.findActiveByToken(userId, cutoffSecond + 1)).not.toBeNull();
    });

    /**
     * A cutoff that landed exactly on a second boundary is the one case where "at or before" could
     * be read either way. It is forced here rather than waited for, and the conservative reading —
     * reject — is the asserted one.
     */
    it("rejects a token whose iat lands exactly on a whole-second cutoff", async () => {
      const userId = await createUser();
      await disable(userId);
      // Re-enabled, or the status check alone would satisfy both assertions below and the cutoff
      // comparison — the thing actually under test — would never be reached.
      await enable(userId);

      // A whole second, written directly: clock_timestamp() will essentially never produce one, so
      // the case has to be constructed to be tested at all. Moving the cutoff FORWARD is allowed by
      // the monotonicity guard, which is why this UPDATE succeeds where the two above are refused.
      const whole = new Date(Math.ceil(Date.now() / 1000) * 1000 + 60_000);
      await prisma.user.update({
        where: { id: userId },
        data: { credentialsRevokedAt: whole },
      });

      const second = whole.getTime() / 1000;

      expect(await users.findActiveByToken(userId, second)).toBeNull();
      expect(await users.findActiveByToken(userId, second + 1)).not.toBeNull();
    });

    it("leaves an account that was never disabled with no cutoff at all", async () => {
      const userId = await createUser();

      expect((await readUser(userId)).credentialsRevokedAt).toBeNull();
      // Any iat is honoured, including one from the distant past — the boundary does not exist for
      // this account, so there is nothing for a token to be measured against.
      expect(await users.findActiveByToken(userId, 1)).not.toBeNull();
    });

    it("still refuses a disabled account outright, cutoff or not", async () => {
      const userId = await createUser();
      await disable(userId);

      expect(await users.findActiveByToken(userId, nowSeconds() + 3600)).toBeNull();
    });
  });
});
