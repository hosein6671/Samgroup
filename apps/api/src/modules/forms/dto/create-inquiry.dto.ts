import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { Trim, TrimToUndefined } from "../../../common/validation/trim.transform";
import { InquiryType } from "../../../prisma/generated/client";

import { FIELD_MAX, PRODUCTS_OF_INTEREST_MAX_ITEMS } from "./field-limits";

/**
 * The seven `inquiryType` values, as they appear on the wire.
 *
 * ── These are the physical enum labels, not the human ones ──────────────────
 *
 * API_CONTRACT_FINAL.md §2.6 writes the value as `'Sample Request'`, and that is the *form option's*
 * label rather than the transport value: schema.prisma's own enum note is explicit that "the
 * human-readable forms ('Request a Quote') are presentation strings and belong to the translation
 * catalogs, not to a Postgres type". Putting a display label on the wire would also make the API
 * contract change the day the label is reworded, and would be untranslatable — the same submission
 * arrives from `/fa` and `/ar`.
 *
 * So the wire vocabulary is the `@map` label each member already carries in PostgreSQL. This
 * follows the precedent `GET /locales` sets, which serves `ltr`/`rtl` rather than `LTR`/`RTL`.
 */
export const INQUIRY_TYPES = [
  "product_inquiry",
  "request_a_quote",
  "customized_solution",
  "export_and_logistics",
  "distribution_partnership",
  "general_inquiry",
  "sample_request",
] as const;

export type InquiryTypeValue = (typeof INQUIRY_TYPES)[number];

/**
 * Wire value → Prisma enum member.
 *
 * Exhaustive by construction, in the same shape and for the same reason as `locales.service.ts`'s
 * `WIRE_DIRECTION`: a member added to the schema fails to compile here until it is given a wire
 * value, rather than being quietly unreachable through the API.
 */
export const PRISMA_INQUIRY_TYPE: Record<InquiryTypeValue, InquiryType> = {
  product_inquiry: InquiryType.PRODUCT_INQUIRY,
  request_a_quote: InquiryType.REQUEST_A_QUOTE,
  customized_solution: InquiryType.CUSTOMIZED_SOLUTION,
  export_and_logistics: InquiryType.EXPORT_AND_LOGISTICS,
  distribution_partnership: InquiryType.DISTRIBUTION_PARTNERSHIP,
  general_inquiry: InquiryType.GENERAL_INQUIRY,
  sample_request: InquiryType.SAMPLE_REQUEST,
};

/**
 * The Incoterm options **this** form offers — five, including "Not sure".
 *
 * DATA_MODEL_GAP_REVIEW.md §2 fixes the list and calls the difference out explicitly: the
 * Customized Solutions form has four and "note the extra 'Not sure' option the Customized Solutions
 * form doesn't have". The two lists are therefore declared separately, in their own DTOs, rather
 * than shared — sharing them would erase a documented distinction the first time either changed.
 */
export const INQUIRY_INCOTERMS = ["EXW", "FOB", "CFR", "CIF", "Not sure"] as const;

/**
 * `POST /inquiries` — API_CONTRACT_FINAL.md §2.6.
 *
 * ── One endpoint, all seven inquiry types, including Sample Request ─────────
 *
 * There is no `/sample-requests` endpoint and no `SampleRequest` entity: the merge recorded in
 * DATA_MODEL.md and SITE_STRUCTURE.md ("Request Sample Form — RESOLVED") makes a sample request an
 * `Inquiry` with `inquiryType: sample_request` and `relatedProductId` set. Quote requests are the
 * same shape with `request_a_quote`. This DTO is therefore the single public lead-capture contract
 * for three of the four flows this gate implements; the fourth, the detailed Custom Product
 * Request, has its own entity and its own endpoint.
 *
 * ── What is required is what the table says is required ─────────────────────
 *
 * The eight `@IsNotEmpty` fields below are exactly the NOT NULL columns of `inquiries` that a
 * public submitter supplies, and they are also exactly the fields SITE_STRUCTURE.md §10 marks with
 * an asterisk. Nothing is required here that the schema leaves nullable — on a lead form an
 * invented required field is a lead that does not arrive.
 *
 * ── What this DTO deliberately does not declare ─────────────────────────────
 *
 * `id`, `createdAt`, `status`, `userId`, `assignedToId` and `attachmentMediaId` are absent, and
 * their absence is enforcement rather than omission: the global ValidationPipe runs with
 * `forbidNonWhitelisted`, so a request that sends any of them answers 400 VALIDATION_ERROR naming
 * the property instead of having it silently stripped. The first three are server-owned, the next
 * two are lead-routing fields no anonymous submitter may set, and the last needs an upload endpoint
 * that does not exist (`POST /media/upload` is contracted and unbuilt).
 */
export class CreateInquiryDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.NAME)
  firstName!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.NAME)
  lastName!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.COMPANY)
  companyName!: string;

  /**
   * Free text, never a country code. The column is `text` and no `Country` reference table exists
   * anywhere in the schema; validating against an invented list would reject real answers.
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.COUNTRY)
  country!: string;

  /**
   * `@MaxLength` before deliverability: an address longer than RFC 5321 allows is rejected as too
   * long rather than as malformed, which is the more useful of the two messages.
   */
  @Trim()
  @IsString()
  @MaxLength(FIELD_MAX.EMAIL)
  @IsEmail()
  email!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.INDUSTRY)
  industry!: string;

  @IsIn([...INQUIRY_TYPES])
  inquiryType!: InquiryTypeValue;

  /**
   * Phone / WhatsApp, stored exactly as typed.
   *
   * **No normalization and no format rule.** The buyers are international, the column is `text`,
   * and no phone convention is established anywhere in this project — a country-specific pattern
   * here would reject valid numbers from the markets the site exists to serve.
   */
  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.PHONE)
  phone?: string;

  /**
   * The multi-select on the Contact Us form, stored as the `text[]` the column already is.
   *
   * **The vocabulary is deliberately not closed.** SITE_STRUCTURE.md §10 names nine options as
   * labels, not as slugs, and no approved machine vocabulary for them exists — an `@IsIn` here
   * would be inventing one. Bounded by item count and per-item length instead, which is what the
   * unauthenticated endpoint actually needs protecting from.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PRODUCTS_OF_INTEREST_MAX_ITEMS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(FIELD_MAX.SHORT_TEXT, { each: true })
  productsOfInterest?: string[];

  /**
   * The product a "Request Sample" or "Request a Quote" CTA was clicked from — a `Product` id, and
   * never a name or a slug.
   *
   * DATA_MODEL.md §2 Notes: `relatedProductId` "records which product page the CTA was clicked
   * from, replacing the `productId` the old `SAMPLE_REQUEST` carried". The service verifies the id
   * resolves to a real product before writing, so a submission can never carry a dangling
   * reference; see `inquiries.service.ts`.
   */
  @IsOptional()
  @IsUUID()
  relatedProductId?: string;

  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.SHORT_TEXT)
  requiredQuantity?: string;

  /** Where the goods ship — distinct from `country`, which is the buyer's own (GAP_REVIEW §2). */
  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.SHORT_TEXT)
  destinationCountryPort?: string;

  @TrimToUndefined()
  @IsOptional()
  @IsIn([...INQUIRY_INCOTERMS])
  preferredIncoterm?: (typeof INQUIRY_INCOTERMS)[number];

  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.LONG_TEXT)
  message?: string;

  /**
   * Must be `true`, not merely present.
   *
   * API_CONTRACT_FINAL.md §Input validation: "`consentGiven` must be `true` — a submission without
   * consent is rejected, not stored-and-flagged, since storing it is the thing consent governs."
   * `@IsBoolean` first so `"yes"` is reported as a type error rather than as a missing consent.
   */
  @IsBoolean()
  @Equals(true)
  consentGiven!: boolean;
}
