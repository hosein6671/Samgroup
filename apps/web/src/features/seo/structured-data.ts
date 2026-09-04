import { ORGANIZATION_NAME, absoluteUrl, organizationId, siteOrigin, webSiteId } from "./site";

import type { JsonLdObject } from "./json-ld";

/**
 * The structured-data builders — SEO_ARCHITECTURE.md §8's type table, and nothing beyond it.
 *
 * ── Every value here is already published elsewhere on the site ─────────────
 *
 * §9 states the rule this file is held to: a page's JSON-LD must be consistent with its visible
 * content, and a mismatch is worse than no structured data at all. So nothing in here is sourced
 * from anywhere but values the platform already renders — the organization's short name, its own
 * origin, its own logo file, and per-page values the caller has already put on the page.
 *
 * **No company fact is asserted.** There is no `address`, no `telephone`, no `email`, no `sameAs`,
 * no `foundingDate`, no `numberOfEmployees` and no `areaServed` in the organization node below,
 * because none of those is confirmed in this repository — SITE_STRUCTURE.md's Outstanding
 * Confirmations still lists the head-office address, the phone numbers and the email addresses as
 * unresolved. The Contact Us page adds `telephone`, `email`, `address` and `sameAs` to the **same
 * `@id`** when, and only when, the CMS is actually serving them; consumers merge nodes by `@id`, so
 * the two halves compose into one entity without either one inventing the other's data.
 */

/**
 * `Organization` — the site-wide identity, emitted once per page by the locale layout.
 *
 * `logo` points at `public/brand/sam-group-mark.png`, which is a real file in this repository and
 * the same mark the header and footer render.
 */
export function organizationJsonLd(): JsonLdObject {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: ORGANIZATION_NAME,
    url: `${siteOrigin()}/`,
    logo: absoluteUrl("/brand/sam-group-mark.png"),
  };
}

/**
 * `WebSite` — the site-wide node, emitted beside `Organization`.
 *
 * **No `potentialAction`/`SearchAction`.** That property advertises a site-search endpoint, and
 * this platform has none: the Product Finder filters a catalog on two backend-authoritative axes
 * and is not a site search. Declaring one would point a crawler at a URL template that does not
 * answer.
 *
 * `inLanguage` carries the route's own locale, so the three locale trees each describe themselves
 * rather than all claiming the default.
 */
export function webSiteJsonLd(locale: string): JsonLdObject {
  return {
    "@type": "WebSite",
    "@id": webSiteId(),
    name: ORGANIZATION_NAME,
    url: `${siteOrigin()}/`,
    inLanguage: locale,
    publisher: { "@id": organizationId() },
  };
}

/**
 * The site-wide graph both nodes travel in, ready for `<JsonLd>`.
 *
 * One `@graph` rather than two scripts: it is one document describing two linked entities, and the
 * `publisher` reference above only resolves cleanly when both are in the same graph.
 */
export function siteJsonLd(locale: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), webSiteJsonLd(locale)],
  };
}

/** One crumb, as a caller describes it: a visible name and the page it points at. */
export type Breadcrumb = {
  readonly name: string;
  /** Site-relative, locale-prefixed. The last crumb — the current page — is included. */
  readonly path: string;
};

/**
 * `BreadcrumbList` — SEO_ARCHITECTURE.md §8, "every page with a real hierarchy".
 *
 * `position` is 1-based and assigned here rather than by the caller, so a list cannot be emitted
 * with a gap or a duplicate. The trail must be the same one the page renders visibly: §4 requires
 * the visual breadcrumb and the structured data to be two views of one set of data, never two
 * independently maintained lists.
 */
export function breadcrumbJsonLd(trail: readonly Breadcrumb[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * `Article` — blog post detail pages, from the `BlogPost` record and nothing else.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 *
 * **No `author`.** `BlogPost` carries an `authorId`, but the endpoint does not serve an author name
 * and the platform renders none, so writing one would be inventing a byline — and an `author` that
 * contradicts the visible page is the §9 failure this file exists to avoid. `publisher` carries the
 * organization instead, which is true and is what the page itself signals.
 *
 * **No `dateModified`.** The API serves `publishedAt` and no modification timestamp; substituting
 * the published date would assert the article has never been revised, which nothing here knows.
 *
 * **`image` only when the post has one.** Omitted rather than filled with a site logo or a stock
 * asset, which is what turns a rich result into a misleading one.
 */
export function articleJsonLd({
  url,
  headline,
  description,
  datePublished,
  locale,
  imageUrl,
}: {
  readonly url: string;
  readonly headline: string;
  readonly description?: string | null;
  /** ISO 8601, straight from `BlogPostResponse.publishedAt`. */
  readonly datePublished: string;
  readonly locale: string;
  readonly imageUrl?: string | null;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    url,
    headline,
    ...(description !== undefined && description !== null && description !== ""
      ? { description }
      : {}),
    datePublished,
    inLanguage: locale,
    ...(imageUrl !== undefined && imageUrl !== null && imageUrl !== ""
      ? { image: absoluteUrl(imageUrl) }
      : {}),
    publisher: { "@id": organizationId() },
    isPartOf: { "@id": webSiteId() },
  };
}

/**
 * `CollectionPage` — an index that lists other pages, such as Insights.
 *
 * The generic §8 `WebPage` type with the one refinement that is factually true of a listing route.
 * It asserts nothing about what the list contains, because the contents vary per request and per
 * locale and the page already renders them.
 */
export function collectionPageJsonLd({
  url,
  name,
  description,
  locale,
}: {
  readonly url: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly locale: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collectionpage`,
    url,
    name,
    ...(description === undefined ? {} : { description }),
    inLanguage: locale,
    isPartOf: { "@id": webSiteId() },
  };
}

/**
 * `WebPage` — §8's base type, for a structural route with no more specific type.
 *
 * Used by the routes that previously emitted no structured data at all. It carries only the page's
 * own address, its own title and its own language.
 */
export function webPageJsonLd({
  url,
  name,
  description,
  locale,
}: {
  readonly url: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly locale: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    ...(description === undefined ? {} : { description }),
    inLanguage: locale,
    isPartOf: { "@id": webSiteId() },
  };
}
