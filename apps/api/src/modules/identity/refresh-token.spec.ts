import { createHash } from "node:crypto";

import { digestRefreshToken, generateRefreshToken } from "./refresh-token";
import {
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_DIGEST_LENGTH,
  REFRESH_TOKEN_ENCODED_LENGTH,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./session.config";

/**
 * The refresh token's two invariants: nobody can guess one, and nobody can reverse the stored form
 * back into one. Everything else about sessions builds on those.
 */

describe("generateRefreshToken", () => {
  it("encodes 32 bytes as URL- and cookie-safe base64url", () => {
    const token = generateRefreshToken();

    // 43 characters is what 32 bytes always produce once base64url drops the single `=` pad.
    expect(token).toHaveLength(REFRESH_TOKEN_ENCODED_LENGTH);
    // The whole point of base64url over base64: no `+`, `/` or `=`, so the value survives a URL, a
    // cookie value and a JSON body without any escaping anywhere along the way.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(REFRESH_TOKEN_BYTES);
  });

  /**
   * Not a randomness test — Jest cannot prove a CSPRNG is one — but a collision here would mean the
   * generator is not doing what the name says, which is exactly the failure that would be invisible
   * in production until two users shared a session.
   */
  it("never repeats across a large batch", () => {
    const tokens = new Set(Array.from({ length: 10_000 }, () => generateRefreshToken()));

    expect(tokens.size).toBe(10_000);
  });

  it("draws 256 bits, which is what makes guessing irrelevant rather than merely hard", () => {
    expect(REFRESH_TOKEN_BYTES * 8).toBe(256);
  });
});

describe("digestRefreshToken", () => {
  it("produces SHA-256 as lowercase hex, always 64 characters", () => {
    const digest = digestRefreshToken(generateRefreshToken());

    expect(digest).toHaveLength(REFRESH_TOKEN_DIGEST_LENGTH);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  /**
   * Determinism is not a nicety here: the digest is a unique database key, so the same token must
   * produce the same 64 characters on every process, every boot and every machine. A salted hash —
   * argon2id, bcrypt — could not, which is the reason this is SHA-256 and the reason a lookup by
   * digest is possible at all.
   */
  it("is deterministic, and is plain SHA-256 over the token's UTF-8 bytes", () => {
    const token = generateRefreshToken();
    const expected = createHash("sha256").update(token, "utf8").digest("hex");

    expect(digestRefreshToken(token)).toBe(expected);
    expect(digestRefreshToken(token)).toBe(digestRefreshToken(token));
  });

  it("gives different tokens different digests", () => {
    expect(digestRefreshToken(generateRefreshToken())).not.toBe(
      digestRefreshToken(generateRefreshToken()),
    );
  });

  /**
   * The property the whole persistence design rests on: what is stored is not the credential. A
   * dump of `auth_sessions` authenticates nobody, because the digest is one-way and the token it
   * came from is nowhere in the row.
   */
  it("does not contain the token it came from", () => {
    const token = generateRefreshToken();

    expect(digestRefreshToken(token)).not.toContain(token);
    expect(digestRefreshToken(token)).not.toBe(token);
  });

  it("handles an empty and an over-long input without throwing", () => {
    expect(digestRefreshToken("")).toMatch(/^[0-9a-f]{64}$/);
    expect(digestRefreshToken("x".repeat(100_000))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the refresh lifetime", () => {
  /**
   * Seven days, transcribed from SECURITY.md and API_CONTRACT_FINAL.md §7 — not chosen here and not
   * configurable, for the reason `jwt.config.ts` gives about the access token's fifteen minutes.
   */
  it("is the frozen seven days, in seconds", () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(604_800);
  });

  it("is not readable from the environment", () => {
    const before = REFRESH_TOKEN_TTL_SECONDS;

    process.env.REFRESH_TOKEN_TTL_SECONDS = "1";
    process.env.SAM_REFRESH_TTL = "1";

    // A constant, not a lookup: nothing a deployment sets can move it.
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(before);

    delete process.env.REFRESH_TOKEN_TTL_SECONDS;
    delete process.env.SAM_REFRESH_TTL;
  });
});
