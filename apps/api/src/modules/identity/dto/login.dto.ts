import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

import { Trim } from "../../../common/validation/trim.transform";

/**
 * The `POST /auth/login` body — API_CONTRACT_FINAL.md §2.2, "Email + password".
 *
 * ── Two properties, and nothing else is accepted ────────────────────────────
 *
 * The global pipe runs with `whitelist` + `forbidNonWhitelisted` (main.ts), so any other property
 * answers **400 VALIDATION_ERROR naming it** rather than being silently stripped. That is what
 * makes `role` un-supplyable: a client sending `{"email":…,"password":…,"role":"admin"}` is
 * rejected at the boundary and never reaches a code path that could read it. The role is not
 * "ignored" here — there is no field for it, and the pipe treats its presence as an error.
 *
 * ── Length caps ─────────────────────────────────────────────────────────────
 *
 * Both are capped so an unauthenticated caller cannot make the process hash a megabyte. argon2's
 * cost is dominated by its memory parameter rather than by input length, but the cap costs nothing
 * and removes the question. 254 is the maximum length of an email address per RFC 5321; the
 * password cap is generous enough that no real passphrase meets it.
 */
export class LoginDto {
  /**
   * Trimmed before validation, matching every other DTO in the application: a leading space
   * pasted with an address is a typo, not a different account.
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  @IsEmail()
  email!: string;

  /**
   * **Never trimmed, and never transformed.** A password may legitimately begin or end with a
   * space, and silently altering a credential produces an authentication failure nobody can
   * explain — the same reasoning `configuration.ts` applies to `SMTP_PASSWORD`.
   *
   * No minimum length, no complexity rule, and no format check. A rule here would only tell an
   * attacker which guesses are not worth making, and it cannot strengthen a password that is
   * already stored.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
