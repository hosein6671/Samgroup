/**
 * Base Oils — the first category to be built on the shared template.
 *
 * ── Where every string here comes from ──────────────────────────────────────
 *
 * The taxonomy is transcribed from `docs/SITE_STRUCTURE.md` §4, Base Oils row: "Group I (SN
 * 150/350/500/650), Group II, Group III, Naphthenic, Bright Stock (BS 150), Synthetics
 * (PAO/Ester/PAG), Virgin & Re-refined grades; Thin Film Polishing named block". Seven
 * sub-ranges, five named grades, one named process — and nothing else is a product.
 *
 * The quality stages are §7's "Incoming/In-Process/Outgoing testing stages". The supply formats
 * are §6's list. The Incoterms are §6's four. The FAQ answers each cite their source inline.
 *
 * ── What is not here, and why ───────────────────────────────────────────────
 *
 * No viscosity, no viscosity index, no flash or pour point, no colour, no density, no sulphur or
 * saturates figure, no capacity, no tonnage, no MOQ, no lead time, no market list, no certification
 * and no statement of which groups are refined in-house.
 *
 * That last one is worth naming explicitly, because §4 item 2 asks this page's Overview for
 * "positioning as producer, not reseller" and SITE_STRUCTURE's own Outstanding Confirmations
 * lists "In-house vs. partner-refinery labeling — which base oil groups Sam Group produces itself
 * vs. sources externally" as unresolved. Those two cannot both be honoured, and the higher rule
 * wins: CLAUDE.md §4 forbids publishing an unconfirmed fact. So the Overview below is written
 * about how the range is organised and documented, and makes no origin claim about any group.
 *
 * The typical-properties table is the same case in miniature: §4 item 4 specifies it and marks it
 * `[ESTIMATE — CONFIRM]`. Its axis is real and its cells are empty by instruction.
 */

import type { ProductCategoryContent } from "../category-contract";

/*
 * The downstream-field guard, which used to be declared here. It moved to a module of its own
 * when a second input category needed it — the rule it enforces is unchanged, and the reason it
 * is not duplicated is in that file's own note.
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

export const BASE_OILS: ProductCategoryContent = {
  familyId: "base-oils",

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Base stocks, by group and by grade.",
    lead: "Seven published sub-ranges and the grade designations inside them — organised by sub-range and by grade, with the technical documents held on the same page.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "One category, seven sub-ranges, one document set.",
    body: [
      "A base oil is selected against a sub-range before it is selected against a name. This page is built in that order: the sub-ranges first, then the individual grades inside them, then the documents.",
      "Everything published for this category lives on this page rather than across a catalogue — the sub-ranges, the grade designations, the properties every grade is described on, and the technical documents. There is no per-grade page to hunt for, and no form between a reader and a specification.",
    ],
    /*
     * All four are structural counts or statements this project's documents already make.
     * "Classification · API 1509" was here and has been removed: no project document names that
     * standard, and a marker is exactly where an unapproved attribution reads as a fact.
     */
    markers: [
      { label: "Sub-ranges", value: "Seven" },
      { label: "Named grades", value: "Eight" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Sampling", value: "Before commitment" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "The range, sub-range by sub-range.",
    intro:
      "Seven sub-ranges. Where the range names individual grades, they are printed in full below; where it names the sub-range only, that is the whole of what is published for it today.",
    /*
     * `classificationAxes` is deliberately absent.
     *
     * It previously named the three criteria the API 1509 group system discriminates on. No
     * project document mentions API 1509 or names those criteria — SITE_STRUCTURE §4 gives the
     * group names and the grade designations and nothing more — so the attribution and the axes
     * were unapproved technical content and have been removed rather than reworded.
     *
     * Every `summary` below is now positional: it states where the sub-range sits in the published
     * taxonomy and what it names, and asserts nothing about chemistry, processing or performance.
     */
    subRanges: [
      {
        id: "group-i",
        designation: "Group I",
        summary: "The four SN grades below are the designations this sub-range publishes.",
        grades: [
          { id: "sn-150", designation: "SN 150" },
          { id: "sn-350", designation: "SN 350" },
          { id: "sn-500", designation: "SN 500" },
          { id: "sn-650", designation: "SN 650" },
        ],
      },
      {
        id: "group-ii",
        designation: "Group II",
        summary:
          "Published as a sub-range in its own right; no individual grades are named for it.",
        grades: [],
      },
      {
        id: "group-iii",
        designation: "Group III",
        summary:
          "Published as a sub-range in its own right; no individual grades are named for it.",
        grades: [],
      },
      {
        id: "naphthenic",
        designation: "Naphthenic",
        summary:
          "Published as a sub-range in its own right; no individual grades are named for it.",
        grades: [],
      },
      {
        id: "bright-stock",
        designation: "Bright Stock",
        summary: "Published under one designation, BS 150.",
        grades: [{ id: "bs-150", designation: "BS 150" }],
      },
      {
        id: "synthetics",
        designation: "Synthetics",
        summary: "PAO, Ester and PAG are the designations this sub-range publishes.",
        grades: [
          { id: "pao", designation: "PAO" },
          { id: "ester", designation: "Ester" },
          { id: "pag", designation: "PAG" },
        ],
      },
      {
        id: "virgin-re-refined",
        designation: "Virgin & re-refined",
        summary:
          "Cuts across the sub-ranges above rather than sitting beside them. Which designations are available on which basis is confirmed against an enquiry.",
        grades: [],
      },
    ],
  },

  /* ------------------------------------------------------------ 4 properties */

  properties: {
    heading: "Typical properties.",
    /*
     * Describes the axis and nothing else. The pending-data condition is stated once, by
     * `pendingNote` — saying it here as well put the same sentence on screen twice inside 400px.
     */
    intro: "Every grade in this category is described on the same six properties.",
    /*
     * A single hierarchy, so no `groupingHeading` and therefore no second column. The table
     * carries the grade designation and its parent sub-range; there is no dimension to state.
     */
    labels: {
      rowHeading: "Grade",
      rowSubHeading: "Designation",
      rangeRowLabel: "Sub-range",
      caption: "Typical properties, by grade",
    },
    /*
     * One group, and therefore no `subRangeIds`: every base stock here is described the same way.
     * The plural exists for categories that are not so uniform — see Industrial Oils.
     *
     * **No `method` and no `condition` on any column.** Every property name below appears in
     * SITE_STRUCTURE §7's laboratory list; the ASTM designations and test conditions that used to
     * sit beside them appear in no project document at all, so they were unapproved technical
     * content and are gone. Units are kept: they are intrinsic to the property, not a claim about
     * a product.
     */
    groups: [
      {
        id: "base-stocks",
        label: "Base stocks",
        columns: [
          { key: "kv", label: "Kinematic viscosity", unit: "mm²/s" },
          { key: "vi", label: "Viscosity index" },
          { key: "flash", label: "Flash point", unit: "°C" },
          { key: "pour", label: "Pour point", unit: "°C" },
          { key: "colour", label: "Colour" },
          { key: "density", label: "Density", unit: "kg/m³" },
        ],
        /*
         * Empty, and empty on purpose.
         *
         * SITE_STRUCTURE §4 item 4 specifies this table and marks it `[ESTIMATE — CONFIRM]` —
         * "replace with real lab data". CLAUDE.md §4 forbids seeding a marker like that into a
         * page, so no cell is filled with a plausible-looking figure. Approved lab data is added
         * here and the table renders it with no component change.
         */
        values: {},
      },
    ],
    pendingNote: PENDING_NOTE,
    methodNote: METHOD_NOTE,
  },

  /* --------------------------------------------------------------- 5 quality */

  quality: {
    heading: "Processing and quality.",
    intro:
      "Quality control runs at three stages, and a base oil batch is qualified against the same property axis it is later described on.",
    /*
     * The Base-Oil-only named block (SITE_STRUCTURE §4 item 5; §2 lists it under Our Expertise as
     * "Base Oil Processing / thin film polishing"). Both documents name the process and neither
     * describes it, so this states the name and nothing more — a process description written here
     * would be a process description invented here.
     */
    namedProcess: {
      name: "Thin Film Polishing",
      note: "The named finishing step in this category's product architecture. Its process description belongs to Quality & Certifications and is not restated on a product page.",
    },
    /* §7's three stages, shared — see `defaults.ts` for why they are not restated per category. */
    stages: QUALITY_STAGES,
    /* Property names from §7's laboratory list. No methods: none is named in any project document. */
    tests: [
      { property: "Kinematic viscosity" },
      { property: "Viscosity index" },
      { property: "Flash point" },
      { property: "Pour point" },
      { property: "Colour" },
      { property: "Density" },
    ],
    footnote: QUALITY_FOOTNOTE,
    footnoteLink: { label: "Quality & Certifications", route: "quality" },
  },

  /* ---------------------------------------------------------- 6 applications */

  applications: {
    /*
     * Base Oils is an input, so its destinations are real and are the site's own families. See
     * `ApplicationsBlock` for why this is a mode rather than a presentation choice — a terminal
     * category has no downstream and must not render this device.
     */
    mode: "downstream",
    eyebrow: "Applications",
    heading: "Where a base stock goes next.",
    intro:
      "A base oil is an input. Every destination below is one of this company's own product families, and every field named under it is a range that family already publishes — so this section is a map of the range, not a claim about a market.",
    entries: [
      {
        familyId: "engine-oils",
        note: "Automotive finished fluids, segmented by vehicle type.",
        fields: fields("engine-oils", [
          "Passenger cars",
          "Trucks & buses",
          "Motorcycle & ATV",
          "Agriculture",
          "Construction & mining",
        ]),
      },
      {
        familyId: "industrial-oils",
        note: "Plant fluids, grouped by the machine they serve.",
        fields: fields("industrial-oils", [
          "Hydraulic",
          "Gear",
          "Compressor",
          "Cutting & metalworking",
          "Heat transfer",
          "Industrial greases",
        ]),
      },
      {
        familyId: "marine-oils",
        note: "Engine-room and deck fluids for marine propulsion.",
        fields: fields("marine-oils", [
          "TPEO",
          "Cylinder oils",
          "System oils",
          "Stern tube & gear oils",
          "Marine greases",
        ]),
      },
      {
        familyId: "lubricant-additives",
        note: "The components a base stock is carried into rather than blended with.",
        fields: fields("lubricant-additives", [
          "Transformer oil",
          "White oil",
          "Rubber process oil",
        ]),
      },
    ],
  },

  /*
   * Industries Served (§4 item 7) is deliberately not set.
   *
   * A served-industry list is market coverage, and the market list is an open launch blocker in
   * SITE_STRUCTURE's Outstanding Confirmations. The template supports the section; omitting the
   * field means it does not render at all, which is the honest state rather than a placeholder.
   */

  /* ---------------------------------------------------------------- 8 supply */

  supply: {
    heading: "Packaging and supply.",
    intro:
      "The formats this category is supplied in, and the commercial terms it is quoted against.",
    formats: SUPPLY_FORMATS,
    incoterms: INCOTERMS,
    /*
     * MOQ and lead time are `[TO CONFIRM]` at source and are not stated. This says how they are
     * established, which is a description of a process rather than a figure.
     */
    terms:
      "Minimum quantity, lead time and payment terms are established against a specific grade, format and destination — they are part of the quotation, not a published table.",
    link: { label: "Export & Logistics", route: "exportLogistics" },
  },

  /* --------------------------------------------------------- 10 documentation */

  documentation: {
    heading: "Documents, published and per batch.",
    intro:
      "Three documents are issued for this category. Two describe the grade, one describes the batch you receive — and none of the three sits behind a form.",
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
        // "COA-per-batch" is SITE_STRUCTURE §7's own wording, so the granularity is approved here.
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
      id: "sample-before-commitment",
      // SITE_STRUCTURE §7 Sampling Policy: samples issued at first stage for base oil, before commitment.
      question: "Is a sample available before committing to an order?",
      answer:
        "Yes. For base oils a sample is issued at the first stage of an enquiry, before any commitment.",
      link: { label: "Request a Sample", route: "sample" },
    },
    {
      id: "coa-per-batch",
      // SITE_STRUCTURE §7 Quality & Standards: COA-per-batch, batch traceability.
      question: "Is a Certificate of Analysis issued for every batch?",
      answer:
        "Yes. The COA records the outgoing test result for the batch supplied, not a typical value for the grade.",
    },
    {
      id: "virgin-and-re-refined",
      // SITE_STRUCTURE §4, Base Oils row: "Virgin & Re-refined grades" is part of the frozen taxonomy.
      question: "Are re-refined grades published as well as virgin?",
      answer:
        "Both are in this category's published taxonomy. Which designations are available on which basis is confirmed against an enquiry rather than listed here.",
    },
    {
      id: "blend-to-specification",
      // SITE_STRUCTURE §5: Customized Solutions is the route for formulation to a customer brief.
      question: "Can a stock be supplied to a specification we provide?",
      answer:
        "Formulation to a customer brief is a route of its own rather than a variant of a published grade, and a sample is the first stage of it.",
      link: { label: "Customized Solutions", route: "customization" },
    },
  ],
};
