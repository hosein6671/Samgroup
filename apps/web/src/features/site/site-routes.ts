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
 * **These routes do not resolve yet.** `apps/web` currently serves only the design proof; the
 * pages themselves are M3 work. Centralising them here means the header is already correct and
 * the lift is a prefix, not a rewrite.
 */

import type { ContentRouteKey, ProductFamilyKey } from "@sam-group/types";

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

/**
 * Launch locales — **a presentational fixture for the language switcher, and nothing else.**
 *
 * **This is NOT the routing locale source.** That is `GET /api/v1/locales`, read through
 * `lib/locales.ts`, which generates the `[locale]` route set, sets `<html lang dir>` and drives
 * middleware negotiation. Nothing in the routing layer may read this constant, and it must never
 * be used as a fallback when the API is unavailable — a build with no locale source fails loudly
 * by decision.
 *
 * It remains only because `site-nav.tsx`'s switcher still consumes it, and the switcher is
 * presentational (it marks the current locale and navigates nowhere). It is left unreshaped on
 * purpose: its fields are `label`/`native` where the endpoint serves `name`/`nativeName`, so this
 * is a shape-alike rather than a stale copy, and reconciling the two is the gate that makes the
 * switcher navigate.
 */
export type Locale = {
  readonly code: string;
  readonly label: string;
  readonly native: string;
  readonly direction: "ltr" | "rtl";
  readonly isDefault: boolean;
};

export const LOCALES: readonly Locale[] = [
  { code: "en", label: "English", native: "English", direction: "ltr", isDefault: true },
  { code: "fa", label: "Persian", native: "فارسی", direction: "rtl", isDefault: false },
  { code: "ar", label: "Arabic", native: "العربية", direction: "rtl", isDefault: false },
] as const;

/**
 * Footer navigation columns.
 *
 * Moved here verbatim from `features/home/home-data.ts` when the footer became site-level: it is
 * navigation data, the same category as `PRIMARY_NAV` above, not homepage editorial content.
 *
 * **The Products column's hrefs are homepage in-page anchors, and are unchanged.** On any page
 * other than the homepage they resolve to nothing, which is the same proof-stage state the header
 * is already in (every `ROUTES` entry above 404s today). Both are fixed by the same later work:
 * real routes. Do not paper over it by hardcoding a proof path here.
 *
 * ── The Company column now consumes `SECONDARY_NAV` ─────────────────────────
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
    links: [
      { href: "#products", label: "Base oils" },
      { href: "#products", label: "Lubricants" },
      { href: "#products", label: "Industrial fluids" },
      { href: "#products", label: "Automotive" },
      { href: "#products", label: "Specialty" },
    ],
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
  const path = CONTENT_ROUTE_HREFS[route];

  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
