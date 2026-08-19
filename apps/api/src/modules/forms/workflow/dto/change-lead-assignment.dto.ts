import { IsUUID, ValidateIf } from "class-validator";

/**
 * `PATCH /admin/{leads}/:id/assignment`.
 *
 * ── Both fields are nullable, and `null` is a value rather than an omission ──
 *
 * `assigneeId: null` means **clear the assignment**; `fromAssigneeId: null` asserts the lead is
 * currently unassigned. `@ValidateIf` is what allows an explicit `null` past a UUID validator
 * while still rejecting `0`, `""` or `"none"` — `@IsOptional()` alone would treat `null` as
 * "absent" and let it through unchecked, which is the opposite of the intent here.
 *
 * ── `fromAssigneeId` is the compare-and-set predicate ───────────────────────
 *
 * Same role `from` plays for status: it is what the caller believed the current owner to be, and
 * a mismatch answers **409** rather than overwriting another Admin's reassignment. Required, so
 * there is no unconditional form of this write.
 *
 * ── This is not a filter, and cannot become one ─────────────────────────────
 *
 * SECURITY.md §RBAC integration forbids a client-supplied `assignedToId` as a *scoping* input.
 * That rule is about reads, and it holds: no list endpoint declares the parameter. Here the value
 * is the write's payload, checked against `AssignableStaffDirectory` before it reaches the column,
 * and the endpoint is Admin-only.
 */
export class ChangeLeadAssignmentDto {
  /** The owner the caller believes the lead currently has. `null` asserts it is unassigned. */
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  fromAssigneeId!: string | null;

  /** The owner it should have. `null` clears the assignment. */
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  assigneeId!: string | null;
}
