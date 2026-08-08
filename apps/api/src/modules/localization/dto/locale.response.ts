/**
 * The wire shape of one locale — API_CONTRACT_FINAL.md §2.1 names exactly these five fields
 * ("code, name, nativeName, direction, isDefault") and this type holds it to them.
 *
 * `id`, `isActive` and `sortOrder` are deliberately absent: `id` is an internal uuid no
 * consumer needs (`code` is the natural key every foreign key in the schema points at),
 * `isActive` would be a constant `true` on an endpoint that only returns active rows, and
 * `sortOrder` is expressed by the order of the array rather than repeated as a number.
 *
 * Not a class-validator DTO — this endpoint takes no input, so there is nothing to validate.
 * It lives beside the module that produces it rather than in packages/types, which stays
 * empty until shared contracts are actually settled (PROJECT_STRUCTURE.md).
 */

/**
 * Lowercase on purpose. PostgreSQL stores `ltr`/`rtl` (schema.prisma maps the enum that way),
 * every document writes it lowercase (INTERNATIONALIZATION_STRATEGY.md §1, DATA_MODEL.md),
 * and the consumer is the HTML `dir` attribute. The generated Prisma client happens to
 * surface the member names `LTR`/`RTL`; that is a client detail, not the contract.
 */
export type LocaleDirectionValue = "ltr" | "rtl";

export type LocaleResponse = {
  code: string;
  name: string;
  nativeName: string;
  direction: LocaleDirectionValue;
  isDefault: boolean;
};
