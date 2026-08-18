import * as argon2 from "argon2";

import { ARGON2_OPTIONS, PasswordService } from "./password.service";

/**
 * Password hashing, against the real library. Nothing here is mocked: the point of these tests is
 * that a hash written by this service is genuinely an argon2id hash with the frozen parameters,
 * which a stub could not demonstrate.
 *
 * Every argon2 call costs ~50 ms by design, so the timeouts are raised rather than the cost
 * lowered — lowering it for tests would mean testing a configuration that never runs.
 */

const passwords = new PasswordService();
const PASSWORD = "correct horse battery staple";

describe("PasswordService", () => {
  it("hashes with argon2id, not argon2i or argon2d", async () => {
    expect(ARGON2_OPTIONS.type).toBe(argon2.argon2id);

    const hash = await passwords.hash(PASSWORD);

    // The algorithm is encoded in the hash string itself, so this reads what was actually used
    // rather than what was configured.
    expect(hash.startsWith("$argon2id$")).toBe(true);
  }, 30_000);

  it("encodes the frozen cost parameters into the hash", async () => {
    const hash = await passwords.hash(PASSWORD);

    expect(hash).toContain(`m=${String(ARGON2_OPTIONS.memoryCost)}`);
    expect(hash).toContain(`t=${String(ARGON2_OPTIONS.timeCost)}`);
    expect(hash).toContain(`p=${String(ARGON2_OPTIONS.parallelism)}`);
  }, 30_000);

  it("never stores the plaintext in the hash", async () => {
    const hash = await passwords.hash(PASSWORD);

    expect(hash).not.toContain(PASSWORD);
    expect(hash).not.toContain("correct");
  }, 30_000);

  it("produces a different hash each time, so the salt is per-hash", async () => {
    const [first, second] = await Promise.all([passwords.hash(PASSWORD), passwords.hash(PASSWORD)]);

    expect(first).not.toBe(second);
    // Both still verify — the difference is the salt, not the password.
    await expect(passwords.verify(first, PASSWORD)).resolves.toBe(true);
    await expect(passwords.verify(second, PASSWORD)).resolves.toBe(true);
  }, 30_000);

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await passwords.hash(PASSWORD);

    await expect(passwords.verify(hash, PASSWORD)).resolves.toBe(true);
    await expect(passwords.verify(hash, "wrong")).resolves.toBe(false);
    await expect(passwords.verify(hash, "")).resolves.toBe(false);
    await expect(passwords.verify(hash, `${PASSWORD} `)).resolves.toBe(false);
  }, 30_000);

  /**
   * A stored value argon2 cannot parse must fail authentication rather than throw. A 500 here would
   * be an oracle: it would tell the caller their email exists but its hash is malformed.
   */
  it("returns false, never throws, for a stored value that is not an argon2 hash", async () => {
    for (const malformed of [
      "",
      "not-a-hash",
      "$2b$10$abcdefghijklmnopqrstuv",
      "$argon2id$broken",
    ]) {
      await expect(passwords.verify(malformed, PASSWORD)).resolves.toBe(false);
    }
  }, 30_000);
});
