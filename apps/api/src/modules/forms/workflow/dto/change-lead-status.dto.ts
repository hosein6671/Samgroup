import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { Trim } from "../../../../common/validation/trim.transform";
import { LEAD_STATUSES } from "../lead-status";

import type { LeadStatus } from "../lead-status";

/**
 * The maximum length of a transition note.
 *
 * Generous enough for a sentence explaining why a lead was closed, short enough that the column
 * cannot become a notes feature by accident — internal notes are explicitly deferred, and an
 * unbounded free-text field on an audit row is how that deferral gets undone one paste at a time.
 */
export const STATUS_NOTE_MAX_LENGTH = 2000;

/**
 * `PATCH /admin/{leads}/:id/status`.
 *
 * ── `from` is required, and it is not redundant ─────────────────────────────
 *
 * It is the caller's assertion about what they were looking at when they chose the transition, and
 * it does two jobs at once: it is the left-hand side the transition graph is checked against, and
 * it is the compare-and-set predicate that makes a concurrent edit answer **409** instead of
 * silently overwriting someone else's change. Without it the API would have to either lock the row
 * or accept last-write-wins, and this costs one field the UI already knows.
 *
 * ── No `status` shorthand, and no partial body ──────────────────────────────
 *
 * There is no single-field form of this request. `{ to }` alone would be an unconditional write,
 * which is exactly the shape that loses updates.
 *
 * The global `ValidationPipe` runs `whitelist` + `forbidNonWhitelisted`, so a body carrying
 * `assigneeId`, `assignedToId` or any other property is answered 400 naming it — a status request
 * cannot change ownership as a side effect.
 */
export class ChangeLeadStatusDto {
  @IsIn([...LEAD_STATUSES])
  from!: LeadStatus;

  @IsIn([...LEAD_STATUSES])
  to!: LeadStatus;

  /**
   * Optional, free text, and deliberately untyped. No reason taxonomy is invented here: a closed
   * vocabulary of closure reasons is sales-outcome CRM semantics, which this gate does not build.
   */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(STATUS_NOTE_MAX_LENGTH)
  note?: string;
}
