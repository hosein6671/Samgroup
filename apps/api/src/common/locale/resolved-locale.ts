/**
 * The outcome of validating a request's `?locale=` against the active `Locale` rows. Only
 * ever produced by LocaleResolutionService — a hand-built value would defeat the point,
 * since holding one is what proves the code was checked against the database.
 */
export type ResolvedLocale = {
  /** An active locale code: the requested one, or the platform default when none was asked for. */
  code: string;

  /**
   * The platform default's code. Carried so a caller can resolve fallbacks without a second
   * lookup — the base entity row (`Category.name`, `Product.slug`) holds the default
   * locale's value, and every other locale lives in `content_translations`.
   */
  defaultCode: string;

  /**
   * True when `code` is the default. Callers use this to skip translation lookups entirely
   * rather than to compare `code` against `defaultCode` themselves.
   */
  isDefault: boolean;
};
