import { InquiryType } from "../../prisma/generated/client";

import type { InquiryTypeValue } from "./dto/create-inquiry.dto";

/**
 * Prisma enum member → wire value: the inverse of `PRISMA_INQUIRY_TYPE`, for the read direction.
 *
 * ── Why it is written out rather than inverted at runtime ───────────────────
 *
 * Inverting `PRISMA_INQUIRY_TYPE` with `Object.entries` would type-check as `Record<string,
 * string>` and lose exactly the property that matters: **totality over `InquiryType`**. Declared
 * this way, adding a member to the schema enum fails to compile here until it is given a wire
 * value, rather than being silently rendered as `undefined` in an Admin list. That is the same
 * argument `create-inquiry.dto.ts` makes for the forward map, applied to the direction that did
 * not exist until there was a read endpoint.
 *
 * ── The values are the physical labels, and they match the write path exactly ─
 *
 * `GET /admin/inquiries` answers with the same seven strings `POST /inquiries` accepts. An Admin
 * surface that spelled them differently — title case for display, say — would be a second
 * vocabulary to keep in step, and display text belongs to a translation catalog rather than to a
 * transport value (`user-role.ts` sets the precedent this follows).
 */
export const WIRE_INQUIRY_TYPE: Readonly<Record<InquiryType, InquiryTypeValue>> = {
  [InquiryType.PRODUCT_INQUIRY]: "product_inquiry",
  [InquiryType.REQUEST_A_QUOTE]: "request_a_quote",
  [InquiryType.CUSTOMIZED_SOLUTION]: "customized_solution",
  [InquiryType.EXPORT_AND_LOGISTICS]: "export_and_logistics",
  [InquiryType.DISTRIBUTION_PARTNERSHIP]: "distribution_partnership",
  [InquiryType.GENERAL_INQUIRY]: "general_inquiry",
  [InquiryType.SAMPLE_REQUEST]: "sample_request",
};

export function toWireInquiryType(type: InquiryType): InquiryTypeValue {
  return WIRE_INQUIRY_TYPE[type];
}
