/**
 * The `POST /auth/login` success body — API_CONTRACT_FINAL.md §2.2, "access token (body)".
 *
 * ── What is on the wire, and what is deliberately not ───────────────────────
 *
 * `passwordHash` is not here, and neither is `organizationId`, `createdAt` or `status`. The
 * response carries the tokens, how long the access token is good for, and the three facts the
 * Admin surface needs in order to decide what to render — `id`, `email`, `role`. Nothing else
 * about a user is a login concern. No session id and no token digest appear either: `auth_sessions`
 * is server-side state and nothing about its rows is a client's business.
 *
 * ── `refreshToken` is a BFF-facing credential, not a browser-facing one ─────
 *
 * It is here because §1 of the same document is explicit that **no browser-originated call ever
 * reaches NestJS**: this body is read by `apps/web` server-side, never by a browser. `apps/web`
 * then puts the value into its own HttpOnly cookie, which is what §2.2's "refresh token (httpOnly
 * cookie)" describes — that cookie is the frontend tier's, and this API neither sets, reads nor
 * clears it (ADR-012).
 *
 * **Serving this field is not permission to expose it to browser JavaScript.** Returning it in a
 * Server Component's props, a client payload, or `localStorage` would undo the entire reason the
 * cookie is HttpOnly.
 */
export type LoginResponse = {
  accessToken: string;
  /** Always `"Bearer"`. Named so a client never has to hard-code the scheme it prefixes. */
  tokenType: "Bearer";
  /** Seconds, not a timestamp — the client needs a duration, and clocks disagree. */
  expiresIn: number;
  /** Raw, opaque, 7-day. See the note above before putting it anywhere. */
  refreshToken: string;
  /** Seconds until `refreshToken` expires, in the same units and for the same reason. */
  refreshExpiresIn: number;
  user: AuthenticatedUserResponse;
};

/**
 * The `POST /auth/refresh` success body.
 *
 * Deliberately the login response minus `user`: refresh proves possession of a session, not of a
 * password, and re-serving identity from it would invite a caller to treat it as an identity
 * endpoint. `GET /auth/me` is that endpoint, and it re-reads the live row. Nothing about the
 * session — its id, its digest, its expiry row, whether the presented token had been rotated
 * before — reaches the wire.
 */
export type RefreshResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  /** The replacement. The token that was presented is revoked by the time this is serialized. */
  refreshToken: string;
  refreshExpiresIn: number;
};

/**
 * The authenticated caller as `POST /auth/login` and `GET /auth/me` both serve them.
 *
 * `role` is the physical enum label (`admin`, `content_manager`, `sales_expert`, `customer`) —
 * see `user-role.ts`. `status` is absent: both endpoints answer only for an account that is
 * `active`, so the field could carry exactly one value and would say nothing.
 */
export type AuthenticatedUserResponse = {
  id: string;
  email: string;
  role: string;
};

/**
 * One row of `GET /admin/users`, which is the one place `status` is served.
 *
 * An Admin listing staff accounts has to be able to see which of them are switched off; every
 * other identity response answers only for active accounts and would carry a constant.
 */
export type AdminUserResponse = AuthenticatedUserResponse & {
  /** The physical enum label — `active` or `disabled`. See `user-status.ts`. */
  status: string;
};
