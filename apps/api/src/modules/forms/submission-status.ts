/**
 * The `status` every public submission is created with — **ratified, with its meaning frozen
 * narrowly.**
 *
 * ── What `new` means, exactly ───────────────────────────────────────────────
 *
 * It is the **initial ingestion state, and only that**: this row was accepted and written, and
 * nobody has looked at it. That is the whole of its meaning.
 *
 * It explicitly does **not** define a workflow or a lifecycle. **No transition is authorized** —
 * nothing in this application moves a submission out of `new`, no second value exists, and no
 * ordering between values is implied because there is no second value to be ordered against. The
 * status vocabulary, the Admin/RBAC workflow that would operate it, and the `StatusHistory` audit
 * trail DATA_MODEL.md §2 anchors for it are all deferred, and the gate that builds them is free to
 * rename this value while it is still the only one in the table.
 *
 * ── Server-owned ────────────────────────────────────────────────────────────
 *
 * `Inquiry.status` and `CustomFormulationRequest.status` are `String` rather than enums because, as
 * schema.prisma states, "the business lifecycle is not yet defined". Both services set this
 * constant on insert and **neither DTO accepts a `status` field**, so a client can neither submit
 * nor override it: `forbidNonWhitelisted` answers 400 naming the property instead. That is asserted
 * in `create-inquiry.dto.spec.ts` and `create-custom-formulation-request.dto.spec.ts`.
 *
 * Held in one constant so the eventual rename is one edit rather than a search across two services.
 */
export const INITIAL_SUBMISSION_STATUS = "new";
