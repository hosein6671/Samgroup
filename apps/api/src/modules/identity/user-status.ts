import { UserStatus } from "../../prisma/generated/client";

/**
 * The account-status vocabulary, as it appears on the wire — ADR-012.
 *
 * ── Two values, and only two ────────────────────────────────────────────────
 *
 * `active` and `disabled`. `suspended`, `locked`, `pending` and a `deleted` soft-delete state are
 * **not** members and were not added: nothing on this platform distinguishes them, and an enum
 * label with no behaviour behind it is a lifecycle nobody implemented — the next person reads it
 * as a promise. Deleting a `User` row remains a real delete, and remains the strongest revocation.
 *
 * ── These are the physical enum labels, not the TypeScript member names ─────
 *
 * Same convention `user-role.ts` follows and for the same reason: `schema.prisma` maps each member
 * to a lowercase label (`ACTIVE @map("active")`), the generated client's constant carries the
 * member name, and the wire vocabulary is the label. A display form ("Disabled") belongs to a
 * translation catalog.
 *
 * ── Where this appears, and where it deliberately does not ──────────────────
 *
 * `GET /admin/users` only. It is **not** in the access token (the token still carries `sub` and
 * nothing else), not in `POST /auth/login`'s body and not in `GET /auth/me` — those answer only
 * for an active account, so the field could carry exactly one value. No endpoint writes it.
 */
export const USER_STATUS_WIRE_VALUE: Readonly<Record<UserStatus, string>> = {
  [UserStatus.ACTIVE]: "active",
  [UserStatus.DISABLED]: "disabled",
};

/** The wire form of one status. Total over `UserStatus`, so a new member is a compile error. */
export function toWireStatus(status: UserStatus): string {
  return USER_STATUS_WIRE_VALUE[status];
}
