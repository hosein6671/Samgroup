import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * The `POST /auth/refresh` body — ADR-012.
 *
 * ── Why the token is in the body and not in a `Cookie` header ───────────────
 *
 * API_CONTRACT_FINAL.md §2.2 marks this endpoint's auth as "Cookie", which describes the
 * **browser-visible** end of the architecture: the refresh token lives in an HttpOnly cookie. That
 * cookie is `apps/web`'s, not this API's. §1 of the same document is explicit that **no
 * browser-originated call ever reaches NestJS** — every request arrives server-side from Next.js,
 * which is why `main.ts` runs with CORS off — so the `Cookie` header a browser would send never
 * gets here. `apps/web` reads its own cookie server-side and forwards the value in this field.
 *
 * The practical consequence: this API parses no cookies, sets none, and clears none. ADR-012
 * records the boundary; the frontend session gate implements the cookie half.
 *
 * ── No access token is required, deliberately ───────────────────────────────
 *
 * The whole purpose of this endpoint is to be reachable when the access token has expired. The
 * refresh token **is** the authentication factor here, which is why it is a 256-bit random secret
 * rather than an identifier.
 */
export class RefreshDto {
  /**
   * The raw refresh token, exactly as it was issued.
   *
   * Capped at 256 characters — the issued form is 43 — so an unauthenticated caller cannot make
   * the process digest a megabyte per request. No format validation beyond that: a token that is
   * the wrong shape simply matches no row, and a stricter rule here would only tell an attacker
   * which of their guesses were not worth sending.
   *
   * **Never trimmed.** Every character is credential material; silently altering one would produce
   * an authentication failure nobody could explain, the same reasoning `LoginDto.password` gives.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken!: string;
}
