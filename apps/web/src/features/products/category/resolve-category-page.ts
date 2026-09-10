import { publishedCategoryContent } from "./published-category-content";
/**
 * Product Family composition: Catalog owns identity and localized name; Payload owns published
 * English narrative. Existing registry copy preserves all six pages until content is published,
 * and remains the fallback on service failure. Taxonomy, technical content, media and FAQ keep
 * their existing sources. No infrastructure failure becomes a category 404 (ADR-010).
 */

import { getCategoryBySlug } from "@/lib/catalog";
import { getLocaleByCode } from "@/lib/locales";

import { FAMILIES } from "../products-data";

import { getCategoryContent } from "./data";

import type { ProductCategoryContent } from "./category-contract";
import type { ProductFamily } from "../products-data";

/** Why the fixture's own values were rendered instead of the API's. */
export type CategoryFallbackReason =
  | "not-found"
  | "unreachable"
  | "api-error"
  /** A default-locale 200 whose `slug` is not the slug that was requested. */
  | "slug-mismatch"
  /** A 200 for a category with a parent — a Product Family must be a root. */
  | "not-root";

export type ResolvedCategoryPage = {
  readonly content: ProductCategoryContent;
  /** The canonical record, with API-owned fields merged in when the API answered cleanly. */
  readonly family: ProductFamily;
  /** Which side supplied the API-owned values. Diagnostic — never rendered. */
  readonly source: "api" | "fixture";
  /** Set only when `source` is `"fixture"`. Diagnostic — never rendered. */
  readonly fallbackReason?: CategoryFallbackReason;
};

/**
 * Server-side only, and deliberately not surfaced.
 *
 * A design-proof page that silently ignored a missing category row would hide exactly the drift
 * this integration exists to detect, so every fallback is reported. Nothing from the API's own
 * `message` is included — §8 contracts it as safe to display, but it is still text this
 * application did not author, and it has no place in a log line that names a cause instead.
 */
function report(slug: string, reason: CategoryFallbackReason, status?: number): void {
  const detail: Record<CategoryFallbackReason, string> = {
    "not-found": "no Category row answered this slug — run `pnpm seed:categories`",
    unreachable: "the API did not respond (down, refused, timed out, or API_INTERNAL_URL unset)",
    // `status` is what separates the three conditions that share this reason: a 5xx, a 2xx whose
    // payload is not a category, and a 2xx that is not the envelope at all. Without it they are
    // one indistinguishable line in a log.
    "api-error": "the API answered, but not with a category",
    "slug-mismatch": "the API resolved this slug to a category with a different canonical slug",
    "not-root": "the API returned a child category; a Product Family must be a root",
  };

  const suffix = status === undefined ? "" : ` (HTTP ${String(status)})`;

  console.warn(`[category:${slug}] rendering fixture — ${detail[reason]}${suffix}`);
}

/**
 * A Product Family page's content and canonical record, or `null` when no fixture is registered
 * for the slug.
 *
 * `null` rather than a throw or a `notFound()` call, so the route file keeps deciding what a
 * missing page means. The canonical route generates its params from this same registry and closes
 * the segment with `dynamicParams = false`, so it cannot happen there either; the check is kept
 * because it is what that route needs the day the segment opens.
 *
 * @param slug the family's canonical identifier — its DEFAULT-locale `Category.slug`, which is the
 *   registry key and the route segment. A localized slug is never passed here (ADR-009 §3).
 * @param locale the active locale code from the `[locale]` segment. Sent to the API, which resolves
 *   `name` in it; also what decides whether the slug guard below applies.
 *
 *   **Required.** It was briefly optional, for exactly one caller: the six `/design-proof` Product
 *   Family routes, which were held live for side-by-side validation and had no locale to send — the
 *   proof tree is not locale-routed and never will be. Those six now redirect to the canonical URL
 *   (`8d5ad89`) and call nothing here, so the canonical route is the only caller and it always has a
 *   locale.
 *
 *   The compatibility branch is therefore removed rather than left dormant. A parameter that cannot
 *   be omitted cannot quietly re-acquire the assumption it used to encode — that an absent locale
 *   means the platform default — which is an assumption no future caller should inherit by
 *   accident.
 *
 * The missing-family throw below is the invariant that used to live in `ProductCategoryTemplate`.
 * It has moved, not softened: a fixture naming a `familyId` that is not one of the canonical six
 * is a broken build, and it should fail loudly rather than render a page with no name.
 */
export async function resolveCategoryPage(
  slug: string,
  locale: string,
): Promise<ResolvedCategoryPage | null> {
  const fixture = getCategoryContent(slug);
  if (!fixture) return null;
  const content = await publishedCategoryContent(fixture, locale);

  const family = FAMILIES.find((entry) => entry.id === content.familyId);
  if (!family) {
    throw new Error(`No product family "${content.familyId}" in products-data.ts`);
  }

  /*
   * Which locale is the platform default is data, never a literal — `en` appears nowhere in the
   * routing layer by decision (PROJECT_HANDOFF §6.9). It is read from the same authoritative source
   * the route tree itself is generated from.
   *
   * **This adds no runtime dependency.** `getActiveLocales` is memoized for the lifetime of the
   * process and `app/[locale]/layout.tsx` already awaits it on every render in this tree to set
   * `<html lang dir>`, so this resolves the promise that request already holds. A locale source
   * failure takes the layout down before it could reach here; it can never be this call that turns
   * a working page into a broken one.
   *
   * An unrecognised code is treated as non-default, so the guard declines rather than firing on a
   * locale it cannot classify. Unreachable while `dynamicParams = false` holds on the `[locale]`
   * segment.
   */
  const isDefaultLocale = (await getLocaleByCode(locale))?.isDefault ?? false;

  const result = await getCategoryBySlug(slug, locale);

  if (!result.ok) {
    report(slug, result.reason, result.reason === "api-error" ? result.status : undefined);
    return { content, family, source: "fixture", fallbackReason: result.reason };
  }

  /*
   * Both invariants are checked before a single API value is used.
   *
   * `slug` guards the identity ADR-009 froze, in the one locale where `data.slug` and the fixture
   * key are the same vocabulary — see the module note for why that scope is the whole point.
   * `parentId` guards reachability in every locale: it is not a localized field, and `findAll` and
   * the sitemap both read `parent_id IS NULL`, so a family that has acquired a parent is a family
   * the rest of the platform can no longer see.
   */
  if (isDefaultLocale && result.record.slug !== slug) {
    report(slug, "slug-mismatch");
    return { content, family, source: "fixture", fallbackReason: "slug-mismatch" };
  }

  if (result.record.parentId !== null) {
    report(slug, "not-root");
    return { content, family, source: "fixture", fallbackReason: "not-root" };
  }

  return {
    content,
    /*
     * The merge, in full. `name` is the single API-owned rendered value in this gate — it is what
     * the API can localize and the fixture cannot. Everything else is spread through untouched,
     * `id` above all: it is the canonical identifier, it is already guarded at module load, and a
     * value the network could rewrite would not be an identifier.
     */
    family: { ...family, name: result.record.name },
    source: "api",
  };
}
