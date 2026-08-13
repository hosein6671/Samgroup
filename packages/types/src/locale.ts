/**
 * The localization resource's wire shape — API_CONTRACT_FINAL.md §2.1, `GET /locales`.
 *
 * Shared rather than declared inside `apps/web` because this is the first contract the frontend
 * consumes for something other than content: it is the *routing* source. `apps/web` generates its
 * `[locale]` route set from it, sets `<html lang dir>` from it, and negotiates redirects against
 * it, so three separate consumers read one declaration here instead of three shape-alikes.
 *
 * That is not hypothetical. `features/site/site-routes.ts` already carries a `LOCALES` fixture
 * shaped `{ code, label, native, direction, isDefault }` — field-for-field different from the
 * endpoint's `{ code, name, nativeName, direction, isDefault }`. It remains in the tree only
 * because the presentational language switcher still consumes it; it is **not** the routing
 * source, and nothing in this file should ever be reconciled against it.
 *
 * The same caveat as `api.ts` and `catalog.ts` applies: `apps/api` keeps its own DTOs and is
 * untouched in this gate, so this is a transcription of the contract, not `tsc`-enforced
 * agreement with the backend. Aligning the two is a later gate.
 */

/**
 * Lowercase, because the only consumer is the HTML `dir` attribute.
 *
 * PostgreSQL stores `ltr`/`rtl` and every document writes it lowercase
 * (INTERNATIONALIZATION_STRATEGY.md §1, DATA_MODEL.md). The generated Prisma client surfaces the
 * member names `LTR`/`RTL` and the API maps them down before they reach the wire — that mapping
 * is a backend detail, not the contract.
 */
export type LocaleDirection = "ltr" | "rtl";

/**
 * One active locale, as `GET /locales` serves it. Exactly the five fields §2.1 names.
 *
 * `id`, `isActive` and `sortOrder` are absent by decision on the API side and are therefore absent
 * here: `id` is an internal uuid no consumer needs (`code` is the natural key every foreign key in
 * the schema points at), `isActive` would be a constant `true` on an endpoint that only returns
 * active rows, and `sortOrder` is expressed by the order of the array rather than repeated as a
 * number.
 *
 * **Array order is part of the contract.** The endpoint orders by `sortOrder`, and that order is
 * the language switcher's display order. A consumer that re-sorts is discarding editorial intent.
 *
 * **`isDefault` is true on exactly one row**, guaranteed by a partial unique index — but only
 * among *active* rows, and the default row could in principle be deactivated. The platform treats
 * that as a bootstrap failure rather than a state to degrade through, so a consumer that cannot
 * find exactly one default is looking at a broken locale table, not at a case to paper over.
 */
export type LocaleResponse = {
  /** The natural key, e.g. `en`. Used unchanged as the `[locale]` route segment. */
  code: string;
  /** The language's English name, e.g. `Persian`. */
  name: string;
  /** The language's name in itself, e.g. `فارسی` — what a language switcher shows. */
  nativeName: string;
  /** Drives `<html dir>`. Travels with the locale record; never inferred from the code. */
  direction: LocaleDirection;
  /** The platform default. True on exactly one row of the active set. */
  isDefault: boolean;
};
