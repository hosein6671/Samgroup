/**
 * Canonical site routes and header information architecture.
 *
 * Every path here is taken verbatim from `docs/SITE_STRUCTURE.md` — the sitemap table and the
 * six product-category rows. Nothing is invented, and there are deliberately **no
 * product-detail routes**: SITE_STRUCTURE §4 is explicit that each of the six product lines is
 * one rich category page with grades as sections inside it, not a listing plus per-SKU pages
 * (FRONTEND_ARCHITECTURE §1 confirms there is no `[productSlug]` segment).
 *
 * Structural page URLs stay fixed English across every locale; only products, categories and
 * blog articles get localised slugs (PROJECT_HANDOFF §6.12). So these constants are correct
 * as-is once the `[locale]` prefix is added in front of them.
 *
 * **The prefix is applied here and nowhere else.** Every constant below is the locale-less
 * structural path; `localeHref` at the foot of this file is the one function that turns one into a
 * URL, and `SiteNav`, `SiteFooter` and `contentRouteHref` all go through it. Two copies of a
 * prefix rule is two places for `/en/en/products` to come from.
 */

import type { ContentRouteKey, LocaleResponse, ProductFamilyKey } from "@sam-group/types";

export const ROUTES = {
  home: "/",
  products: "/products",
  productFinder: "/products/finder",
  /** The gated TDS/SDS/COA block on the Products landing page. It has no route of its own. */
  documentation: "/products#documentation",
  customizedSolutions: "/customized-solutions",
  exportLogistics: "/export-logistics",
  qualityCertifications: "/quality-certifications",
  aboutUs: "/about-us",
  insights: "/insights",
  contactUs: "/contact-us",
  requestQuote: "/contact-us/request-a-quote",
  /**
   * The canonical Privacy Policy — `/{locale}/privacy-policy`, per SITE_STRUCTURE §0 and
   * FRONTEND_ARCHITECTURE §1.
   *
   * **Present here, and deliberately linked from nowhere.** The route is implemented and reads the
   * Content API, but no approved Privacy Policy text exists in the CMS, so it answers 404 in every
   * locale until an editor publishes one after legal review (SITE_STRUCTURE §12). Adding it to the
   * header, the footer or a form's consent label today would create a link to a 404 beside a
   * consent checkbox, which is worse than the plain wording those labels already carry — see
   * `features/forms/inquiry-form.tsx`. Linking it is part of the gate that has the content.
   *
   * It belongs in this constant regardless: `middleware.ts` derives `STRUCTURAL_SEGMENTS` from
   * these values, and that is what makes locale-less `/privacy-policy` negotiate a locale and
   * redirect to `/{locale}/privacy-policy` instead of falling through to a 404.
   */
  privacyPolicy: "/privacy-policy",
} as const;

/**
 * One Product Family, as this application navigates it.
 *
 * `key` is the **canonical ADR-009 identifier** — the same string that is the default-locale
 * `Category.slug` in `sam_platform`, the `/{locale}/products/{slug}` route segment, and Payload's
 * `categoryKey`. It is the only part of a family the CMS is ever allowed to hold; `label` and `href`
 * are this table's, and stay this table's.
 */
export type ProductFamilyEntry = {
  readonly key: ProductFamilyKey;
  readonly label: string;
  readonly href: string;
};

/** The six product families, in the order SITE_STRUCTURE §4 lists them. */
export const PRODUCT_CATEGORIES: readonly ProductFamilyEntry[] = [
  { key: "base-oils", label: "Base Oils", href: "/products/base-oils" },
  {
    key: "lubricant-additives",
    label: "Lubricant Additives & Components",
    href: "/products/lubricant-additives",
  },
  {
    key: "engine-oils-automotive-lubricants",
    label: "Engine Oils & Automotive Lubricants",
    href: "/products/engine-oils-automotive-lubricants",
  },
  {
    key: "industrial-oils-lubricants",
    label: "Industrial Oils & Lubricants",
    href: "/products/industrial-oils-lubricants",
  },
  {
    key: "marine-oils-lubricants",
    label: "Marine Oils & Lubricants",
    href: "/products/marine-oils-lubricants",
  },
  {
    key: "antifreeze-coolants",
    label: "Antifreeze & Coolants",
    href: "/products/antifreeze-coolants",
  },
] as const;

/**
 * A Product Family key, as the family this application knows — or `undefined`.
 *
 * ── Why this exists, and why it may answer `undefined` ─────────────────────
 *
 * The Quality page's sampling policy is confirmed for some families and not others, and **which**
 * is editorial: it lives in the CMS. What lives there is a *key* and nothing else — Payload may
 * never mirror a Prisma-owned entity (ADR-002), so a family's published name and its page address
 * come from this table, exactly as a `ContentRouteKey`'s path does.
 *
 * `undefined` is the honest answer for a key this table does not know, and there is deliberately no
 * fallback: rendering a family whose name and address are guesses would be worse than rendering one
 * fewer. The API already drops any key outside the frozen six, so this is the second of two guards,
 * not the only one.
 */
export function productFamilyByKey(key: string): ProductFamilyEntry | undefined {
  return PRODUCT_CATEGORIES.find((family) => family.key === key);
}

/**
 * Primary navigation. Products carries the mega menu; everything else is a flat link, exactly
 * as SITE_STRUCTURE's Global Components sheet specifies.
 */
export type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly mega?: true;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: "Home Page", href: ROUTES.home },
  { label: "Products", href: ROUTES.products, mega: true },
  { label: "Customized Solutions", href: ROUTES.customizedSolutions },
  { label: "Export & Logistics", href: ROUTES.exportLogistics },
  { label: "Contact Us", href: ROUTES.contactUs },
] as const;

/**
 * Deliberately **not** in the primary header: Quality & Certifications, About Us, Insights.
 *
 * That is a header-density decision, not an architecture change — all three remain first-class
 * pages in `ROUTES` above and in SITE_STRUCTURE's sitemap, and they are expected to be reached
 * through the footer or secondary navigation. Nothing here removes them from the site.
 *
 * Kept as an explicit export so the omission reads as intent rather than as something dropped,
 * and so the footer can consume the same list when secondary navigation is built.
 *
 * **The footer now consumes it** — see `FOOTER_COLUMNS` below. That is what activates this list:
 * until the About Us page was built, nothing on the platform linked to any of these three.
 */
export const SECONDARY_NAV: readonly NavItem[] = [
  { label: "Quality & Certifications", href: ROUTES.qualityCertifications },
  { label: "About Us", href: ROUTES.aboutUs },
  { label: "Insights", href: ROUTES.insights },
] as const;

/*
 * The `LOCALES` fixture that stood here is **deleted**, not relocated.
 *
 * It was a `{ code, label, native, direction, isDefault }` shape-alike of the locale endpoint,
 * kept alive by one consumer: the switcher, which was presentational and navigated nowhere. The
 * switcher now navigates, and the moment it does, a second list of locales in code becomes a
 * second answer to a question `lib/locales.ts` documents as having exactly one — `GET /locales`,
 * read from the `Locale` table. A switcher offering a locale the table does not have would emit a
 * URL `app/[locale]/layout.tsx` answers with a 404, from a build that reported success.
 *
 * So the active set arrives as a prop, from the Server Component boundary, and nothing in this
 * file holds a locale code. `localeHref` below takes one; it never sources one.
 */

/**
 * Footer navigation columns.
 *
 * Moved here verbatim from `features/home/home-data.ts` when the footer became site-level: it is
 * navigation data, the same category as `PRIMARY_NAV` above, not homepage editorial content.
 *
 * ── The Products column now consumes `PRODUCT_CATEGORIES` ──────────────────
 *
 * It previously held five `#products` anchors labelled "Base oils", "Lubricants", "Industrial
 * fluids", "Automotive" and "Specialty". Two problems, and the second is the worse one:
 *
 * - **The anchor was dead off the homepage, and ambiguous on it.** `id="products"` exists twice on
 *   the platform — the homepage's ecosystem band and a Family page's catalog section — so one
 *   href pointed at two unrelated sections and at nothing on the other twelve routes.
 * - **Four of the five labels owned no route.** "Lubricants", "Industrial fluids", "Automotive"
 *   and "Specialty" are not families; they are loose groupings that no canonical URL serves. Five
 *   links to one anchor, four of them naming a destination that does not exist, is not navigation.
 *
 * The column now holds the **six frozen ADR-009 families**, with the labels and hrefs
 * `PRODUCT_CATEGORIES` already publishes in the header mega menu and on the Products landing
 * register. **No copy is invented and none is new to the platform** — this column is the third
 * consumer of a list the site already renders twice, and it is one fewer place for a family's
 * published name to drift. The homepage keeps its `#products` band; nothing now links to it from
 * the footer, which is the point.
 *
 * ── The Company column consumes `SECONDARY_NAV` ─────────────────────────────
 *
 * It previously held four homepage anchors — Manufacturing, Research, Export network, Insights —
 * which worked on the homepage and resolved to nothing on all four other pages. It now holds the
 * three corporate destinations `SECONDARY_NAV` already declared: Quality & Certifications, About
 * Us, Insights.
 *
 * This is what puts About Us on the platform at all; nothing linked to it before. The trade is
 * stated rather than hidden: the homepage loses one working anchor (`#insights`), and in exchange
 * four dead links become three canonical routes that resolve when the pages lift out of
 * `/design-proof`. Approved as a data-only change — the column count is fixed by
 * `.fs-fgrid` in CSS and `site-footer.tsx` already maps over this constant generically, so neither
 * file changes.
 */
export const FOOTER_COLUMNS: readonly {
  readonly heading: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}[] = [
  {
    heading: "Products",
    links: PRODUCT_CATEGORIES,
  },
  {
    heading: "Company",
    links: SECONDARY_NAV,
  },
];

/* ------------------------------------------------ CMS-supplied destinations */

/**
 * Where a CMS route key points, and the only place that mapping exists.
 *
 * An editorial call to action in Payload carries a **key** (`products`) rather than a path
 * (`/products`), because structural page URLs stay fixed English across locales and are owned by
 * this file, not by a CMS text field (PROJECT_HANDOFF §6.12). The CMS chooses the destination from
 * the site's own list; the site decides what that destination's URL is.
 *
 * The five keys are the ones the About Us Global offers. A key the CMS could never send is not
 * listed, and a key this table does not know cannot be rendered — `contentRouteHref` has no
 * fallback URL for exactly that reason.
 */
const CONTENT_ROUTE_HREFS: Readonly<Record<ContentRouteKey, string>> = {
  products: ROUTES.products,
  "customized-solutions": ROUTES.customizedSolutions,
  "quality-certifications": ROUTES.qualityCertifications,
  "contact-us": ROUTES.contactUs,
  "request-a-quote": ROUTES.requestQuote,
};

/**
 * A CMS route key as a locale-prefixed path.
 *
 * The prefix is applied here rather than stored anywhere: one route, one path, three URLs, and the
 * locale is a request property. `ROUTES.home` is `/`, so the root case would otherwise produce a
 * trailing slash — no key maps to it today, and the join below stays correct if one ever does.
 */
export function contentRouteHref(locale: string, route: ContentRouteKey): string {
  return localeHref(locale, CONTENT_ROUTE_HREFS[route]);
}

/* ========================================================================== */
/* LOCALE-AWARE INTERNAL HREFS                                                */
/* ========================================================================== */

/**
 * The first path segment, or `""` for `/`.
 *
 * Stops at `/`, `?` **and** `#`, so `/products#documentation` reads `products` rather than
 * `products#documentation` — which is what keeps the guard in `localeHref` from being fooled by a
 * fragment, and what lets `structuralPathOf` recognise `/fa?x=1` as the `fa` home.
 */
function firstSegmentOf(path: string): string {
  const rest = path.slice(1);
  const end = rest.search(/[/?#]/);

  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Whether this application owns the address — i.e. whether prefixing it is even meaningful.
 *
 * A single leading `/` and nothing else. That excludes `https://…` and `mailto:` (no leading
 * slash), protocol-relative `//cdn…` (a different origin wearing a path's clothes), and a bare
 * `#fragment`, which is a position on the current page rather than a route.
 */
function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

/**
 * One internal structural path, addressed in one locale — **the only prefix rule on the platform.**
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Every constant in this file is locale-less by design (PROJECT_HANDOFF §6.12: structural page URLs
 * stay fixed English across locales). Until this gate, the header and footer rendered those
 * constants raw, so `/fa/quality-certifications` → "About Us" emitted `/about-us`, which
 * `middleware.ts` then re-negotiated from `Accept-Language` — and dropped the reader out of
 * Persian. The route's locale is authoritative; this function is how a component says so.
 *
 * ── What it deliberately is not ────────────────────────────────────────────
 *
 * Not a router, not a link builder, not a place to put route logic. It takes a locale code the
 * caller has already validated (the `[locale]` segment, or a record from `GET /locales`) and one
 * path this file already owns, and returns a string.
 *
 * - **Idempotent.** A path already addressed in `locale` is returned untouched, so no composition
 *   of callers can produce `/en/en/products`.
 * - **Query and fragment survive**, because they are part of the path string and this only
 *   prepends: `/products#documentation` → `/fa/products#documentation`.
 * - **External addresses pass through unchanged**, so a caller cannot accidentally rewrite one.
 * - **`ROUTES.home` is `/`**, which becomes `/${locale}` and never `/${locale}/` — a trailing
 *   slash would be a second URL for one page.
 */
export function localeHref(locale: string, path: string): string {
  if (!isInternalPath(path)) return path;
  if (firstSegmentOf(path) === locale) return path;

  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * A pathname with its leading locale segment removed — the structural path the nav compares against.
 *
 * `localeCodes` is the **active set**, supplied by the caller from `GET /locales`. A first segment
 * that is not in it is not a locale, so the pathname is returned whole: that is what happens on
 * `/design-proof/*`, which is not locale-routed, and the honest result there is that no navigation
 * item matches.
 */
export function structuralPathOf(pathname: string, localeCodes: readonly string[]): string {
  const first = firstSegmentOf(pathname);

  if (first === "" || !localeCodes.includes(first)) return pathname;

  const rest = pathname.slice(first.length + 1);

  return rest === "" ? ROUTES.home : rest;
}

/**
 * Whether a primary-navigation destination is the page currently being read.
 *
 * Exact, with **one** descendant rule: `/products/{slug}` and `/products/finder` are read as being
 * inside Products, so the Products item carries the state for the Family pages, the Product Detail
 * pages and the Finder. Nothing else descends — `/contact-us/request-a-quote` is its own
 * destination and does not light up Contact Us, because marking an ancestor of every nested route
 * is how two unrelated items end up both claiming to be current.
 *
 * `ROUTES.home` is `/`, which would otherwise be a prefix of everything; it is exact by construction.
 */
export function isNavHrefActive(structuralPath: string, href: string): boolean {
  if (href === ROUTES.home) return structuralPath === ROUTES.home;
  if (structuralPath === href) return true;
  if (href === ROUTES.products) return structuralPath.startsWith(`${ROUTES.products}/`);

  return false;
}

/** A navigation destination as a component renders it: resolved address, resolved state. */
export type ResolvedNavLink = {
  readonly label: string;
  readonly href: string;
  /** True on at most one item of a set — the caller renders `aria-current="page"` from it. */
  readonly current: boolean;
  readonly mega?: true;
};

/**
 * `PRIMARY_NAV`, addressed in one locale and marked against one path.
 *
 * The header maps over this rather than over `PRIMARY_NAV`, which is what keeps the prefix rule out
 * of `site-nav.tsx` — and out of `site-footer.tsx`, which uses the sibling builders below.
 */
export function primaryNavLinks(
  locale: string,
  structuralPath: string,
): readonly ResolvedNavLink[] {
  return PRIMARY_NAV.map((item) => ({
    label: item.label,
    href: localeHref(locale, item.href),
    current: isNavHrefActive(structuralPath, item.href),
    ...(item.mega === true ? { mega: item.mega } : {}),
  }));
}

/** The six families, addressed in one locale. Keys and labels are untouched — only the address. */
export function productFamilyLinks(
  locale: string,
): readonly { readonly key: ProductFamilyKey; readonly label: string; readonly href: string }[] {
  return PRODUCT_CATEGORIES.map((family) => ({
    key: family.key,
    label: family.label,
    href: localeHref(locale, family.href),
  }));
}

/** `FOOTER_COLUMNS`, addressed in one locale. */
export function footerColumnsFor(locale: string): readonly {
  readonly heading: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}[] {
  return FOOTER_COLUMNS.map((column) => ({
    heading: column.heading,
    links: column.links.map((link) => ({
      href: localeHref(locale, link.href),
      label: link.label,
    })),
  }));
}

/**
 * The same page, in another locale.
 *
 * **Only the leading locale segment is replaced.** The structural path, the query string and any
 * fragment travel unchanged, because switching language is not navigating somewhere else — a reader
 * filtering the Finder at `/fa/products/finder?segment=marine` expects `/ar/products/finder?segment=marine`,
 * not the Arabic homepage.
 *
 * `pathname` comes from `usePathname()` and `search` from `useSearchParams()`; neither carries a
 * fragment, so the fragment branch exists for correctness of the function rather than for a case
 * the header can currently produce.
 *
 * **The one case that cannot be answered structurally** is a pathname with no locale segment, which
 * on this platform means the `/design-proof` tree. There is no locale-addressed equivalent of a
 * proof URL and inventing one would be inventing a route, so the target is that locale's home —
 * a page that always exists. No route-specific fallback table is consulted, and none exists.
 */
export function switchLocaleHref(
  pathname: string,
  search: string,
  target: string,
  localeCodes: readonly string[],
): string {
  const hashAt = pathname.indexOf("#");
  const hash = hashAt === -1 ? "" : pathname.slice(hashAt);
  const path = hashAt === -1 ? pathname : pathname.slice(0, hashAt);

  const first = firstSegmentOf(path);

  if (!localeCodes.includes(first)) return `/${target}`;

  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  const query = trimmed === "" ? "" : `?${trimmed}`;

  return `/${target}${path.slice(first.length + 1)}${query}${hash}`;
}

/** One entry of the language switcher, resolved against the current address. */
export type LocaleChoice = {
  readonly code: string;
  /** The language's name in itself — the label a switcher shows. From `GET /locales`. */
  readonly nativeName: string;
  readonly direction: LocaleResponse["direction"];
  readonly href: string;
  readonly current: boolean;
};

/**
 * The language switcher's entire model.
 *
 * `locales` is the **active set from `GET /locales`**, threaded in from the Server Component
 * boundary. This function has no locale literal, no fixture and no default: it can only offer what
 * the `Locale` table says exists, so the switcher cannot emit a URL `app/[locale]/layout.tsx`
 * answers with a 404.
 *
 * ── The three parts of the current address ─────────────────────────────────
 *
 * `pathname` and `search` come from `usePathname()` and `useSearchParams()`. **Neither carries the
 * fragment** — the hash is browser state that never reaches the server, so it has to be read on the
 * client and passed in here (see `LanguageMenu` in `site-nav.tsx` for how, and why it is a state
 * value rather than a render-time read).
 *
 * `hash` defaults to `""`, which is the honest value during a server render and during the first
 * client render: the fragment is genuinely unknown at that point, and guessing one would be worse
 * than omitting it. A bare `"#"` is treated as no fragment, and a value without the leading `#` is
 * accepted — `switchLocaleHref` is then given the whole address and puts the query before the
 * fragment.
 */
export function localeChoices(
  locales: readonly LocaleResponse[],
  locale: string,
  pathname: string,
  search: string,
  hash = "",
): readonly LocaleChoice[] {
  const codes = locales.map((entry) => entry.code);
  const fragment = hash === "" || hash === "#" ? "" : hash.startsWith("#") ? hash : `#${hash}`;
  const address = `${pathname}${fragment}`;

  return locales.map((entry) => ({
    code: entry.code,
    nativeName: entry.nativeName,
    direction: entry.direction,
    href: switchLocaleHref(address, search, entry.code, codes),
    current: entry.code === locale,
  }));
}
