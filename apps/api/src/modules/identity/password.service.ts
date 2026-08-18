import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

/**
 * The one place a password is hashed or verified — ADR-004 and SECURITY.md §Authentication both
 * freeze **argon2id**, chosen over bcrypt for resistance to GPU/ASIC cracking.
 *
 * Everything that needs a password hash goes through this service: the login path, and the
 * bootstrap script (`prisma/seed-admin.ts`), which imports these same parameters rather than
 * calling argon2 with its own. Two call sites hashing with different parameters would produce
 * rows that verify but cost different amounts to attack, and nothing would report it.
 *
 * ── Payload is not in scope ─────────────────────────────────────────────────
 *
 * ADR-006 keeps Payload's admin accounts in `sam_cms` with Payload's own native hashing, and
 * AI_CONTEXT.md records the consequence explicitly: "argon2id (ADR-004) applies to platform
 * identity only". No hash written by this service is ever read by Payload, and none of Payload's
 * is ever read here.
 *
 * ── Nothing here is logged ──────────────────────────────────────────────────
 *
 * No method takes a logger, and no branch prints. A password never reaches stdout, an error
 * message, or a thrown value — SECURITY.md, "never stored or logged in plain text".
 */

/**
 * The cost parameters, pinned rather than left to the library's defaults.
 *
 * These are OWASP's second recommended argon2id configuration (m=64 MiB, t=3, p=4) and they also
 * happen to be `argon2@0.44`'s current defaults — pinned anyway, because a hash's cost must not
 * change silently when the dependency is upgraded. Existing hashes stay verifiable regardless:
 * argon2 encodes its parameters into the hash string, so `verify` reads them from the stored value
 * and does not consult these.
 *
 * `type` is the decision ADR-004 actually froze. argon2's own default is argon2id too, and it is
 * stated explicitly here so the frozen choice is visible in the code rather than inherited.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

@Injectable()
export class PasswordService {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  /**
   * Verifies a candidate against a stored hash.
   *
   * Returns `false` rather than throwing when the stored value is not a hash argon2 recognises —
   * a truncated column, a bcrypt hash from some earlier system, an empty string. A malformed hash
   * must fail authentication, not produce a 500 that tells the caller their email exists.
   */
  async verify(storedHash: string, candidate: string): Promise<boolean> {
    try {
      return await argon2.verify(storedHash, candidate);
    } catch {
      return false;
    }
  }
}
