/**
 * Lubricant Additives & Components — the template's fifth instance, and the second input category.
 *
 * ── What this category tests ────────────────────────────────────────────────
 *
 * Two things nothing before it did. It is the **second** category to render the downstream
 * manifold, which is what took the `fields()` guard out of the Base Oils fixture and into a module
 * of its own — one validation rule, one place. And it is the first whose two axes are not
 * specification families but **product groups**: the frozen row names "additive packages by
 * application" *plus* "lubricant components", which is one category holding two different kinds of
 * thing rather than one kind described two ways.
 *
 * Both were absorbed by mechanisms that already existed. No contract field was added for it.
 *
 * ── Where every string here comes from ──────────────────────────────────────
 *
 * The taxonomy is transcribed from `docs/SITE_STRUCTURE.md` §4, Lubricant Additives row: "Additive
 * packages by application (gasoline/diesel engine oil, driveline, gear, ATF, grease, anti-freeze,
 * brake fluid, fuel) + lubricant components (transformer oil, white oil, rubber process oil)".
 * Eleven sub-ranges in two groups, and nothing else is a product. The split into eight and three
 * is the source row's own "+", not a grouping composed here.
 *
 * Both property axes are drawn from §7's laboratory list and nothing else. Values are unpublished
 * on both, exactly as on the four pages before this one.
 *
 * ── What is not here, and why ───────────────────────────────────────────────
 *
 * **No treat rate.** The single most expected number on an additive-package page is the percentage
 * it is dosed at, and no project document contains one for any package. It is not a field on this
 * page and there is nowhere to put one.
 *
 * **No performance-level claim.** API service categories, ACEA sequences, OEM approvals, JASO,
 * ILSAC, DEXRON, NLGI grades — an additive package is normally sold against exactly these, and
 * **not one of them appears in any document in this project**. Publishing one would be publishing a
 * qualification this business has not been documented as holding, which is the most damaging class
 * of invented content this page could carry. None is printed, and none is implied.
 *
 * **No compatibility claim.** Nothing here states that a package is compatible with a base stock,
 * a group, another additive, an engine or a manufacturer.
 *
 * No numerical values, no test methods, no test conditions, no certifications, no capacity, no
 * MOQ, no lead time, no market list.
 *
 * **No sampling claim.** §7's sampling policy names base oil and engine oil. It does not name
 * additives, so neither the Overview marker nor the FAQ entry that carry it on Base Oils appears
 * here.
 *
 * **No named process.** §4 item 5 gives that block to Base Oils alone.
 *
 * **No classification axes.** No approved document gives this category a formal classification
 * system, so the strip does not render.
 */

import type { ProductCategoryContent } from "../category-contract";

/*
 * The shared downstream guard. Base Oils declared it privately when it was the only input
 * category; this is the second, which is why it now lives in a module both import.
 */
import { fields } from "./application-fields";
import {
  INCOTERMS,
  METHOD_NOTE,
  PENDING_NOTE,
  QUALITY_FOOTNOTE,
  QUALITY_STAGES,
  SUPPLY_FORMATS,
} from "./defaults";

/**
 * The two groups the frozen row itself names — "additive packages … + lubricant components".
 *
 * Not specification families in the sense Industrial Oils and Marine Oils use the word: those
 * split one kind of product across two measurement sets. These are two different kinds of product
 * published in one category, which is why the hero calls them product groups.
 */
const PACKAGES = "Additive packages";
const COMPONENTS = "Components";

export const LUBRICANT_ADDITIVES: ProductCategoryContent = {
  familyId: "lubricant-additives",
  meta: {
    title: "Lubricant Additives & Components — Sam Group",
    description:
      "Additive packages by application — engine oil, driveline and gear, ATF, grease, anti-freeze, brake fluid and fuel — with transformer oil, white oil and rubber process oil.",
  },

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Packages by application, components by name.",
    lead: "Eleven published sub-ranges in two groups — the additive packages, organised by the application each is formulated for, and the lubricant components published beside them.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "One category, two kinds of product.",
    body: [
      "The packages in this category are named for the finished fluid they are formulated for rather than for their own chemistry, so the range reads as a list of applications: engine oils, driveline and gear, ATF, grease, anti-freeze, brake fluid and fuel.",
      "Published beside them are the components — transformer oil, white oil and rubber process oil. They are not packages, they are not described on the same properties, and this page keeps them as their own group rather than folding them into a list they do not belong to.",
    ],
    /*
     * Structural counts and one statement the source row makes in its own words ("additive
     * packages **by application**"). No treat rate, no performance level, no figure of any kind.
     *
     * No sampling marker: §7's sampling policy names base oil and engine oil, not additives.
     */
    markers: [
      { label: "Sub-ranges", value: "Eleven" },
      { label: "Product groups", value: "Two" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Packages organised by", value: "Application" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "The range, in two groups.",
    intro:
      "Eleven sub-ranges. The eight packages are named for the application each is formulated for; the three components are named as products. The taxonomy names no individual designations within either group, so none are printed.",
    /*
     * The axes here are kinds of product, not measurement families — so the hero index says
     * "product groups". See `CategoryRange.axisNoun`.
     */
    axisNoun: "product groups",
    /* No `classificationAxes` — see the module note. */
    subRanges: [
      {
        id: "gasoline-engine-oil-packages",
        designation: "Gasoline engine oil packages",
        summary:
          "Named for the finished fluid it is formulated for. No individual designations or performance levels are published for it.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "diesel-engine-oil-packages",
        designation: "Diesel engine oil packages",
        summary:
          "Named for the finished fluid it is formulated for. No individual designations or performance levels are published for it.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "driveline-gear-packages",
        designation: "Driveline & gear packages",
        summary:
          "Published as one sub-range, as the taxonomy lists it. No individual designations are published for it.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "atf-packages",
        designation: "ATF packages",
        summary:
          "Published under the designation the taxonomy uses, unexpanded. No individual designations are published within it.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "grease-packages",
        designation: "Grease packages",
        summary:
          "Named for the finished product it is formulated for. No individual designations are published for it.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "antifreeze-packages",
        designation: "Anti-freeze packages",
        summary:
          "Named for the finished product it is formulated for. The technologies that product line publishes are listed on its own page, not here.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "brake-fluid-packages",
        designation: "Brake fluid packages",
        summary:
          "Named for the finished fluid it is formulated for. That fluid is not itself one of this site's six published categories.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "fuel-additives",
        designation: "Fuel additives",
        summary:
          "Published in this group as the taxonomy lists it. Its destination is a fuel rather than one of this site's six published categories.",
        grades: [],
        axis: PACKAGES,
      },
      {
        id: "transformer-oil",
        designation: "Transformer oil",
        summary:
          "A component rather than a package, published in this category and described on its own axis below.",
        grades: [],
        axis: COMPONENTS,
      },
      {
        id: "white-oil",
        designation: "White oil",
        summary:
          "A component rather than a package, published in this category and described on its own axis below.",
        grades: [],
        axis: COMPONENTS,
      },
      {
        id: "rubber-process-oil",
        designation: "Rubber process oil",
        summary:
          "A component rather than a package, published in this category and described on its own axis below.",
        grades: [],
        axis: COMPONENTS,
      },
    ],
  },

  /* ------------------------------------------------------------ 4 properties */

  properties: {
    heading: "Typical properties, in two families.",
    intro:
      "A package and a component are not described by the same measurements, so this category publishes two axes rather than one table with inapplicable columns.",
    labels: {
      rowHeading: "Sub-range",
      rowSubHeading: "Designation",
      rangeRowLabel: "Sub-range",
      groupingHeading: "Group",
      groupingSubHeading: "Published as",
      caption: "Typical properties, by sub-range",
    },
    groups: [
      {
        /*
         * The default group: no `subRangeIds`, so it takes every sub-range the components group
         * does not claim — the eight packages.
         *
         * **This axis is deliberately short, and the note says why rather than the columns being
         * filled in.** An additive package is normally described by its treat rate and by the
         * performance levels it is qualified against — API, ACEA, OEM, JASO, DEXRON, NLGI. Not one
         * of those appears in any document in this project, and a performance level printed here
         * would be a qualification claimed here for the first time. What remains is the subset §7's
         * laboratory list does name and that applies to a package: elemental analysis, which is how
         * a package's composition is verified, and density.
         *
         * Same handling as the grease axes on Industrial Oils and Marine Oils — a stated pending
         * state on a real axis, never a plausible axis filled in.
         */
        id: "packages",
        label: "Additive packages",
        note: "The eight packages, on the properties this project's documentation already names. The rest of the axis — including treat rate and any performance level — is pending technical review and is not published here.",
        columns: [
          { key: "elemental", label: "Elemental analysis" },
          { key: "density", label: "Density", unit: "kg/m³" },
        ],
        values: {},
      },
      {
        /*
         * The three components, claimed explicitly. They are oils, so the axis is the same one the
         * base stocks and the industrial fluids are described on — every column below appears in
         * §7's laboratory list, and nothing outside it is added because a component happens to
         * have a property a buyer would ask about.
         */
        id: "components",
        label: "Components",
        note: "The three components, described on the property set §7's laboratory list gives for an oil.",
        subRangeIds: ["transformer-oil", "white-oil", "rubber-process-oil"],
        columns: [
          { key: "kv", label: "Kinematic viscosity", unit: "mm²/s" },
          { key: "vi", label: "Viscosity index" },
          { key: "flash", label: "Flash point", unit: "°C" },
          { key: "pour", label: "Pour point", unit: "°C" },
          { key: "colour", label: "Colour" },
          { key: "density", label: "Density", unit: "kg/m³" },
        ],
        values: {},
      },
    ],
    pendingNote: PENDING_NOTE,
    methodNote: METHOD_NOTE,
  },

  /* --------------------------------------------------------------- 5 quality */

  quality: {
    heading: "Quality and testing.",
    intro:
      "Quality control runs at the same three stages as every category, and a batch is qualified against the axis its own group is described on.",
    /* No `namedProcess` — SITE_STRUCTURE §4 item 5 gives that block to Base Oils alone. */
    stages: QUALITY_STAGES,
    tests: [
      { property: "Elemental analysis" },
      { property: "Kinematic viscosity" },
      { property: "Viscosity index" },
      { property: "Flash point" },
      { property: "Pour point" },
      { property: "Density" },
    ],
    footnote: QUALITY_FOOTNOTE,
    footnoteLink: { label: "Quality & Certifications", route: "quality" },
  },

  /* ---------------------------------------------------------- 6 applications */

  applications: {
    /*
     * `downstream`, and the second page on the site to render the manifold.
     *
     * ── The set is deliberately incomplete, and the intro says so ────────────
     *
     * Three of this category's eight packages have a destination that is itself one of this site's
     * six published families: engine oil, gear and grease, anti-freeze. **Brake fluid packages and
     * fuel additives do not** — a brake fluid and a fuel are not among the six, so there is no
     * page to point at and no honest field list to name. They are absent from the manifold rather
     * than routed to a plausible-looking neighbour, and the intro states the absence rather than
     * letting the section imply completeness.
     *
     * ── Every field below is validated ──────────────────────────────────────
     *
     * `fields()` checks each string against the destination family's own frozen `ranges` at module
     * load. Nothing here is hand-typed prose about a market: it is this site's own published
     * taxonomy, named from the other end.
     */
    mode: "downstream",
    eyebrow: "Applications",
    heading: "Where a package goes next.",
    intro:
      "A package is an input. Each destination below is one of this company's own product families, and every field named under it is a range that family already publishes. Not every sub-range appears: a brake fluid and a fuel are not among this site's six categories, so the packages formulated for them have no destination page to name and none is invented for them.",
    entries: [
      {
        familyId: "engine-oils-automotive-lubricants",
        note: "The gasoline, diesel and ATF packages are formulated for automotive finished fluids, which this site publishes segmented by vehicle type.",
        fields: fields("engine-oils-automotive-lubricants", [
          "Passenger cars",
          "Trucks & buses",
          "Motorcycle & ATV",
          "Agriculture",
          "Construction & mining",
          "Gardening",
        ]),
      },
      {
        familyId: "industrial-oils-lubricants",
        note: "The gear and grease packages name two ranges this site publishes under industrial oils by their own names.",
        fields: fields("industrial-oils-lubricants", ["Gear", "Industrial greases"]),
      },
      {
        familyId: "antifreeze-coolants",
        note: "The anti-freeze packages are formulated for the coolant range. Which technology a given package produces is not published here; the technologies that family publishes are listed on its own page.",
        fields: fields("antifreeze-coolants", [
          "IAT inhibitor",
          "OAT inhibitor",
          "HOAT inhibitor",
          "Si-OAT inhibitor",
          "NAP-free",
        ]),
      },
    ],
  },

  /*
   * Industries Served (§4 item 7) is deliberately not set, for the same reason as on every other
   * category — a served-industry list is market coverage, and the market list is an open launch
   * blocker in SITE_STRUCTURE's Outstanding Confirmations.
   */

  /* ---------------------------------------------------------------- 8 supply */

  supply: {
    heading: "Packaging and supply.",
    intro:
      "The formats this category is supplied in, and the commercial terms it is quoted against.",
    formats: SUPPLY_FORMATS,
    incoterms: INCOTERMS,
    terms:
      "Minimum quantity, lead time and payment terms are established against a specific product, format and destination — they are part of the quotation, not a published table.",
    link: { label: "Export & Logistics", route: "exportLogistics" },
  },

  /* -------------------------------------------------------- 10 documentation */

  documentation: {
    heading: "Documents, published and per batch.",
    intro:
      "Three documents are issued for this category. Two describe the product, one describes the batch you receive — and none of the three sits behind a form.",
    documents: [
      {
        code: "TDS",
        label: "Technical Data Sheet",
        scope: "Technical properties",
        access: "open",
      },
      {
        code: "SDS",
        label: "Safety Data Sheet",
        scope: "Handling, storage and transport",
        access: "open",
      },
      {
        code: "COA",
        label: "Certificate of Analysis",
        scope: "Per batch — the result of outgoing testing",
        access: "open",
      },
    ],
    note: "The full company and product catalogues are the only documents released against a qualifying form, and that form is on the Products landing page.",
  },

  /* ------------------------------------------------------------------ 11 faq */

  faq: [
    {
      id: "documents-before-enquiry",
      // DATA_MODEL.md §DOWNLOAD_REQUEST / DATA_MODEL_GAP_REVIEW.md §5: TDS and SDS explicitly not gated.
      question: "Can I read the specifications before making an enquiry?",
      answer:
        "Yes. Technical and Safety Data Sheets are published openly. Only the full company and product catalogues are released against a short qualifying form.",
    },
    {
      id: "packages-and-components",
      // SITE_STRUCTURE §4, Lubricant Additives row: packages "+ lubricant components" is one row.
      question: "Why are packages and components in the same category?",
      answer:
        "Because the published taxonomy puts them there. They are kept as two groups on this page, with their own ranges and their own property axes, rather than merged into a single list.",
    },
    {
      id: "performance-levels",
      // No project document names a performance level, service category or approval for any package.
      question: "Which performance levels do the packages meet?",
      answer:
        "None is published on this page. Performance levels and approvals are stated against a specific package in its Technical Data Sheet and confirmed against an enquiry, not listed on a category page.",
      link: { label: "Request a Sample", route: "sample" },
    },
    {
      id: "coa-per-batch",
      // SITE_STRUCTURE §7 Quality & Standards: COA-per-batch, batch traceability.
      question: "Is a Certificate of Analysis issued for every batch?",
      answer:
        "Yes. The COA records the outgoing test result for the batch supplied, not a typical value for the product.",
    },
    {
      id: "blend-to-specification",
      // SITE_STRUCTURE §5: Customized Solutions is the route for formulation to a customer brief.
      question: "Can a package be supplied to a specification we provide?",
      answer:
        "Formulation to a customer brief is a route of its own rather than a variant of a published product.",
      link: { label: "Customized Solutions", route: "customization" },
    },
  ],
};
