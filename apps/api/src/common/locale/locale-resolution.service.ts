import { HttpStatus, Injectable } from "@nestjs/common";

// A value import, not `import type`: emitDecoratorMetadata writes the constructor parameter
// types into design:paramtypes at runtime, and a type-only import erases to nothing, leaving
// Nest unable to resolve the dependency.
import { LocalesService } from "../../modules/localization/locales.service";
import { ApiException } from "../http/api.exception";
import { ErrorCode } from "../http/error-code";

import type { ResolvedLocale } from "./resolved-locale";

const INVALID_LOCALE_MESSAGE = "The requested locale is not available.";
const INVALID_LOCALE_ISSUE = "must be one of the platform's active locale codes";

/**
 * No active locale carries `isDefault`. Every content endpoint depends on a default to fall
 * back to, so this is a bootstrap failure of the platform, not a fault in the request —
 * hence 500 rather than an error blamed on the caller.
 */
const NO_DEFAULT_MESSAGE = "No default locale is configured.";

/**
 * Turns a request's raw `?locale=` into a checked ResolvedLocale, and is the only place that
 * decides a locale is invalid.
 *
 * Lives in `common/` rather than in LocalizationModule because it is request-handling
 * policy, not ownership of the `Locale` table: LocalizationModule owns the rows and exposes
 * them through LocalesService, and this service applies API_CONTRACT_FINAL.md §3 to them.
 * The table is still read through that service, never queried here directly
 * (ARCHITECTURE.md §Modules — cross-module access goes through a service interface).
 *
 * Every call re-reads the active list, so one content request costs one extra query. That is
 * accepted for now: caching is a separate approved step, and a cached locale list that goes
 * stale after an admin deactivates a language would serve a locale the platform no longer
 * has.
 */
@Injectable()
export class LocaleResolutionService {
  constructor(private readonly localesService: LocalesService) {}

  /**
   * @param requested the raw `?locale=` value, or undefined when the parameter was omitted.
   * @throws ApiException INVALID_LOCALE (400) for any value that is not an active code;
   *         API_CONTRACT_FINAL.md §3 rules out falling back to the default, because a
   *         typo'd locale quietly serving English survives to production.
   */
  async resolve(requested?: string): Promise<ResolvedLocale> {
    const active = await this.localesService.findActive();
    const platformDefault = active.find((locale) => locale.isDefault);

    // Guaranteed to be at most one by the locales_single_default partial unique index, but
    // not guaranteed to exist — the default row could be deactivated.
    if (platformDefault === undefined) {
      throw new ApiException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.InternalError,
        NO_DEFAULT_MESSAGE,
      );
    }

    if (requested === undefined) {
      return { code: platformDefault.code, defaultCode: platformDefault.code, isDefault: true };
    }

    const match = active.find((locale) => locale.code === requested);

    if (match === undefined) {
      // The rejected value is deliberately not echoed back. `message` is contracted as safe
      // to display (§8), and reflecting an arbitrary query string into displayed text hands
      // the frontend a string it did not author.
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InvalidLocale,
        INVALID_LOCALE_MESSAGE,
        [{ field: "locale", issue: INVALID_LOCALE_ISSUE }],
      );
    }

    return { code: match.code, defaultCode: platformDefault.code, isDefault: match.isDefault };
  }
}
