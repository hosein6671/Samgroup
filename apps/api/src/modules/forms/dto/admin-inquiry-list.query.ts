import { IsIn, IsOptional } from "class-validator";

import { AdminLeadListQuery } from "./admin-lead-list.query";
import { INQUIRY_TYPES } from "./create-inquiry.dto";

import type { InquiryTypeValue } from "./create-inquiry.dto";

/**
 * `GET /admin/inquiries` query parameters.
 *
 * ── One filter, and it is the one the vocabulary already fixes ──────────────
 *
 * `inquiryType` reuses `INQUIRY_TYPES` — the exact list `POST /inquiries` accepts and the exact
 * set of labels in the `inquiry_type` PostgreSQL enum. Nothing new is decided here: the filter can
 * only ask for values the write path can produce, and a value outside the list answers 400
 * `VALIDATION_ERROR` naming the property rather than returning an empty page.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 *
 * No `q`, no `company`, no `country`, no `email`, no date range, and no `status`.
 *
 * `q` and company search would fix free-text matching semantics — which columns, prefix or
 * substring, case and accent folding — ahead of the decision that defines them, on a table of
 * personal data where a wrong answer is a privacy question and not just a relevance one. A date
 * range has no approved parameter spelling anywhere in this contract. `status` has exactly one
 * value platform-wide, so a filter on it is a control that cannot change the result.
 *
 * `assignedToId` is absent for a different and stronger reason: **lead scoping is an access-control
 * decision, and SECURITY.md §RBAC integration requires the server to apply it rather than the
 * client to request it.** A client-supplied `assignedToId` would be exactly the shape that rule
 * forbids. The Sales Expert constraint is derived from the authenticated caller in
 * `lead-scope.ts` and never from a query parameter.
 *
 * Because the global ValidationPipe runs with `forbidNonWhitelisted`, none of those absences is
 * silence: sending one answers 400 naming the property.
 */
export class AdminInquiryListQuery extends AdminLeadListQuery {
  @IsOptional()
  @IsIn([...INQUIRY_TYPES])
  inquiryType?: InquiryTypeValue;
}
