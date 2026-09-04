import { absoluteUrl } from "./site";

import type { SeoAlternate } from "@sam-group/types";
import type { Metadata } from "next";

/**
 * Canonical URLs and `hreflang` alternates — the one rule both are built by.
 *
 * ── Canonicals are absolute, always ─────────────────────────────────────────
 *
 * SEO_ARCHITECTURE.md §4: "Canonical URLs: rendered from `SeoFields.canonicalUrl`, always an
 * absolute URL". Next would resolve a relative one against `metadataBase` and emit an absolute tag
 * either way, so this is not about what reaches the HTML — it is about the value being the same
 * string the sitemap and the JSON-LD `@id` are built from, which is only true if one function
 * produces all three.
 *
 * ── `hreflang` is emitted only where a translation genuinely exists ─────────
 *
 * This is the constraint the architecture actually imposes, and it is why this file exists rather
 * than a one-line helper.
 *
 * `/fa/export-logistics` and `/ar/export-logistics` both return 200 today, and both serve **English
 * copy** — structural page text is code-owned and untranslated, and CMS-backed pages fall back to
 * the default locale when a translation is missing (Payload runs `fallback: true`). Declaring
 * `hreflang="fa"` for a page rendering English is the "hreflang points at the wrong language"
 * mistake: it tells a search engine to serve Persian speakers a page that is not in Persian.
 *
 * PROJECT_HANDOFF.md records exactly this and states hreflang is withheld for exactly this reason.
 * So there is one source for the answer, and it is not this file's to guess: `SeoFields.alternates`,
 * which the API derives from **which locales genuinely hold a translation row**. Where the API says
 * a translation exists, an alternate is emitted; where it says nothing, none is — and a page with
 * one translated locale correctly emits no `hreflang` at all, because a language annotation with a
 * single member describes nothing.
 *
 * `x-default` is emitted only alongside a real alternate set, pointing at the default locale, per
 * INTERNATIONALIZATION_STRATEGY.md §4.
 */

/** The site-relative canonical path for a locale-prefixed route. `path` starts with `/`. */
export function localePath(locale: string, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * One route's `alternates` metadata block.
 *
 * @param canonicalPath the site-relative path of THIS page, or an absolute URL when an editor set
 *   an explicit `canonicalUrl` override — both are accepted, because the contract permits either.
 * @param translations `SeoFields.alternates` when the page is backed by an entity the API describes,
 *   or `undefined` for a code-owned structural page, which has no translation record to consult.
 * @param defaultLocaleCode the platform default, from the `Locale` table. Required only to place
 *   `x-default`; when it is absent from `translations` no `x-default` is emitted, because pointing
 *   it at a locale the entity is not translated into would be the same false signal in one tag.
 * @param pathForLocale builds a locale's own path from its own slug. Structural routes ignore the
 *   slug; a product or an article uses it, because their slugs are localized.
 */
export function pageAlternates({
  canonicalPath,
  translations,
  defaultLocaleCode,
  pathForLocale,
}: {
  readonly canonicalPath: string;
  readonly translations?: readonly SeoAlternate[] | undefined;
  readonly defaultLocaleCode?: string | undefined;
  readonly pathForLocale?: ((locale: string, slug: string) => string) | undefined;
}): NonNullable<Metadata["alternates"]> {
  const canonical = absoluteUrl(canonicalPath);

  /*
   * Fewer than two translated locales means there is nothing to annotate: `hreflang` describes a
   * SET of equivalent pages, and a set of one is the page itself. This is also the state every
   * entity on the platform is in today, so the common case emits a canonical and nothing else.
   */
  if (translations === undefined || translations.length < 2 || pathForLocale === undefined) {
    return { canonical };
  }

  const languages: Record<string, string> = {};

  for (const alternate of translations) {
    languages[alternate.locale] = absoluteUrl(pathForLocale(alternate.locale, alternate.slug));
  }

  const fallback =
    defaultLocaleCode === undefined
      ? undefined
      : translations.find((alternate) => alternate.locale === defaultLocaleCode);

  if (fallback !== undefined) {
    languages["x-default"] = absoluteUrl(pathForLocale(fallback.locale, fallback.slug));
  }

  return { canonical, languages };
}

/**
 * The alternates block for a **code-owned structural route** — canonical only.
 *
 * A named wrapper rather than a bare `pageAlternates` call, so the omission of `hreflang` reads as
 * the decision recorded above rather than as something forgotten at one of a dozen call sites. When
 * the structural copy is translated, this function grows an alternates set and every route that
 * uses it gains one at the same moment.
 */
export function structuralAlternates(
  locale: string,
  path: string,
): NonNullable<Metadata["alternates"]> {
  return pageAlternates({ canonicalPath: localePath(locale, path) });
}
