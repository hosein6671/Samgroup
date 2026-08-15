import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { Trim, TrimToUndefined } from "../../../common/validation/trim.transform";

import { FIELD_MAX } from "./field-limits";

/**
 * Four options, and deliberately not five.
 *
 * DATA_MODEL_GAP_REVIEW.md §2 states the distinction directly: the Contact Us Inquiry form carries
 * a fifth "Not sure" option that this form does not. See `create-inquiry.dto.ts`'s own list — the
 * two are declared separately so neither can drift into the other.
 */
export const FORMULATION_INCOTERMS = ["EXW", "FOB", "CFR", "CIF"] as const;

/**
 * `POST /custom-formulation-requests` — API_CONTRACT_FINAL.md §2.6.
 *
 * ── Why this is a second endpoint rather than an eighth inquiry type ────────
 *
 * `InquiryType` does contain `customized_solution`, and it is not this. That value is one option of
 * the Contact Us dropdown — a general message that happens to be about customization. This endpoint
 * backs the Custom Product Request form on `/customized-solutions`, whose fields (product or
 * application, required specifications, packaging requirements, estimated quantity) have no column
 * on `inquiries` at all. Both the contract §2.6 and DATA_MODEL.md keep them as two entities, and
 * collapsing them would mean either losing the specification fields or adding them to a table that
 * does not want them.
 *
 * ── Required fields follow the table, and this conflicts with SITE_STRUCTURE ─
 *
 * `custom_formulation_requests` declares `company_name`, `country`, `industry`, `email`,
 * `product_or_application`, `required_specifications` and `consent_given` NOT NULL. SITE_STRUCTURE
 * §5 marks only Email with an asterisk, and DATA_MODEL_GAP_REVIEW §1 marks only `email` and
 * `consentGiven` required — so five columns the migrated schema makes mandatory are documented as
 * optional.
 *
 * The DTO follows the **schema**, because the schema is what the write has to satisfy: the
 * alternative is accepting a submission the database then rejects, or writing `""` into a NOT NULL
 * column to dodge that, which stores an empty answer as though it were an answer. The conflict is
 * reported rather than resolved here — changing either side is a schema or content decision, not an
 * implementation one.
 *
 * ── Not declared, therefore rejected ────────────────────────────────────────
 *
 * `id`, `createdAt`, `status`, `userId`, `assignedToId`, `attachmentMediaId`. Same reasoning as
 * `CreateInquiryDto`, and the same enforcement — `forbidNonWhitelisted` answers 400 rather than
 * stripping them. The form's "Upload Technical Specifications" control has no endpoint behind it
 * (`POST /media/upload` is contracted and unbuilt), so no attachment reaches this DTO by any route.
 */
export class CreateCustomFormulationRequestDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.COMPANY)
  companyName!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.COUNTRY)
  country!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.INDUSTRY)
  industry!: string;

  @Trim()
  @IsString()
  @MaxLength(FIELD_MAX.EMAIL)
  @IsEmail()
  email!: string;

  /** Free text, unnormalized, for the same reason as `CreateInquiryDto.phone`. */
  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.PHONE)
  phone?: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.SHORT_TEXT)
  productOrApplication!: string;

  /**
   * The substance of the request, and the reason this form exists.
   *
   * **No structure is imposed on it.** The column is `text`, no document specifies a format, and
   * inventing named specification fields — viscosity grade, base number, approval target — would be
   * inventing a technical vocabulary this project has not approved.
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.LONG_TEXT)
  requiredSpecifications!: string;

  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.SHORT_TEXT)
  estimatedQuantity?: string;

  /**
   * Free text, not an enum. DATA_MODEL.md §2 Notes is explicit: Bulk, Drums, IBC Tanks and
   * Customized Packaging are named as examples, and "Phase 1 treats these as free text since
   * packaging needs vary per request".
   */
  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.SHORT_TEXT)
  packagingRequirements?: string;

  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.SHORT_TEXT)
  destinationCountry?: string;

  @TrimToUndefined()
  @IsOptional()
  @IsIn([...FORMULATION_INCOTERMS])
  preferredIncoterm?: (typeof FORMULATION_INCOTERMS)[number];

  @TrimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.LONG_TEXT)
  additionalInformation?: string;

  /** Must be `true` — same rule, same source, as `CreateInquiryDto.consentGiven`. */
  @IsBoolean()
  @Equals(true)
  consentGiven!: boolean;
}
