/**
 * The `POST /auth/login` success body — API_CONTRACT_FINAL.md §2.2, "access token (body)".
 *
 * ── What is on the wire, and what is deliberately not ───────────────────────
 *
 * `passwordHash` is not here, and neither is `organizationId` or `createdAt`. The response carries
 * the token, how long it is good for, and the three facts the Admin surface needs in order to
 * decide what to render — `id`, `email`, `role`. Nothing else about a user is a login concern.
 *
 * ── The refresh token is absent, and that is a reported gap, not an omission ─
 *
 * §2.2 also contracts a refresh token in an httpOnly cookie, with `POST /auth/refresh` and
 * `POST /auth/logout` ("invalidate refresh token"). Invalidation requires server-side state that
 * no table in `sam_platform` provides — DATA_MODEL.md models no refresh-token or session entity —
 * so implementing it means a schema decision that this gate does not take. No cookie is set, and
 * no `refreshToken` field is served: a client that received one would have nothing to redeem it
 * at. The consequence is stated plainly in the gate report: a session ends after 15 minutes and
 * the user logs in again.
 */
export type LoginResponse = {
  accessToken: string;
  /** Always `"Bearer"`. Named so a client never has to hard-code the scheme it prefixes. */
  tokenType: "Bearer";
  /** Seconds, not a timestamp — the client needs a duration, and clocks disagree. */
  expiresIn: number;
  user: AuthenticatedUserResponse;
};

/**
 * The authenticated caller as `POST /auth/login` and `GET /auth/me` both serve them.
 *
 * `role` is the physical enum label (`admin`, `content_manager`, `sales_expert`, `customer`) —
 * see `user-role.ts`.
 */
export type AuthenticatedUserResponse = {
  id: string;
  email: string;
  role: string;
};
