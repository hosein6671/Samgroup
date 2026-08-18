import { UserRole } from "../../prisma/generated/client";

/**
 * The role vocabulary, as it appears on the wire.
 *
 * ── Frozen, not chosen here ─────────────────────────────────────────────────
 *
 * Four roles, and only four: SECURITY.md's RBAC matrix has exactly four rows — Admin, Content
 * Manager, Sales Expert, Customer — and `schema.prisma`'s `UserRole` enum has exactly the same four
 * members. Neither is extended here. `superadmin`, `editor`, `manager` and `sales` are not roles on
 * this platform, and inventing one would put a value in a PostgreSQL enum column that the type does
 * not accept.
 *
 * ── These are the physical enum labels, not the TypeScript member names ─────
 *
 * `schema.prisma` maps each member to a lowercase label (`ADMIN @map("admin")`), and the generated
 * client's constant carries the *member name* (`UserRole.ADMIN === "ADMIN"`) rather than that label.
 * The wire vocabulary is the label, following the precedent `create-inquiry.dto.ts` sets for
 * `inquiryType` and `GET /locales` sets for `ltr`/`rtl` — the same reasoning applies unchanged: a
 * display form belongs to a translation catalog, and the physical label is the stable transport
 * value.
 *
 * ── Payload's roles are a different vocabulary ──────────────────────────────
 *
 * `apps/cms` has its own `admin`/`content-manager`/`service` roles in `sam_cms` (ADR-006). They are
 * spelled similarly and they are unrelated: no value here is derived from, compared with, or
 * synchronised against one of Payload's. This file describes platform identity only.
 */
export const USER_ROLE_WIRE_VALUE: Readonly<Record<UserRole, string>> = {
  [UserRole.ADMIN]: "admin",
  [UserRole.CONTENT_MANAGER]: "content_manager",
  [UserRole.SALES_EXPERT]: "sales_expert",
  [UserRole.CUSTOMER]: "customer",
};

/** The wire form of one role. Total over `UserRole`, so a new enum member is a compile error. */
export function toWireRole(role: UserRole): string {
  return USER_ROLE_WIRE_VALUE[role];
}
