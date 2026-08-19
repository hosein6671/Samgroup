/**
 * The refresh session's parameters — SECURITY.md §Authentication and ADR-012.
 *
 * ── Why the TTL is a constant, exactly like the access token's ──────────────
 *
 * SECURITY.md and API_CONTRACT_FINAL.md §7 both say seven days. `jwt.config.ts` already made the
 * argument for what to do with a number two frozen documents agree on, and it applies unchanged
 * here: an environment variable able to stretch this to ninety days would mean the documented
 * lifetime is a suggestion. Changing it is a documentation change first.
 */

/** Seven days, in seconds. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * 32 bytes — 256 bits — of `randomBytes`, base64url-encoded.
 *
 * The size is chosen against the threat, not by taste: this value is a bearer credential that is
 * checked by an equality lookup, so its only defence is that nobody can produce one. 256 bits is
 * not guessable by any amount of offline work, which is also why it does not need argon2 —
 * see `refresh-token.ts`.
 */
export const REFRESH_TOKEN_BYTES = 32;

/**
 * The base64url length 32 bytes always produces: `ceil(32 / 3) * 4` is 44 with padding, and
 * base64url drops the single `=` — so 43 characters, every time, with no `+`, `/` or `=` in them.
 *
 * Asserted by test rather than trusted, because the encoding is what makes the token safe to put
 * in a cookie and in a JSON body without escaping.
 */
export const REFRESH_TOKEN_ENCODED_LENGTH = 43;

/** SHA-256 as lowercase hex is always 64 characters. Also asserted by test. */
export const REFRESH_TOKEN_DIGEST_LENGTH = 64;
