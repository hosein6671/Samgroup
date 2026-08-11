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
} as const;

/** The six product families, in the order SITE_STRUCTURE §4 lists them. */
export const PRODUCT_CATEGORIES: readonly { readonly label: string; readonly href: string }[] = [
  { label: "Base Oils", href: "/products/base-oils" },
  { label: "Lubricant Additives & Components", href: "/products/lubricant-additives" },
  {
    label: "Engine Oils & Automotive Lubricants",
    href: "/products/engine-oils-automotive-lubricants",
  },
  { label: "Industrial Oils & Lubricants", href: "/products/industrial-oils-lubricants" },
  { label: "Marine Oils & Lubricants", href: "/products/marine-oils-lubricants" },
  { label: "Antifreeze & Coolants", href: "/products/antifreeze-coolants" },
] as const;

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
 * Launch locales, in the shape `GET /api/v1/locales` returns.
 *
 * A fixture, not a hardcoded list: the locale set is data in a `Locale` table and adding a
 * language must never require a code change (PROJECT_HANDOFF §6.9). Keeping it in this shape
 * means the switcher is wired to a fetch in M2 by replacing this constant, not by rewriting the
 * component.
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
