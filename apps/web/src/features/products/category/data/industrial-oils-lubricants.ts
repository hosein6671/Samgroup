/**
 * Industrial Oils & Lubricants — the template's third instance, and the one that broke the
 * single-property-axis assumption.
 *
 * ── What this category tests ────────────────────────────────────────────────
 *
 * The two previous instances each described every member on one axis. This one cannot. Eight of
 * its nine sub-ranges are fluids — hydraulic, gear, compressor, cutting and metalworking, heat
 * transfer, pneumatic, slideway, stationary engine oils. The ninth is greases, and the two are
 * not described by the same measurements.
 *
 * Forced into one table, the grease row would be blank under several fluid properties — blanks
 * meaning *not applicable*, drawn identically to the blanks that mean *pending lab data*. On a
 * specification sheet those two must never look alike. So the contract carries property
 * **groups**, and this fixture declares two.
 *
 * It is also the longest taxonomy so far (nine sub-ranges against Base Oils' seven), terminal
 * rather than upstream, and single-dimension — which is why its Applications section is absent
 * rather than presented in either existing mode. See `applications` below.
 *
 * ── Where every string here comes from ──────────────────────────────────────
 *
 * The taxonomy is transcribed from `docs/SITE_STRUCTURE.md` §4, Industrial Oils row: "Hydraulic,
 * gear, compressor, cutting/metalworking, heat transfer, pneumatic, slideway, stationary engine
 * oils, industrial greases". Nine sub-ranges, and nothing else is a product.
 *
 * The organising principle is the descriptor already published on the Products landing — "Plant
 * fluids grouped by the machine they serve rather than by viscosity alone" — so each summary
 * below says which plant system the sub-range is named for and stops there.
 *
 * Both property axes are drawn from §7's laboratory list and nothing else. **Property names only** —
 * no document in this project names a test method, so none is printed. Values are unpublished on
 * both axes, exactly as on the other two pages.
 *
 * ── What is not here, and why ───────────────────────────────────────────────
 *
 * No grade names — the frozen taxonomy names none for this category. No viscosity grade, no ISO
 * VG number, no NLGI number, no temperature range, no service interval, no OEM approval, no
 * machine or manufacturer compatibility, no capacity, no MOQ, no lead time, no market list, no
 * certification.
 *
 * **No sampling claim.** §7's sampling policy names base oil and engine oil. It does not name
 * industrial oils, so neither the Overview marker nor the FAQ entry that carry it on Base Oils
 * appears here.
 *
 * **No named process.** §4 item 5 gives that block to Base Oils alone.
 *
 * **No classification axes.** No approved document gives this category a formal classification
 * system, so the strip does not render.
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
 * The two specification families this category splits into.
 *
 * Not an invented distinction: SITE_STRUCTURE's own list separates eight oils from "industrial
 * greases", and "fluids" is the word the published descriptor uses for the rest. Naming the two
 * groups lets the same `axis` mechanism Antifreeze introduced carry the split through the hero
 * index and the range register, and lets the property groups below map onto it exactly.
 */
const FLUIDS = "Fluids";
const GREASES = "Greases";

export const INDUSTRIAL_OILS_LUBRICANTS: ProductCategoryContent = {
  familyId: "industrial-oils",

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Plant fluids, by the system they serve.",
    lead: "Nine published sub-ranges, each named for the plant system it serves, across two specification families — the fluids, and the greases published beside them.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "Grouped by duty, specified two ways.",
    body: [
      "This range is organised by the machine it serves rather than by viscosity alone, so it reads the way a plant is laid out: hydraulics, gearboxes, compressors, machine tools, and the greases published alongside them.",
      "That organisation has a consequence this page states rather than hides. Greases are not described on the same properties as the fluids, so the specifications below are published as two families rather than as one table with half its columns inapplicable.",
    ],
    markers: [
      { label: "Sub-ranges", value: "Nine" },
      { label: "Specification families", value: "Two" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Organised by", value: "Duty" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "The range, by duty.",
    intro:
      "Nine sub-ranges, each named for the plant system it is formulated for. The taxonomy names the duties; it names no individual product designations, so none are printed.",
    /*
     * The two axes below are specification families, not dimensions of the taxonomy — a fluid set
     * and a grease set, split because they are not described by the same measurements. The hero
     * index used to call them dimensions, which claimed more about the split than the split means.
     * This is also the word the Overview marker above already uses, so the two now agree.
     */
    axisNoun: "specification families",
    /* No `classificationAxes` — see the module note. */
    subRanges: [
      {
        id: "hydraulic",
        designation: "Hydraulic",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "gear",
        designation: "Gear",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "compressor",
        designation: "Compressor",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "cutting-metalworking",
        designation: "Cutting & metalworking",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "heat-transfer",
        designation: "Heat transfer",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "pneumatic",
        designation: "Pneumatic",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "slideway",
        designation: "Slideway",
        summary:
          "Named for the plant system it serves. No individual designations are published for it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "stationary-engine",
        designation: "Stationary engine oils",
        summary:
          "Published in this category rather than with the automotive range, as the taxonomy lists it.",
        grades: [],
        axis: FLUIDS,
      },
      {
        id: "industrial-greases",
        designation: "Industrial greases",
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
     * Two dimensions, so the table carries a second column naming the specification family each
     * row belongs to. Members are sub-ranges named for a duty, not grades, and the labels say so.
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
         * not claim. Adding a tenth fluid sub-range needs no change here.
         *
         * Columns are the industrial subset of SITE_STRUCTURE §7's laboratory list — viscosity,
         * viscosity index, flash point, pour point, density and foam all appear in it.
         */
        id: "fluids",
        label: "Fluids",
        note: "Eight of the nine sub-ranges, described on one shared set of properties.",
        columns: [
          { key: "kv", label: "Kinematic viscosity", unit: "mm²/s" },
          { key: "vi", label: "Viscosity index" },
          { key: "flash", label: "Flash point", unit: "°C" },
          { key: "pour", label: "Pour point", unit: "°C" },
          { key: "density", label: "Density", unit: "kg/m³" },
          { key: "foam", label: "Foaming characteristics" },
        ],
        values: {},
      },
      {
        /*
         * The exception, claimed explicitly — and now a much shorter axis than it was.
         *
         * It previously listed NLGI consistency, dropping point, base oil viscosity and water
         * washout. None of those property names appears in SITE_STRUCTURE §7's laboratory list,
         * so all four were unapproved technical content and are gone. What remains is the subset
         * §7 does name and that applies here.
         *
         * The group itself stays, and it is still the reason the plural exists: two of the six
         * fluid properties do not carry over, so a single table would have shown blanks meaning
         * *not applicable* beside blanks meaning *pending lab data*. `note` records that the full
         * axis is awaiting review rather than filling it in.
         */
        id: "greases",
        label: "Greases",
        note: "The ninth sub-range, published on an axis of its own. Its full property set is pending technical review; the properties below are the ones this project's documentation already names.",
        subRangeIds: ["industrial-greases"],
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
   * §4 item 6, Applications, is deliberately not set.
   *
   * This category is terminal — nothing on this site is made from an industrial oil — so there is
   * no downstream to name, and it has one dimension rather than three, so there is no selection
   * sequence either. Its sub-ranges *are* its applications: "hydraulic", "gear", "compressor" and
   * "slideway" name the plant systems directly, so any Applications section would reprint the
   * range under a different heading. The one reading that would add something — the split between
   * the fluid and grease specification families — is already stated by the property groups above.
   *
   * Omitting it is the same handling `industries` gets, and it is reported as a content gap
   * rather than closed with invented industries or use cases.
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
      // SITE_STRUCTURE §4, Industrial Oils row: "industrial greases" is part of the frozen taxonomy.
      question: "Are greases published in this category or separately?",
      answer:
        "In this one. Industrial greases are part of this category's published taxonomy; they simply carry their own specification axis.",
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
