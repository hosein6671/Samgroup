/**
 * The access token's parameters — SECURITY.md §Authentication and API_CONTRACT_FINAL.md §7.
 *
 * ── Why the lifetime is a constant and not an environment variable ──────────
 *
 * Both documents state 15 minutes. That is a frozen decision, and `apps/cms/src/localization.ts`
 * already set the precedent for what to do with one: the locale list lived in an environment
 * variable for a single revision and was removed, because "an environment variable that can
 * override an already-frozen decision means it is not frozen". The same reasoning applies here —
 * a deployment that could quietly raise this to 24 hours would make the documented lifetime a
 * suggestion. Changing it is a documentation change first.
 *
 * The signing **secret** is the opposite case and is deployment-scoped: it is a per-environment
 * credential, read from `JWT_SECRET`, and never appears in this repository.
 */

/** 15 minutes, in seconds — the unit `expiresIn` and the login response's `expiresIn` both use. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Pinned on signing **and** on verification.
 *
 * Pinning the verifier is the half that matters: `jsonwebtoken` will otherwise accept whatever
 * algorithm the token's own header names, which is how a token signed with `alg: none`, or one
 * signed with the public half of an RSA pair treated as an HMAC key, gets accepted as valid. The
 * verifier must decide the algorithm, never the token.
 */
export const JWT_ALGORITHM = "HS256";

/**
 * The minimum secret length accepted at startup.
 *
 * 32 characters, which is the HMAC-SHA256 block-equivalent output size — below it the secret is
 * the weakest part of the construction. It is a floor on length only: this application cannot
 * measure entropy, and a 32-character secret that someone typed by hand is not a good one. Generate
 * it, do not compose it.
 */
export const JWT_SECRET_MIN_LENGTH = 32;

/**
 * ── What is deliberately NOT set: `iss` and `aud` ───────────────────────────
 *
 * No document in this repository freezes an issuer or an audience value, and both are only useful
 * when a verifier must distinguish tokens from several issuers or intended for several services.
 * This platform has exactly one issuer (NestJS, per ADR-003) and exactly one verifier (the same
 * process). Inventing string values for them here would be inventing contract, and a future real
 * multi-audience requirement would not be able to adopt the guess without a breaking change.
 *
 * ── What is deliberately NOT in the token: everything except `sub` ──────────
 *
 * See `JwtAuthGuard` for why the role is resolved from `sam_platform` on every request rather than
 * read from a claim.
 */
export type AccessTokenClaims = {
  /** The `User.id` this token authenticates. The only claim this application sets itself. */
  sub: string;
  /** Set by the signer from `expiresIn`, not by this application. */
  iat: number;
  exp: number;
};
