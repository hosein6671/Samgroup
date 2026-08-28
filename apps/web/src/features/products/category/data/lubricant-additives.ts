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
    title: "Lubricant Additives & Components | SAM Group",
    description:
      "Browse lubricant additive packages by finished-fluid application, plus transformer oil, white oil and rubber process oil components from SAM Group.",
  },

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Start with the fluid you need to formulate.",
    lead: "Navigate additive packages by finished-fluid application, then define the performance target, base-stock context and documentation required for technical review.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Discuss the Requirement", route: "sample" },
    image: {
      src: "/images/lubricant-additives-lab-samples.webp",
      alt: "Unlabelled laboratory bottles containing amber lubricant additive samples",
      caption: "Additive samples · application-led technical review",
    },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "Separate the package from the component.",
    body: [
      "Additive packages combine multiple functions around the needs of a finished lubricant or functional fluid. That is why the first group is organised by application: engine oil, driveline and gear, ATF, grease, antifreeze, brake fluid and fuel.",
      "Transformer oil, white oil and rubber process oil are represented as components, not additive packages. Keeping the groups separate makes the enquiry clearer and prevents package performance criteria from being confused with the physical properties used to describe an oil component.",
    ],
    /*
     * Structural counts and one statement the source row makes in its own words ("additive
     * packages **by application**"). No treat rate, no performance level, no figure of any kind.
     *
     * No sampling marker: §7's sampling policy names base oil and engine oil, not additives.
     */
    markers: [
      { label: "Selection starts with", value: "Application" },
      { label: "Technical review", value: "Product-specific" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Supply brief", value: "Product · volume · destination" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "Choose the application before the package.",
    intro:
      "Use the application groups to narrow the enquiry. A package designation, treat rate, base-stock fit and supported performance level must then be confirmed from the reviewed Technical Data Sheet for the specific product.",
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
    heading: "Review the right information for each group.",
    intro:
      "An additive package is selected against a formulation target; an oil component is compared through physical properties. The page keeps those decision paths separate instead of presenting one misleading specification table.",
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
    heading: "Confirm identity, condition and batch evidence.",
    intro:
      "Technical review begins with the product record and its approved test basis. The supplied batch is then represented by its Certificate of Analysis; category-level guidance does not replace either document.",
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
    heading: "Connect each package to its finished-fluid destination.",
    intro:
      "The routes below connect package groups to finished-fluid families already represented in the SAM catalogue. They are navigation aids—not compatibility, approval or formulation claims. Brake-fluid and fuel applications remain enquiry-led because they do not have separate product-family pages here.",
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
    heading: "Build a quote around the actual requirement.",
    intro:
      "Identify the product or application, estimated volume, preferred packaging and destination. SAM can then review the technical and commercial basis without turning assumptions into quoted terms.",
    formats: SUPPLY_FORMATS,
    incoterms: INCOTERMS,
    terms:
      "Minimum quantity, lead time and payment terms are established against a specific product, format and destination — they are part of the quotation, not a published table.",
    link: { label: "Export & Logistics", route: "exportLogistics" },
  },

  /* -------------------------------------------------------- 10 documentation */

  documentation: {
    heading: "Use each document for the decision it supports.",
    intro:
      "The TDS supports product selection, the SDS supports safe handling, and the COA records results for the supplied batch. Availability and revision must be confirmed against the selected product.",
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
