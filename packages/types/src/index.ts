// Shared request/response DTO types for apps/web and apps/api (see PROJECT_STRUCTURE.md).
// Types only — never a runtime value; ./seo.ts explains why that constraint is structural
// rather than stylistic.
export type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiMeta,
  ApiSuccessResponse,
} from "./api";
export type { CategoryResponse, ProductListItemResponse } from "./catalog";
export type { LocaleDirection, LocaleResponse } from "./locale";
export type { SeoAlternate, SeoFields, TwitterCardType } from "./seo";
