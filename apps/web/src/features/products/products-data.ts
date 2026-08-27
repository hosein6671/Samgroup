/**
 * Products landing page content, as fixtures.
 *
 * Same contract as `features/home/home-data.ts`: every export is the *shape* of a real fetch, so
 * wiring this to `GET /api/v1/categories` later is a swap of this module, not a rewrite of the
 * components. A hardcoded repeating list in JSX is the one pattern the project forbids outright
 * (PROJECT_HANDOFF §6.7).
 *
 * ── Where the content comes from, and what is deliberately absent ────────────
 *
 * **The six categories, their order, their URLs and their range taxonomies are not invented.**
 * They are transcribed from `docs/SITE_STRUCTURE.md` §4 — the sitemap rows and the
 * "Distinguishing content" column — and the URLs are re-exported from `features/site/site-routes`
 * rather than retyped, so the two can never drift.
 *
 * **The one-line descriptors are restrained by instruction.** No source document supplies
 * approved marketing copy for this page, so each `descriptor` does nothing but describe the
 * taxonomy directly above it. There are deliberately **no** capacities, tonnages, market
 * positions, customer counts, lead times, certifications or performance claims anywhere in this
 * file — those are commercial facts, and CLAUDE.md §4 forbids seeding an unverified one into a
 * page. When real copy is approved it replaces `descriptor` and nothing else moves.
 *
 * **`grades` are counts of nothing.** Each category page renders its grades as sections within
 * itself (SITE_STRUCTURE §4); this page names the ranges and never claims how many SKUs exist.
 */

import { PRODUCT_CATEGORIES, ROUTES } from "@/features/site/site-routes";

export type ProductFamily = {
  /**
   * The family's one and only identifier — its **default-locale `Category.slug`**.
   *
   * The same value is the `/products/{slug}` route segment, the key in the category content
   * registry, the Payload `categoryKey`, and the `slug` this record arrives under when the fetch
   * is real. Not a UI-local handle that happens to resemble one: three of these ids were shorter
   * than their own routes until this was settled, which is why the invariant below is now checked
   * rather than intended.
   *
   * **Localized slugs are not this.** A category is reachable in `fa`/`ar` at a translated slug,
   * resolved server-side to the same row; that never becomes a key on this side.
   */
  readonly id: string;
  /** Two-letter register mark, as used on the homepage's family set. Presentational only. */
  readonly code: string;
  readonly name: string;
  readonly href: string;
  /** Descriptive, claim-free. See the note above. */
  readonly descriptor: string;
  /** The sub-ranges named for this category in SITE_STRUCTURE §4. */
  readonly ranges: readonly string[];
  /**
   * A single named block that is unique to this category, where the source document names one.
   * Only Base Oils has one today ("Thin Film Polishing"); the rest are intentionally undefined
   * rather than padded with invented equivalents.
   */
  readonly namedBlock?: string;
};

/**
 * Indexed by position against `PRODUCT_CATEGORIES` so the label and href always come from the
 * canonical route table. If a category is ever added or reordered there, this list fails to
 * compile rather than silently disagreeing with the header's mega menu.
 */
const href = (index: number): string => {
  const entry = PRODUCT_CATEGORIES[index];
  if (!entry) throw new Error(`No product category at index ${index} in site-routes.ts`);
  return entry.href;
};

export const FAMILIES: readonly ProductFamily[] = [
  {
    id: "base-oils",
    code: "BO",
    name: "Base Oils",
    href: href(0),
    descriptor:
      "Paraffinic and naphthenic base stocks across API Groups I to III, together with bright stock and synthetic base fluids.",
    ranges: [
      "Group I · SN 150 / 350 / 500 / 650",
      "Group II",
      "Group III",
      "Naphthenic",
      "Bright Stock · BS 150",
      "Synthetics · PAO / Ester / PAG",
      "Virgin & re-refined grades",
    ],
    namedBlock: "Thin Film Polishing",
  },
  {
    id: "lubricant-additives",
    code: "LA",
    name: "Lubricant Additives & Components",
    href: href(1),
    descriptor:
      "Additive packages organised by the application they are formulated for, alongside the base components that go into a finished blend.",
    ranges: [
      "Gasoline engine oil packages",
      "Diesel engine oil packages",
      "Driveline & gear packages",
      "ATF packages",
      "Grease packages",
      "Anti-freeze packages",
      "Brake fluid packages",
      "Fuel additives",
      "Transformer oil",
      "White oil",
      "Rubber process oil",
    ],
  },
  {
    id: "engine-oils-automotive-lubricants",
    code: "EO",
    name: "Engine Oils & Automotive Lubricants",
    href: href(2),
    descriptor:
      "Segmented by vehicle type first and fluid type second, so a fleet operator reads the range the way they run it.",
    ranges: [
      "Passenger cars",
      "Trucks & buses",
      "Motorcycle & ATV",
      "Agriculture",
      "Construction & mining",
      "Gardening",
    ],
  },
  {
    id: "industrial-oils-lubricants",
    code: "IO",
    name: "Industrial Oils & Lubricants",
    href: href(3),
    descriptor: "Plant fluids grouped by the machine they serve rather than by viscosity alone.",
    ranges: [
      "Hydraulic",
      "Gear",
      "Compressor",
      "Cutting & metalworking",
      "Heat transfer",
      "Pneumatic",
      "Slideway",
      "Stationary engine oils",
      "Industrial greases",
    ],
  },
  {
    id: "marine-oils-lubricants",
    code: "MO",
    name: "Marine Oils & Lubricants",
    href: href(4),
    descriptor: "Engine-room and deck fluids for two- and four-stroke marine propulsion.",
    ranges: [
      "TPEO",
      "Cylinder oils",
      "System oils",
      "Stern tube & gear oils",
      "Deck hydraulic",
      "Marine greases",
    ],
  },
  {
    id: "antifreeze-coolants",
    code: "AC",
    name: "Antifreeze & Coolants",
    href: href(5),
    descriptor:
      "Organised by base fluid and inhibitor technology, supplied as concentrate or ready-to-use.",
    ranges: [
      "MEG base",
      "MPG base",
      "IAT inhibitor",
      "OAT inhibitor",
      "HOAT inhibitor",
      "Si-OAT inhibitor",
      "NAP-free",
      "Concentrate or ready-to-use",
    ],
  },
];

/**
 * A family's id **is** its route segment. Checked, not assumed.
 *
 * `href(index)` above binds this list to the canonical route table by *position*, so a category
 * added or reordered in `site-routes.ts` fails loudly. It never compared the id, and for three of
 * the six families the id and the route segment had silently diverged — `engine-oils` against
 * `/products/engine-oils-automotive-lubricants`, and the same for industrial and marine. The
 * remaining three agreed by coincidence rather than by rule.
 *
 * That divergence is only visible once something joins on the id: `Category.slug` is simultaneously
 * the route segment, the registry key and the Payload join key, so an id that is not the slug is an
 * id that cannot be fetched with. Position alone cannot catch it. This can.
 *
 * Runs at module load, like `href` and like `application-fields.ts`'s range check — a future family
 * whose id drifts from its route fails the render rather than shipping a page that cannot fetch.
 */
for (const family of FAMILIES) {
  const expected = `${ROUTES.products}/${family.id}`;
  if (family.href !== expected) {
    throw new Error(
      `Product family "${family.id}" is routed at "${family.href}", not "${expected}". ` +
        "A family's id is its default-locale Category.slug, which is also its route segment.",
    );
  }
}

/* ------------------------------------------------------------------ finder */

/**
 * The Product Finder's facets.
 *
 * Exactly the four SITE_STRUCTURE §3 names — "filter by category/industry/application/packaging,
 * search by grade name". The finder itself is its own route (`/products/finder`); this page shows
 * what it filters on and links to it, per FRONTEND_ARCHITECTURE §105's `ProductFinderTeaser`.
 *
 * `sample` values are illustrative facet *labels*, not a claim that these are the values the
 * catalogue will hold — the real option lists come from the catalogue endpoints.
 */
export type Facet = {
  readonly name: string;
  readonly sample: readonly string[];
};

export const FINDER_FACETS: readonly Facet[] = [
  { name: "Product family", sample: ["Base Oils", "Industrial", "Marine"] },
  { name: "Buyer segment", sample: ["Passenger Cars", "Industry", "Marine"] },
];

/* ----------------------------------------------------------- documentation */

/**
 * The Documentation block's two tiers.
 *
 * **The split is a frozen decision, and it contradicts a lower-priority document.**
 * SITE_STRUCTURE §3 summarises this block as "TDS/SDS/COA download, gated behind a short
 * qualifying form". The approved data-model decision is narrower and explicit: gating covers the
 * Company Catalogue and Product Catalogue **only**, and "TDS and SDS are explicitly not gated"
 * (DATA_MODEL.md §`DOWNLOAD_REQUEST`, DATA_MODEL_GAP_REVIEW.md items 5 and 4 of the summary).
 * CLAUDE.md §1 ranks that above SITE_STRUCTURE, so the narrow scope is what this page implements
 * — technical documents open, catalogue gated. Flagged in the report rather than resolved
 * silently.
 */
export type DocumentTier = {
  readonly kind: "open" | "gated";
  readonly heading: string;
  readonly note: string;
  readonly items: readonly { readonly label: string; readonly meta: string }[];
};

export const DOCUMENT_TIERS: readonly DocumentTier[] = [
  {
    kind: "open",
    heading: "Technical documents",
    note: "No form, no gate. A specification you cannot read before enquiring is not a specification.",
    items: [
      { label: "Technical Data Sheet", meta: "TDS · per grade" },
      { label: "Safety Data Sheet", meta: "SDS · per grade" },
      { label: "Certificate of Analysis", meta: "COA · per batch" },
    ],
  },
  {
    kind: "gated",
    heading: "Catalogue",
    note: "The full catalogue is released against a short qualifying form.",
    items: [
      { label: "Company Catalogue", meta: "PDF" },
      { label: "Product Catalogue", meta: "PDF" },
    ],
  },
];

/* ------------------------------------------------------------- closing CTA */

/**
 * The three routes out of the Products landing, in ascending order of commitment.
 *
 * That order is the section's whole structure — browse, sample, buy — and it is why they are a
 * list here rather than three hand-written rows: the staircase in `products.css` steps off the
 * index, so adding or reordering a route re-draws the device instead of breaking it.
 *
 * `href` is left to the component, which reads the canonical `ROUTES` table. Nothing routing-
 * related is restated in this file.
 *
 * SITE_STRUCTURE §3's own answer to this section's heading — Request Custom Solution — is not in
 * this list on purpose. It is the primary action beside it, not one of three peers.
 */
export type ClosingRoute = {
  readonly id: "finder" | "sample" | "quote";
  readonly label: string;
  readonly qualifier: string;
};

export const CLOSING_ROUTES: readonly ClosingRoute[] = [
  {
    id: "finder",
    label: "View Product Finder",
    qualifier: "Narrow the range by parameter, or search a grade by name.",
  },
  {
    id: "sample",
    label: "Request a sample",
    qualifier: "Opens an enquiry — tell us the grade and the application.",
  },
  {
    id: "quote",
    label: "Request a quote",
    qualifier: "Volumes, packaging and Incoterms against a specific grade.",
  },
];

/**
 * The qualifying form's fields, exactly the set the approved `DownloadRequest` entity records:
 * name, company, country, email, plus consent (DATA_MODEL_GAP_REVIEW.md §5 "Required fields").
 * Nothing extra — every additional field on a lead form is a field the lead does not fill in.
 */
export const DOWNLOAD_FIELDS: readonly {
  readonly name: string;
  readonly label: string;
  readonly type: "text" | "email";
  readonly autoComplete: string;
}[] = [
  { name: "name", label: "Name", type: "text", autoComplete: "name" },
  { name: "company", label: "Company", type: "text", autoComplete: "organization" },
  { name: "country", label: "Country", type: "text", autoComplete: "country-name" },
  { name: "email", label: "Work email", type: "email", autoComplete: "email" },
];
