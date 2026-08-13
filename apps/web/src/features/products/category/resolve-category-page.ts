/**
 * The one place a Product Family page's data is assembled.
 *
 * ── What this gate actually changes ─────────────────────────────────────────
 *
 * Before it, a category page was a fixture lookup. After it, the page asks the real API who the
 * category is and keeps using the fixture for what the category says. That is the whole change,
 * and it is a real ownership boundary rather than a staging post: `Category` in `sam_platform`
 * owns existence, canonical slug and name; the fixture owns every word of editorial content,
 * standing in for `GET /content/product-categories/:key`, which does not exist. When Payload
 * arrives it replaces the fixture half and this module gains a second fetch — the API half does
 * not move.
 *
 * ── Fail-open, and why that is not a hedge ──────────────────────────────────
 *
 * Every API outcome other than success renders the fixture. That is not caution about a new code
 * path; it is the correct behaviour for what is being merged. The only API-owned value rendered
 * today is the family's NAME, and the fixture's name is the approved name — it is the value
 * `prisma/seed-categories.ts` seeds the database FROM. So a failed fetch costs the page nothing
 * it can observe, and letting it cost the page a 404 or an error boundary would trade six
 * approved, working design-proof pages for a strictness that protects nothing.
 *
 * `notFound()` is therefore never reached from an API condition here. It stays what it was: the
 * answer to a slug with no fixture — which under the canonical route's `dynamicParams = false` is
 * unreachable, and is kept because it is the behaviour that segment needs the day that changes.
 *
 * ── The slug guard is locale-aware, and has to be ───────────────────────────
 *
 * `Category.slug` is a localized field. The endpoint resolves a request in the requested locale's
 * vocabulary and answers in it: `data.slug` is the translated slug where one exists, and the
 * entity's own column where one does not. The fixture key is neither — it is the DEFAULT-locale
 * slug, permanently (ADR-009 §3, ADR-010 §5).
 *
 * So comparing `data.slug` against the fixture key is a valid identity test in the default locale
 * and an invalid one everywhere else. Applying it unconditionally would be correct today only
 * because no translated slug row exists; the first `fa` slug written turns `/fa/products/base-oils`
 * — the URL ADR-010 §8 explicitly launches — into a false `slug-mismatch`, discarding the localized
 * name the locale was passed for and logging drift that did not happen.
 *
 * The guard is therefore scoped to the default locale, and `parentId` — which is not localized —
 * still guards every locale. What is deliberately NOT built is the alternative: reading the
 * canonical slug back out of `seo.alternates` to compare in every locale. That means consuming the
 * SEO block, which is a later gate, and it buys nothing here — with no translated slug rows,
 * `findBySlug` falls straight through to a unique lookup on the requested slug, so the entity is
 * the fixture's by construction rather than by check.
 *
 * ── Canonical identity is not rewritten from the API ────────────────────────
 *
 * ADR-009 makes one string simultaneously the route segment, the registry key, Payload's
 * `categoryKey` and `ProductFamily.id`. The frontend guards that invariant at module load
 * (`products-data.ts`) and this module does not hand the guard to the network: `id`, `href`,
 * `code`, `descriptor`, `ranges` and `namedBlock` are never overwritten. A response whose `slug`
 * is not the one requested, or which is not a root category, is treated as drift — reported, and
 * the fixture rendered — rather than accepted as a correction.
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
  const content = getCategoryContent(slug);
  if (!content) return null;

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
