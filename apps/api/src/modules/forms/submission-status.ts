import { INITIAL_LEAD_STATUS } from "./workflow/lead-status";

/**
 * The `status` every public submission is created with.
 *
 * ── What `new` means, and what changed around it ────────────────────────────
 *
 * The **value is unchanged**: `new`, exactly as before, so no row written by any past submission
 * moved or was reinterpreted. What changed is that it is no longer the *only* value. It was
 * previously the initial ingestion state with no authorized transition and no second member; the
 * lead workflow gate (ADR-013) gave it a graph, and `new` is now the entry node of one:
 *
 * ```
 * new → in_progress → closed
 *  └────────────────→ closed
 *            closed → in_progress   (reopen)
 * ```
 *
 * Its meaning is the narrower one it always had — *accepted and written, nobody has begun work* —
 * which is why it needed no rename when the vocabulary arrived. The earlier note reserved the
 * right to rename it "while it is still the only one in the table"; that right was not used,
 * because the name was already correct.
 *
 * ── Still server-owned, and still unreachable from a submission ─────────────
 *
 * Neither `CreateInquiryDto` nor `CreateCustomFormulationRequestDto` declares a `status` field, so
 * `forbidNonWhitelisted` answers 400 naming the property to any client that sends one. A status is
 * now changeable — but only through `PATCH /admin/{leads}/:id/status`, behind authentication, RBAC
 * and the transition graph. The public write path still supplies this constant and nothing else.
 *
 * ── One constant, re-exported rather than duplicated ────────────────────────
 *
 * The value lives in `workflow/lead-status.ts` beside the vocabulary and the graph it belongs to.
 * This alias is kept because both submission services already import it under this name, and a
 * mechanical rename across them would be churn with no reader benefit. There is exactly one
 * definition, so the two cannot drift.
 */
export const INITIAL_SUBMISSION_STATUS: string = INITIAL_LEAD_STATUS;
