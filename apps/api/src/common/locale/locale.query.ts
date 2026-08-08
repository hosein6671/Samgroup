import { IsOptional, IsString } from "class-validator";

/**
 * The `?locale=` query parameter every content-bearing endpoint accepts
 * (API_CONTRACT_FINAL.md §3). Endpoints with further parameters extend this class rather
 * than redeclaring the field — class-validator inherits decorators, so `?parentId=` and
 * `?locale=` validate together under one DTO.
 *
 * Only the shape is checked here. Whether the value names an ACTIVE locale is a database
 * question and belongs to LocaleResolutionService: a syntactically fine but inactive code
 * must answer INVALID_LOCALE, not VALIDATION_ERROR (§8 lists them as separate codes on the
 * same 400).
 *
 * `?locale=` with an empty value is deliberately not rejected here either. It is not an
 * omitted parameter, so it must not silently take the default — it reaches the resolution
 * service and comes back as INVALID_LOCALE, which is what §3 requires of any locale the
 * platform does not serve.
 */
export class LocaleQuery {
  @IsOptional()
  @IsString()
  locale?: string;
}
