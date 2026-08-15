/**
 * What a successful public submission answers with — two fields, and no more.
 *
 * ── Why so little ───────────────────────────────────────────────────────────
 *
 * A public submission endpoint is a write, not a read. Echoing the stored record back would put a
 * lead's own contact details on the wire again for no consumer, and `status` and `assignedToId` are
 * internal lead-routing state that SECURITY.md scopes to Admin and to the assigned Sales Expert —
 * returning either to an anonymous submitter would leak workflow state through the front door.
 *
 * `id` is server-generated and is here because it is the only handle a later conversion-tracking or
 * support flow could refer to a submission by. `createdAt` is the server's clock, ISO 8601, and is
 * the receipt: the submitter's own timestamp is not evidence of anything.
 *
 * There is no read endpoint for either entity in this gate, so neither value is resolvable by the
 * caller into anything else.
 */
export type SubmissionResponse = {
  id: string;
  /** ISO 8601, server-generated. */
  createdAt: string;
};
