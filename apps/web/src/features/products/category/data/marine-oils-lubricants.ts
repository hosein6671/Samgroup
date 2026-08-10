/**
 * Marine Oils & Lubricants — the template's fourth instance, and the first that needed nothing
 * new from the contract.
 *
 * ── What this category tests ────────────────────────────────────────────────
 *
 * Nothing, and that is the result worth recording. It is terminal like Antifreeze, single-
 * dimension in the way Industrial Oils is, and it carries greases beside fluids exactly as
 * Industrial Oils does — so every mechanism it needs already exists and is already proven on a
 * frozen page. This fixture and one route file are the whole of it: no component was touched, no
 * type was added, no section was special-cased.
 *
 * ── Where every string here comes from ──────────────────────────────────────
 *
 * The taxonomy is transcribed from `docs/SITE_STRUCTURE.md` §4, Marine Oils row: "TPEO, cylinder
 * oils, system oils, stern tube/gear oils, deck hydraulic, marine greases". Six sub-ranges, and
 * nothing else is a product.
 *
 * The organising phrase is the descriptor already published on the frozen Products landing —
 * "Engine-room and deck fluids for two- and four-stroke marine propulsion" — so the Overview and
 * the markers restate a string this site already publishes rather than composing a new claim.
 *
 * Both property axes are drawn from §7's laboratory list and nothing else. **Property names only** —
 * no document in this project names a test method, so none is printed. Values are unpublished on
 * both axes, exactly as on the three pages before this one.
 *
 * ── What is not here, and why ───────────────────────────────────────────────
 *
 * **TPEO is not expanded.** No project document spells the acronym out, and the Antifreeze fixture
 * set the precedent when it left MEG, MPG, IAT, OAT, HOAT and Si-OAT standing exactly as the
 * taxonomy prints them. An expansion written here would be technical content written here for the
 * first time.
 *
 * **No sub-range is assigned to a stroke.** The category descriptor says the range serves two- and
 * four-stroke propulsion, which is a statement about the category. Which sub-range serves which is
 * a statement about a product, no document makes it, and it is exactly the kind of plausible
 * technical detail a buyer would specify against.
 *
 * No grade names — the frozen taxonomy names none for this category. No viscosity grade, no BN or
 * TBN figure, no NLGI number, no SAE grade, no service interval, no OEM or classification-society
 * approval, no vessel or engine compatibility, no capacity, no MOQ, no lead time, no market list,
 * no certification.
 *
 * **No sampling claim.** §7's sampling policy names base oil and engine oil. It does not name
 * marine oils, so neither the Overview marker nor the FAQ entry that carry it on Base Oils appears
 * here.
 *
 * **No named process.** §4 item 5 gives that block to Base Oils alone.
 *
 * **No classification axes.** No approved document gives this category a formal classification
 * system, so the strip does not render.
 *
 * **No Applications section.** See the note at that position below.
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

/**
 * The two specification families this category splits into — the same split Industrial Oils
 * publishes, for the same reason: a grease and a fluid are not described by the same
 * measurements. "Marine greases" is the taxonomy's own sixth entry; "fluids" is the word the
 * published descriptor uses for the rest of it.
 */
const FLUIDS = "Fluids";
const GREASES = "Greases";

export const MARINE_OILS_LUBRICANTS: ProductCategoryContent = {
  familyId: "marine-oils",

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Marine fluids, engine room and deck.",
    lead: "Six published sub-ranges across two specification families — the fluids, and the marine greases published beside them — with the technical documents held on the same page.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "Engine room and deck, specified two ways.",
    body: [
      "This range is published the way a vessel is laid out rather than by viscosity alone: the propulsion and engine-room fluids first, the deck hydraulic beside them, and the marine greases published alongside both.",
      "That organisation has the same consequence the industrial range has, and this page states it rather than hides it. Greases are not described on the same properties as the fluids, so the specifications below are published as two families rather than as one table with half its columns inapplicable.",
    ],
    /*
     * Four structural markers, no commercial figure among them. "Covering" restates the descriptor
     * the frozen Products landing already publishes for this family; it is not a new claim about
     * which sub-range serves which system.
     *
     * No sampling marker: §7's sampling policy names base oil and engine oil, not marine oils.
     */
    markers: [
      { label: "Sub-ranges", value: "Six" },
      { label: "Specification families", value: "Two" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Covering", value: "Engine room and deck" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "The range, by shipboard system.",
    intro:
      "Six sub-ranges, each named for the shipboard system it is formulated for. The taxonomy names the systems; it names no individual product designations, so none are printed.",
    /*
     * Two axes, and they are specification families rather than dimensions of the taxonomy — so
     * the hero index says so. See `CategoryRange.axisNoun`.
     */
    axisNoun: "specification families",
    /* No `classificationAxes` — see the module note. */
    subRanges: [
      {
        id: "tpeo",
        designation: "TPEO",
        summary:
          "Published under the designation the taxonomy uses, unexpanded. No individual designations are published within it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "cylinder-oils",
        designation: "Cylinder oils",
        summary:
          "Named for the shipboard system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "system-oils",
        designation: "System oils",
        summary:
          "Named for the shipboard system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "stern-tube-gear",
        designation: "Stern tube & gear oils",
        summary:
          "Published as one sub-range, as the taxonomy lists it. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "deck-hydraulic",
        designation: "Deck hydraulic",
        summary:
          "The deck half of the range, published beside the engine-room fluids rather than under them.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "marine-greases",
        designation: "Marine greases",
        summary:
          "Published in this category alongside the fluids, and on a specification family of its own below.",
        grades: [],
        axis: GREASES,
      },
    ],
  },

  /* ------------------------------------------------------------ 4 properties */

  properties: {
    heading: "Typical properties, in two families.",
    intro:
      "A grease and a fluid are not described by the same measurements, so this category publishes two axes rather than one table with inapplicable columns.",
    /*
     * Two families, so the table carries a second column naming the one each row belongs to.
     * Members are sub-ranges named for a shipboard system, not grades, and the labels say so.
     */
    labels: {
      rowHeading: "Sub-range",
      rowSubHeading: "Duty",
      rangeRowLabel: "Sub-range",
      groupingHeading: "Family",
      groupingSubHeading: "Specification",
      caption: "Typical properties, by sub-range",
    },
    groups: [
      {
        /*
         * The default group: no `subRangeIds`, so it takes every sub-range the grease group does
         * not claim. Columns are the marine subset of SITE_STRUCTURE §7's laboratory list —
         * viscosity, viscosity index, flash point, pour point, density and foam all appear in it.
         */
        id: "fluids",
        label: "Fluids",
        note: "Five of the six sub-ranges, described on one shared set of properties.",
        columns: [
          { key: "kv", label: "Kinematic viscosity", unit: "mm²/s" },
          { key: "vi", label: "Viscosity index" },
          { key: "flash", label: "Flash point", unit: "°C" },
          { key: "pour", label: "Pour point", unit: "°C" },
          { key: "density", label: "Density", unit: "kg/m³" },
          { key: "foam", label: "Foaming characteristics" },
        ],
        /* Empty, for the same reason as every other category: no approved lab data exists. */
        values: {},
      },
      {
        /*
         * The exception, claimed explicitly — the same short axis Industrial Oils' greases carry,
         * and short for the same reason. Consistency, dropping point, base oil viscosity and water
         * washout are the properties a grease is normally described on; **none of those names
         * appears in §7's laboratory list**, so none is printed here. What remains is the subset
         * §7 does name and that applies.
         *
         * The group still earns its place: four of the six fluid properties do not carry over, so
         * one table would have shown blanks meaning *not applicable* beside blanks meaning
         * *pending lab data*.
         */
        id: "greases",
        label: "Greases",
        note: "The sixth sub-range, published on an axis of its own. Its full property set is pending technical review; the properties below are the ones this project's documentation already names.",
        subRangeIds: ["marine-greases"],
        columns: [
          { key: "kv", label: "Viscosity", unit: "mm²/s" },
          { key: "corrosion", label: "Copper corrosion" },
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
      "Quality control runs at the same three stages as every category, and a batch is qualified against the axis its own specification family is described on.",
    /* No `namedProcess` — SITE_STRUCTURE §4 item 5 gives that block to Base Oils alone. */
    stages: QUALITY_STAGES,
    tests: [
      { property: "Kinematic viscosity" },
      { property: "Viscosity index" },
      { property: "Flash point" },
      { property: "Pour point" },
      { property: "Foaming characteristics" },
      { property: "Copper corrosion" },
    ],
    footnote: QUALITY_FOOTNOTE,
    footnoteLink: { label: "Quality & Certifications", route: "quality" },
  },

  /*
   * §4 item 6, Applications, is deliberately not set — the same handling Industrial Oils gets, and
   * for the same two reasons.
   *
   * This category is terminal: nothing on this site is made from a marine oil, so there is no
   * downstream family to name and the manifold must not render. And its axes are specification
   * families rather than decisions a buyer takes in order, so there is no selection sequence
   * either — a gate reading "Fluids, then Greases" would describe this page's tables, not the
   * reader's choice.
   *
   * What is left would be an industry or use-case list, and that is market coverage, which is an
   * open launch blocker in SITE_STRUCTURE's Outstanding Confirmations. Reported as a content gap
   * rather than closed with invented copy.
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
      id: "two-axes",
      // Derived from this page's own property groups; no external claim.
      question: "Why are the specifications published as two tables?",
      answer:
        "Because a grease and a fluid are not described by the same measurements. Publishing one table would mean columns that are blank for a whole family — and a blank that means 'not applicable' should not look like a blank that means 'awaiting lab data'.",
    },
    {
      id: "coa-per-batch",
      // SITE_STRUCTURE §7 Quality & Standards: COA-per-batch, batch traceability.
      question: "Is a Certificate of Analysis issued for every batch?",
      answer:
        "Yes. The COA records the outgoing test result for the batch supplied, not a typical value for the product.",
    },
    {
      id: "greases-in-this-category",
      // SITE_STRUCTURE §4, Marine Oils row: "marine greases" is part of the frozen taxonomy.
      question: "Are marine greases published in this category or separately?",
      answer:
        "In this one. Marine greases are part of this category's published taxonomy; they simply carry their own specification axis.",
    },
    {
      id: "blend-to-specification",
      // SITE_STRUCTURE §5: Customized Solutions is the route for formulation to a customer brief.
      question: "Can a fluid be supplied to a specification we provide?",
      answer:
        "Formulation to a customer brief is a route of its own rather than a variant of a published product.",
      link: { label: "Customized Solutions", route: "customization" },
    },
  ],
};
