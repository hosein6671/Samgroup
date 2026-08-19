import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * The `POST /auth/logout` body — ADR-012.
 *
 * ── Two credentials, and both are needed ────────────────────────────────────
 *
 * API_CONTRACT_FINAL.md §2.2 marks logout **A** (authenticated), so the access token says *who is
 * asking*. The refresh token says *which session to end* — the API cannot infer it, because a user
 * may legitimately hold several (a second browser, a second machine), and ending all of them
 * because one signed out is a "log out everywhere" behaviour that nothing in this platform
 * contracts.
 *
 * The pair is also what makes the revocation safe: `AuthSessionsService.revoke` scopes its WHERE
 * clause to the authenticated `userId`, so presenting someone else's refresh token revokes
 * nothing. Without the access token there would be no id to scope to.
 *
 * As with refresh, this value arrives in the body because `apps/web` reads its own HttpOnly cookie
 * server-side and forwards it — NestJS receives no browser `Cookie` header and clears no cookie.
 * Clearing the browser's copy is `apps/web`'s half of logout, in the frontend session gate.
 */
export class LogoutDto {
  /**
   * The raw refresh token whose session should end.
   *
   * Required. A logout that carried no session to revoke would answer success while leaving the
   * refresh token live, which is the one outcome this endpoint exists to prevent — and a caller
   * that has genuinely lost the token has nothing for this endpoint to do anyway.
   *
   * A token that is unknown, already revoked, or another account's is **not** an error: see the
   * controller's idempotency note.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken!: string;
}
