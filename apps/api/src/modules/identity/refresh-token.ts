import { createHash, randomBytes } from "node:crypto";

import { REFRESH_TOKEN_BYTES } from "./session.config";

/**
 * Refresh-token minting and digesting — ADR-012.
 *
 * ── Opaque, not a JWT ───────────────────────────────────────────────────────
 *
 * A JWT refresh token validates itself from its own signature, which is precisely the property
 * that makes it hard to revoke: the server would have to keep a list of the ones it no longer
 * honours, which is the table this module already has, minus the benefit. An opaque random string
 * has no meaning except the row it matches, so revocation is `UPDATE ... SET revoked_at` and there
 * is nothing else to reason about. No document froze the format; ADR-012 chose it.
 *
 * ── SHA-256, and deliberately NOT argon2id ─────────────────────────────────
 *
 * argon2id is the platform's password hash and stays that way — but it is a *password* hash, and
 * its cost exists to make guessing a human-chosen secret expensive. This token is 256 bits from a
 * CSPRNG: there is no dictionary, no reuse across sites, and no offline attack that a work factor
 * would slow down enough to matter, because the search space is already beyond reach. What the
 * lookup does need is to be deterministic — the digest is the unique index the query matches on,
 * and argon2's per-hash random salt makes that impossible without scanning every row and verifying
 * each one. So: fast, deterministic, one-way. SHA-256 from `node:crypto`, no dependency added.
 */

/** A new raw refresh token. Returned to the caller once and never stored in this form. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/**
 * The digest a session row is found by: SHA-256 over the token's UTF-8 bytes, lowercase hex.
 *
 * Encoding is fixed here rather than left to a call site, because the digest is a database key —
 * two spellings of the same hash would be two different keys, and the second one would never match
 * anything. Total: any string in, 64 hex characters out.
 */
export function digestRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
