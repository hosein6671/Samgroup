/**
 * Antifreeze & Coolants — the template's stress test.
 *
 * ── Why this category and not the next one in the list ──────────────────────
 *
 * It is the category that shares the fewest assumptions with Base Oils, and building it is what
 * proves the template rather than the first instance. It names **no individual grades**, it has
 * **no formal classification system** in any approved document, it is organised by **three
 * orthogonal dimensions** rather than one hierarchy, it has **no named process**, it needs a
 * **different property axis**, and it is a **terminal product** rather than a feedstock. Every
 * one of those was a Base-Oils-shaped assumption somewhere in the template.
 *
 * ── Where every string here comes from ──────────────────────────────────────
 *
 * The taxonomy is transcribed from `docs/SITE_STRUCTURE.md` §4, Antifreeze & Coolants row: "By
 * base fluid (MEG/MPG) and inhibitor technology (IAT/OAT/HOAT/Si-OAT, NAP-free); concentrate or
 * ready-to-use". Eight sub-ranges across three dimensions, and nothing else is a product.
 *
 * **Acronyms are not expanded.** An earlier revision put "monoethylene glycol", "organic acid
 * technology" and the rest in each sub-range's qualifier. No project document expands them, so
 * those were unapproved technical content and have been removed; the designations now stand
 * exactly as the taxonomy prints them.
 *
 * The property axis is the coolant subset of §7's laboratory list — "coolant freeze point/reserve
 * alkalinity" plus water content, density and copper corrosion from the same list. **Property
 * names only**: no document in this project names a test method, so none is printed. Values are
 * unpublished, exactly as on Base Oils.
 *
 * The quality stages are §7's "Incoming/In-Process/Outgoing testing stages", unchanged: they are
 * a company-level statement, not a base-oil one.
 *
 * ── What is not here, and why ───────────────────────────────────────────────
 *
 * No grade names. No freeze point, no reserve alkalinity figure, no pH, no dilution ratio, no
 * service interval, no colour, no OEM approval, no vehicle or engine compatibility, no capacity,
 * no MOQ, no lead time, no market list, no certification.
 *
 * **No sampling claim.** Base Oils states that a sample is issued before commitment because §7
 * says so — for base oil and engine oil specifically. It does not say it for coolants, so this
 * fixture does not say it either, and the Overview marker and the FAQ entry that carry it on
 * Base Oils are simply absent here rather than reworded.
 *
 * **No named process.** SITE_STRUCTURE §4 gives the Thin Film Polishing block to Base Oils alone
 * — "Base Oil only" — so `namedProcess` is omitted and the section renders as Quality & Testing.
 *
 * **No classification axes.** No approved document gives this category a formal classification
 * system, so `classificationAxes` is omitted and the strip does not render. Plausible-sounding
 * criteria in its place would be inventing a standard.
 */

import type { ProductCategoryContent } from "../category-contract";

import {
  INCOTERMS,
  METHOD_NOTE,
  PENDING_NOTE,
  QUALITY_FOOTNOTE,
  QUALITY_STAGES,
  SUPPLY_FORMATS,
} from "./defaults";

/** The three dimensions SITE_STRUCTURE §4 organises this category by, named once. */
const BASE_FLUID = "Base fluid";
const INHIBITOR = "Inhibitor technology";
const SUPPLY_FORM = "Supply form";

export const ANTIFREEZE_COOLANTS: ProductCategoryContent = {
  familyId: "antifreeze-coolants",

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Coolants, by base fluid and inhibitor.",
    lead: "Eight published sub-ranges across three independent dimensions — base fluid, inhibitor technology and supply form — with the technical documents held on the same page.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "Three dimensions, not one list.",
    body: [
      "A coolant is not selected down a single ladder. Base fluid, inhibitor technology and supply form are independent decisions, and a specification is one choice from each — so this page is built as three dimensions rather than as one ranked range.",
      "Everything published for this category lives on this page: the dimensions, the sub-ranges within each, the property axis every coolant is described on, and the technical documents. There is no per-product page to hunt for, and no form between a reader and a specification.",
    ],
    /*
     * No sampling marker. §7's sampling policy names base oil and engine oil; extending it to
     * coolants would be extending a commitment the document does not make.
     */
    markers: [
      { label: "Sub-ranges", value: "Eight" },
      { label: "Dimensions", value: "Three" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Supplied as", value: "Concentrate or RTU" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "The range, by dimension.",
    intro:
      "Eight sub-ranges across three independent dimensions. The taxonomy names the dimensions and the technologies within them; it names no individual product designations, so none are printed.",
    /*
     * `classificationAxes` is deliberately absent — see the module note. The dimensions below do
     * the structural work the classification strip does on Base Oils.
     */
    subRanges: [
      {
        id: "meg-base",
        designation: "MEG base",
        summary: "One of the two base fluids the range is organised by.",
        grades: [],
        axis: BASE_FLUID,
      },
      {
        id: "mpg-base",
        designation: "MPG base",
        summary: "One of the two base fluids the range is organised by.",
        grades: [],
        axis: BASE_FLUID,
      },
      {
        id: "iat",
        designation: "IAT inhibitor",
        summary: "One of the inhibitor technologies the range publishes.",
        grades: [],
        axis: INHIBITOR,
      },
      {
        id: "oat",
        designation: "OAT inhibitor",
        summary: "One of the inhibitor technologies the range publishes.",
        grades: [],
        axis: INHIBITOR,
      },
      {
        id: "hoat",
        designation: "HOAT inhibitor",
        summary: "One of the inhibitor technologies the range publishes.",
        grades: [],
        axis: INHIBITOR,
      },
      {
        id: "si-oat",
        designation: "Si-OAT inhibitor",
        summary: "One of the inhibitor technologies the range publishes.",
        grades: [],
        axis: INHIBITOR,
      },
      {
        id: "nap-free",
        designation: "NAP-free",

        summary: "Published alongside the inhibitor technologies, as the range lists it.",
        grades: [],
        axis: INHIBITOR,
      },
      {
        id: "concentrate-rtu",
        designation: "Concentrate or ready-to-use",

        summary:
          "The state the product is supplied in. It cuts across both dimensions above rather than sitting inside either.",
        grades: [],
        axis: SUPPLY_FORM,
      },
    ],
  },

  /* ------------------------------------------------------------ 4 properties */

  properties: {
    heading: "Typical properties.",
    intro: "Coolants are described on their own properties, not on the base-oil ones.",
    /*
     * Three dimensions, so the table carries a second column stating which one each row belongs
     * to. Members are sub-ranges rather than grades, and the labels say so.
     */
    labels: {
      rowHeading: "Sub-range",
      rowSubHeading: "Designation",
      rangeRowLabel: "Sub-range",
      groupingHeading: "Dimension",
      groupingSubHeading: "Organised by",
      caption: "Typical properties, by sub-range",
    },
    /*
     * One group: every sub-range here is a coolant and they share an axis. No `subRangeIds`, so
     * it takes them all.
     *
     * The columns are the coolant subset of SITE_STRUCTURE §7's laboratory list — that document
     * names "coolant freeze point/reserve alkalinity" explicitly, and water content, density and
     * copper corrosion appear in the same list. Nothing here is a base-oil property carried over:
     * no viscosity, no viscosity index, no flash or pour point. **No methods and no conditions**:
     * none is named in any project document.
     */
    groups: [
      {
        id: "coolants",
        label: "Coolants",
        columns: [
          { key: "freeze", label: "Freeze point", unit: "°C" },
          { key: "alkalinity", label: "Reserve alkalinity" },
          { key: "density", label: "Relative density" },
          { key: "water", label: "Water content", unit: "%" },
          { key: "corrosion", label: "Copper corrosion" },
        ],
        /* Empty, for the same reason as Base Oils: no approved lab data exists. */
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
      "Quality control runs at the same three stages as every category, and a coolant batch is qualified against the same property axis it is later described on.",
    /*
     * `namedProcess` is absent. SITE_STRUCTURE §4 item 5 gives the named-process block to Base
     * Oils alone — "Base Oil only" — so the section renders as Quality & Testing and the layout
     * rebalances rather than being padded with invented process content.
     */
    stages: QUALITY_STAGES,
    tests: [
      { property: "Freeze point" },
      { property: "Reserve alkalinity" },
      { property: "Relative density" },
      { property: "Water content" },
      { property: "Copper corrosion" },
      { property: "Elemental analysis" },
    ],
    footnote: QUALITY_FOOTNOTE,
    footnoteLink: { label: "Quality & Certifications", route: "quality" },
  },

  /* ---------------------------------------------------------- 6 applications */

  applications: {
    /*
     * `selection`, not `downstream`.
     *
     * A coolant is terminal — nothing else on this site is made from it — so there is no
     * downstream family to name. The only other honest answers would be an industry list or a
     * use-case list, and both are market coverage, which is an open launch blocker. What this
     * category does publish is the order its own decisions are taken in.
     *
     * The steps name axes only. Their options are read off `range.subRanges` by the component,
     * so nothing here can name a sub-range the register does not.
     */
    mode: "selection",
    eyebrow: "Selecting a coolant",
    heading: "Three decisions, in order.",
    intro:
      "This category has no downstream: a coolant is the finished product, not an input to another one. What it has instead is a selection path — three independent decisions, each narrowing the last, and every option below is a sub-range published in the range above.",
    steps: [
      {
        id: "step-base-fluid",
        axis: BASE_FLUID,
        note: "The glycol the coolant is built on. It is the first decision because it constrains the rest.",
      },
      {
        id: "step-inhibitor",
        axis: INHIBITOR,
        note: "The inhibitor package, plus the composition constraint the range publishes beside the technologies.",
      },
      {
        id: "step-supply-form",
        axis: SUPPLY_FORM,
        note: "Whether the product ships as concentrate or ready-to-use. A supply decision, settled with the quotation.",
      },
    ],
  },

  /*
   * Industries Served (§4 item 7) is deliberately not set, for the same reason as on Base Oils —
   * a served-industry list is market coverage and the market list is an open launch blocker.
   */

  /* ---------------------------------------------------------------- 8 supply */

  supply: {
    heading: "Packaging and supply.",
    intro:
      "The formats this category is supplied in, and the commercial terms it is quoted against.",
    formats: SUPPLY_FORMATS,
    incoterms: INCOTERMS,
    terms:
      "Minimum quantity, lead time and payment terms are established against a specific product, dilution state, format and destination — they are part of the quotation, not a published table.",
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
      id: "coa-per-batch",
      // SITE_STRUCTURE §7 Quality & Standards: COA-per-batch, batch traceability.
      question: "Is a Certificate of Analysis issued for every batch?",
      answer:
        "Yes. The COA records the outgoing test result for the batch supplied, not a typical value for the product.",
    },
    {
      id: "concentrate-or-rtu",
      // SITE_STRUCTURE §4, Antifreeze row: "concentrate or ready-to-use" is part of the frozen taxonomy.
      question: "Is the range supplied as concentrate or ready-to-use?",
      answer:
        "Both are in this category's published taxonomy. Which applies is a supply decision taken with the quotation rather than a separate range.",
    },
    {
      id: "inhibitor-technologies",
      // SITE_STRUCTURE §4, Antifreeze row: IAT/OAT/HOAT/Si-OAT and NAP-free are the published set.
      question: "Which inhibitor technologies are published?",
      answer:
        "IAT, OAT, HOAT and Si-OAT, together with NAP-free as a composition constraint. They are listed in full in the range above.",
    },
    {
      id: "blend-to-specification",
      // SITE_STRUCTURE §5: Customized Solutions is the route for formulation to a customer brief.
      question: "Can a coolant be supplied to a specification we provide?",
      answer:
        "Formulation to a customer brief is a route of its own rather than a variant of a published product.",
      link: { label: "Customized Solutions", route: "customization" },
    },
  ],
};
