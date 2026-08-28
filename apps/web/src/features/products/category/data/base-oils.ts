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
  meta: {
    title: "Base Oils | API Groups, SN Grades & Bright Stock | SAM Group",
    description:
      "Review SAM Group base oils by API group and designation, including SN 150, SN 350, SN 500, SN 650, BS 150, PAO, ester and PAG.",
  },

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Base oils, organised for a precise enquiry.",
    lead: "Compare mineral and synthetic base-fluid families, locate the published grade designation, then define the property, volume, packaging and destination your supply brief requires.",
    image: {
      src: "/images/base-oils-lab-samples.webp",
      alt: "Unlabelled laboratory bottles containing base-oil samples in pale gold and amber tones",
      caption: "Base-oil samples · visual comparison before technical review",
    },
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "Start with classification. Confirm with the data sheet.",
    body: [
      "A base-oil group is a classification, not a complete purchasing specification. It helps narrow the field; the required viscosity, property profile, application and approved technical document determine the grade that belongs in the enquiry.",
      "The range below keeps those decisions separate. API Groups I to III, naphthenic oils, bright stock and synthetic fluids remain visible as distinct families, while exact product values stay with the reviewed TDS and batch-specific COA.",
    ],
    /* Structural facts only; the classification explanation is kept in the range section. */
    markers: [
      { label: "Range structure", value: "7 sub-ranges" },
      { label: "Published names", value: "8 designations" },
      { label: "Selection basis", value: "Group + grade" },
      { label: "Document path", value: "TDS · SDS · COA" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "Choose the family. Then confirm the grade.",
    intro:
      "Use the family name to narrow the requirement, then use the reviewed TDS to confirm the exact grade. API grouping provides context; it does not replace viscosity, application and property review.",
    classificationAxes: ["Saturates", "Sulfur", "Viscosity index"],
    /*
     * The three API classification axes are sourced in
     * `docs/content/BASE_OILS_CONTENT_SOURCES.md`. They explain the grouping system; they are not
     * presented as SAM product values. Grade-level values remain in the reviewed TDS only.
     */
    subRanges: [
      {
        id: "group-i",
        designation: "Group I",
        qualifier: "API base-stock group",
        summary:
          "The mineral base-oil route carrying this catalogue's SN 150, SN 350, SN 500 and SN 650 designations. Select the SN grade by the required viscosity and the approved TDS—not by group name alone.",
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
        qualifier: "API base-stock group",
        summary:
          "A distinct API base-stock group commonly considered for automotive and industrial lubricant formulation. Available viscosity grades and property limits are confirmed against the requirement.",
        grades: [],
      },
      {
        id: "group-iii",
        designation: "Group III",
        qualifier: "API base-stock group",
        summary:
          "The API group defined by a viscosity index of 120 or higher together with the Group III saturates and sulfur boundaries. The group label does not replace grade-level technical review.",
        grades: [],
      },
      {
        id: "naphthenic",
        designation: "Naphthenic",
        summary:
          "A separate base-oil family used where characteristics such as solvency and low-temperature behaviour matter to the formulation brief. Suitability is assessed against the intended application and TDS.",
        grades: [],
      },
      {
        id: "bright-stock",
        designation: "Bright Stock",
        summary:
          "A high-viscosity base-stock family represented in the published range by BS 150. Confirm the required viscosity profile, blend role and handling conditions in the enquiry.",
        grades: [{ id: "bs-150", designation: "BS 150" }],
      },
      {
        id: "synthetics",
        designation: "Synthetics",
        summary:
          "Three chemically distinct synthetic-fluid families are published here. PAO is identified as API Group IV; ester and PAG sit within the broader Group V definition and must be selected by chemistry and application, not as interchangeable labels.",
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
          "This is a supply-route distinction across the range, not an additional API group. API grouping follows analysed properties rather than the manufacturing route alone; availability is confirmed grade by grade.",
        grades: [],
      },
    ],
  },

  /* ------------------------------------------------------------ 4 properties */

  properties: {
    heading: "The six properties that define the technical review.",
    /*
     * Describes the axis and nothing else. The pending-data condition is stated once, by
     * `pendingNote` — saying it here as well put the same sentence on screen twice inside 400px.
     */
    intro:
      "Use these fields to compare a requirement with a candidate grade. Values shown on a SAM TDS describe that grade; results on the COA describe the supplied batch.",
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
          {
            key: "kv",
            label: "Kinematic viscosity",
            unit: "mm²/s",
            guidance: "The starting point for matching fluid thickness at a stated temperature.",
          },
          {
            key: "vi",
            label: "Viscosity index",
            guidance: "Indicates how viscosity changes as temperature changes.",
          },
          {
            key: "flash",
            label: "Flash point",
            unit: "°C",
            guidance:
              "A handling and application reference that must be read with its test method.",
          },
          {
            key: "pour",
            label: "Pour point",
            unit: "°C",
            guidance: "Supports review of low-temperature flow requirements.",
          },
          {
            key: "colour",
            label: "Colour",
            guidance: "A reported appearance property, not a standalone measure of performance.",
          },
          {
            key: "density",
            label: "Density",
            unit: "kg/m³",
            guidance:
              "Supports mass–volume conversion and supply calculations at a stated condition.",
          },
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
    heading: "Quality evidence follows the grade and the batch.",
    intro:
      "The selected grade is reviewed against its technical property set. Incoming, in-process and outgoing checks keep the material, process and released batch connected to the documentation used for the enquiry.",
    /*
     * The Base-Oil-only named block (SITE_STRUCTURE §4 item 5; §2 lists it under Our Expertise as
     * "Base Oil Processing / thin film polishing"). Both documents name the process and neither
     * describes it, so this states the name and nothing more — a process description written here
     * would be a process description invented here.
     */
    namedProcess: {
      name: "Thin Film Polishing",
      note: "A named finishing route in the Base Oils portfolio. Its applicability and processing scope are confirmed for the selected grade during technical review.",
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
      "Base oils are formulation inputs. Use these linked product families to move from a base-stock requirement toward the finished lubricant or specialty-fluid context it must support.",
    entries: [
      {
        familyId: "engine-oils-automotive-lubricants",
        note: "Finished engine and automotive lubricant requirements, organised by vehicle and duty.",
        fields: fields("engine-oils-automotive-lubricants", [
          "Passenger cars",
          "Trucks & buses",
          "Motorcycle & ATV",
          "Agriculture",
          "Construction & mining",
        ]),
      },
      {
        familyId: "industrial-oils-lubricants",
        note: "Industrial lubricant requirements, organised by equipment and operating duty.",
        fields: fields("industrial-oils-lubricants", [
          "Hydraulic",
          "Gear",
          "Compressor",
          "Cutting & metalworking",
          "Heat transfer",
          "Industrial greases",
        ]),
      },
      {
        familyId: "marine-oils-lubricants",
        note: "Marine lubricant requirements for propulsion, engine-room and deck systems.",
        fields: fields("marine-oils-lubricants", [
          "TPEO",
          "Cylinder oils",
          "System oils",
          "Stern tube & gear oils",
          "Marine greases",
        ]),
      },
      {
        familyId: "lubricant-additives",
        note: "Related additive-package and specialty-component routes used to complete or extend a formulation brief.",
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
    heading: "Define the grade, pack and delivery basis together.",
    intro:
      "A workable quotation connects the selected base-oil grade with quantity, packaging, destination and Incoterm. Available combinations are confirmed against the complete enquiry.",
    formats: SUPPLY_FORMATS,
    incoterms: INCOTERMS,
    /*
     * MOQ and lead time are `[TO CONFIRM]` at source and are not stated. This says how they are
     * established, which is a description of a process rather than a figure.
     */
    terms:
      "Include the required quantity, preferred packaging and named destination. Minimum quantity, lead time and payment terms are then confirmed in the quotation for that specific supply route.",
    link: { label: "Export & Logistics", route: "exportLogistics" },
  },

  /* --------------------------------------------------------- 10 documentation */

  documentation: {
    heading: "Know which document answers which question.",
    intro:
      "Use the TDS to review typical grade properties, the SDS for safe handling information and the COA to review the released batch. Document availability follows the published product record.",
    documents: [
      {
        code: "TDS",
        label: "Technical Data Sheet",
        scope: "Typical grade properties and referenced test conditions",
        access: "open",
      },
      {
        code: "SDS",
        label: "Safety Data Sheet",
        scope: "Hazards, handling, storage and transport information",
        access: "open",
      },
      {
        code: "COA",
        label: "Certificate of Analysis",
        // "COA-per-batch" is SITE_STRUCTURE §7's own wording, so the granularity is approved here.
        scope: "Released-batch results from outgoing review",
        access: "open",
      },
    ],
    note: "Company and product catalogues use the catalogue-request route on the Products page; grade and batch documents remain associated with the relevant product record.",
  },

  /* ------------------------------------------------------------------ 11 faq */

  faq: [
    {
      id: "documents-before-enquiry",
      // DATA_MODEL.md §DOWNLOAD_REQUEST / DATA_MODEL_GAP_REVIEW.md §5: TDS and SDS explicitly not gated.
      question: "Can I read the specifications before making an enquiry?",
      answer:
        "Published product records provide their available Technical and Safety Data Sheets without a catalogue-request form. Use the TDS for typical grade values and the SDS for handling information.",
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
        "The COA records the outgoing results for the released batch. It should be read as batch evidence, while the TDS remains the reference for typical grade properties.",
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
        "Start with the published range when an existing grade fits. If the requirement needs a different property target or formulation route, submit the specification through Customized Solutions for technical review.",
      link: { label: "Customized Solutions", route: "customization" },
    },
  ],
};
