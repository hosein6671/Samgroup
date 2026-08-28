/**
 * Engine Oils & Automotive Lubricants — the template's sixth and final instance.
 *
 * ── What this category tests ────────────────────────────────────────────────
 *
 * Nothing structural, and one editorial thing that no previous category faced.
 *
 * Structurally it is the simplest page in the set: a single hierarchy of six sub-ranges with no
 * individual designations inside them, terminal rather than upstream, described on one property
 * axis. Every mechanism it uses was proven on Industrial Oils and Marine Oils. This fixture and
 * one route file are the whole of it — no component touched, no type added, no section
 * special-cased.
 *
 * The editorial thing is the half of the taxonomy that does not exist yet. See below.
 *
 * ── The second dimension, and why it is absent ──────────────────────────────
 *
 * `docs/SITE_STRUCTURE.md` §4, Engine Oils row, describes this category as "Segmented by vehicle
 * type (Passenger Cars, Trucks & Buses, Motorcycle & ATV, Agriculture, Construction & Mining,
 * Gardening) × fluid type". The vehicle half is enumerated — six members, named — and it is
 * already published on the frozen Products landing as this family's `ranges`.
 *
 * **The fluid half is named and empty.** The phrase "fluid type" appears in this project's
 * documentation exactly once, in that same sentence, and no document anywhere enumerates a single
 * member of it. An audit of `docs/` found no candidate list that belongs to this category: the
 * closest thing is Lubricant Additives' own taxonomy of additive-package applications, which is
 * approved content for a *different* category and would be an inference about this one's product
 * coverage if borrowed.
 *
 * So this page publishes the dimension it has and states the absence of the other. It does not
 * render six vehicle segments as though they were the whole structure, and it does not fill the
 * second axis with plausible fluid names — a fluid type printed against a vehicle segment is a
 * claim about what this business sells into that segment, and it is exactly the kind of claim a
 * buyer would order against.
 *
 * When a fluid-type list is approved it is added here as a second `axis` on the sub-ranges plus a
 * two-step `selection` Applications block, and **the contract and the components need no change** —
 * that is the shape Antifreeze & Coolants already publishes at three dimensions.
 *
 * ── Where every string here comes from ──────────────────────────────────────
 *
 * The six segments are transcribed from §4's Engine Oils row, in the casing the frozen Products
 * landing already publishes them in (`products-data.ts` — "Passenger cars", "Trucks & buses",
 * "Motorcycle & ATV", "Agriculture", "Construction & mining", "Gardening"). Two adjacent pages in
 * the same family should not print the same six names two different ways.
 *
 * The organising principle is the descriptor that landing already publishes — "Segmented by
 * vehicle type first and fluid type second, so a fleet operator reads the range the way they run
 * it." The Overview restates a string this site already carries rather than composing a new one.
 *
 * The property axis is drawn from §7's laboratory list and nothing else. **Property names only** —
 * no document in this project names a test method, so none is printed. Values are unpublished,
 * exactly as on the five pages before this one.
 *
 * ── The sampling claim, which this category *is* entitled to ────────────────
 *
 * Four of the five previous fixtures carry a note explaining why they omit the sampling marker:
 * §7's Sampling Policy names base oil and engine oil, and extending it to a category the document
 * does not name would be extending a commitment. This is the other category it names — twice, in
 * fact, since §4's own Engine Oils row adds "sample issued at first stage of every enquiry". So
 * the Overview marker and the FAQ entry appear here, as they do on Base Oils, and nowhere else.
 *
 * ── What is not here, and why ───────────────────────────────────────────────
 *
 * No grade names — the frozen taxonomy names none for this category, and unlike Base Oils there is
 * no sub-range with published designations inside it.
 *
 * **No viscosity grade of any kind.** No SAE grade, no ILSAC or API service category, no ACEA
 * sequence, no JASO class, no DEXRON or other transmission-fluid designation, no OEM approval, no
 * drain or service interval, no engine or vehicle compatibility statement. Every one of those is
 * real in the world and absent from every document in this project, and this is the category where
 * inventing one would be least visible and most damaging.
 *
 * No capacity, no MOQ, no lead time, no market list, no certification.
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
 * The one sentence every sub-range summary here is a variation of.
 *
 * Each segment is a vehicle class and nothing more is documented about it, so each summary says
 * that and stops. Six near-identical lines is the honest rendering of six equally-documented
 * members; differentiating them with invented detail is how a taxonomy becomes a claim.
 */
const NO_DESIGNATIONS = "No individual designations are published for it.";

export const ENGINE_OILS_AUTOMOTIVE_LUBRICANTS: ProductCategoryContent = {
  familyId: "engine-oils-automotive-lubricants",
  meta: {
    title: "Engine Oils & Automotive Lubricants | SAM Group",
    /*
     * The six vehicle segments, in the casing the frozen Products landing publishes them in. The
     * category's second dimension is not described here — its members are not published, and a meta
     * description is not the place to introduce a taxonomy the page itself withholds.
     */
    description:
      "Browse engine oils and automotive lubricants by vehicle segment, then define the required grade, specification, volume, packaging and destination.",
  },

  /* ------------------------------------------------------------------ 1 hero */

  hero: {
    headline: "Match the lubricant to the vehicle and duty.",
    lead: "Start with the vehicle segment, then confirm the fluid type, viscosity grade, required specification and operating context against the selected product record.",
    primary: { label: "Request a Quote", route: "quote" },
    secondary: { label: "Request a Sample", route: "sample" },
    image: {
      src: "/images/engine-oils-automotive-lab-samples.webp",
      alt: "Engine-oil samples beside clean bearing and gear components in a laboratory",
      caption: "Automotive lubricant samples · vehicle and duty-led review",
    },
  },

  /* -------------------------------------------------------------- 2 overview */

  overview: {
    heading: "Turn a vehicle list into a reviewable product brief.",
    body: [
      "Vehicle segment is the first filter because it frames hardware, duty cycle and service context. It does not replace the product-level decisions that follow: fluid type, viscosity grade and the specification or approval requested by the buyer.",
      "Provide the make and model where relevant, operating conditions, current grade or reference specification, expected volume and destination. SAM can then locate the recorded product information and identify what still needs technical confirmation.",
    ],
    /*
     * Four structural markers, no commercial figure among them.
     *
     * "Sampling" is carried here and on Base Oils and on no other category: §7's Sampling Policy
     * names those two, and §4's own row for this category repeats it. "Organised by" restates the
     * descriptor the frozen Products landing already publishes for this family.
     */
    markers: [
      { label: "Vehicle segments", value: "Six" },
      { label: "Organised by", value: "Vehicle segment" },
      { label: "Documents", value: "TDS · SDS · COA" },
      { label: "Sampling", value: "Before commitment" },
    ],
  },

  /* ----------------------------------------------------------------- 3 range */

  range: {
    heading: "Choose the vehicle segment, then confirm the grade.",
    intro:
      "Six segments, each named for the vehicle class it is formulated for. The taxonomy names the segments; it names no individual product designations, so none are printed.",
    /*
     * No `axis` on any sub-range: this is a single hierarchy, so the register renders flat and the
     * specification table renders no second column. The category's other dimension is not a second
     * axis waiting to be drawn — it has no published members at all. See the module note.
     *
     * No `classificationAxes` either — see the module note.
     */
    subRanges: [
      {
        id: "passenger-cars",
        designation: "Passenger cars",
        summary: `The segment the range is most often read from. ${NO_DESIGNATIONS}`,
        grades: [],
      },
      {
        id: "trucks-buses",
        designation: "Trucks & buses",
        summary: `Published as one segment, as the taxonomy lists it. ${NO_DESIGNATIONS}`,
        grades: [],
      },
      {
        id: "motorcycle-atv",
        designation: "Motorcycle & ATV",
        summary: `Published as one segment, as the taxonomy lists it. ${NO_DESIGNATIONS}`,
        grades: [],
      },
      {
        id: "agriculture",
        designation: "Agriculture",
        summary: `Named for the vehicle class it serves. ${NO_DESIGNATIONS}`,
        grades: [],
      },
      {
        id: "construction-mining",
        designation: "Construction & mining",
        summary: `Published as one segment, as the taxonomy lists it. ${NO_DESIGNATIONS}`,
        grades: [],
      },
      {
        id: "gardening",
        designation: "Gardening",
        summary: `The smallest-equipment segment the range publishes. ${NO_DESIGNATIONS}`,
        grades: [],
      },
    ],
  },

  /* ------------------------------------------------------------ 4 properties */

  properties: {
    heading: "Read properties in the context of a specific product.",
    intro:
      "Viscosity, low-temperature behaviour, volatility and elemental information support different decisions. Values and methods belong to the reviewed product TDS rather than a family-wide assumption.",
    /*
     * A single hierarchy, so no `groupingHeading` and therefore no second column — there is no
     * dimension to state. Members are segments rather than grades, and the labels say so.
     */
    labels: {
      rowHeading: "Vehicle segment",
      rowSubHeading: "Designation",
      rangeRowLabel: "Vehicle segment",
      caption: "Typical properties, by vehicle segment",
    },
    /*
     * One group, and therefore no `subRangeIds`: every segment here is described the same way.
     *
     * Columns are the engine-oil subset of SITE_STRUCTURE §7's laboratory list — viscosity,
     * viscosity index, flash point, pour point, density, TBN and TAN all appear in it, and this is
     * the category TBN and TAN belong to. **No `method` and no `condition`**: no project document
     * names a test standard, so none is printed.
     *
     * TBN and TAN are left unexpanded and carry no unit. §7 writes them as acronyms and gives no
     * unit for either, and the Marine fixture set the precedent when it left TPEO standing exactly
     * as the taxonomy prints it. Units elsewhere are kept because they are intrinsic to the
     * property; one that the source document does not give is not invented here.
     */
    groups: [
      {
        id: "engine-oils",
        label: "Engine oils",
        columns: [
          { key: "kv", label: "Kinematic viscosity", unit: "mm²/s" },
          { key: "vi", label: "Viscosity index" },
          { key: "flash", label: "Flash point", unit: "°C" },
          { key: "pour", label: "Pour point", unit: "°C" },
          { key: "density", label: "Density", unit: "kg/m³" },
          { key: "tbn", label: "TBN" },
          { key: "tan", label: "TAN" },
        ],
        /* Empty, for the same reason as every other category: no approved lab data exists. */
        values: {},
      },
    ],
    pendingNote: PENDING_NOTE,
    methodNote: METHOD_NOTE,
  },

  /* --------------------------------------------------------------- 5 quality */

  quality: {
    heading: "Connect the product record to the supplied batch.",
    intro:
      "Quality control runs at the same three stages as every category, and a batch is qualified against the same property axis it is later described on.",
    /* No `namedProcess` — SITE_STRUCTURE §4 item 5 gives that block to Base Oils alone. */
    stages: QUALITY_STAGES,
    tests: [
      { property: "Kinematic viscosity" },
      { property: "Viscosity index" },
      { property: "Flash point" },
      { property: "Pour point" },
      { property: "TBN" },
      { property: "TAN" },
      { property: "Elemental analysis" },
    ],
    footnote: QUALITY_FOOTNOTE,
    footnoteLink: { label: "Quality & Certifications", route: "quality" },
  },

  /*
   * §4 item 6, Applications, is deliberately not set — the same handling Industrial Oils and
   * Marine Oils get, and for a reason this category makes especially clear.
   *
   * `downstream` does not apply: an engine oil is terminal, nothing on this site is made from it,
   * and the manifold must not render.
   *
   * `selection` does not apply either, and this is the sharp case. A selection sequence names the
   * axes a buyer resolves in order, and this category has exactly one published axis — so the
   * sequence would be a single step whose options are the six rows already listed directly above
   * it. The step that would make it a real sequence is the fluid type, and that dimension has no
   * published members. A one-step gate restating the register is filling a slot, not answering the
   * question the slot asks.
   *
   * Reported as a content gap rather than closed with invented copy. It closes on its own the day
   * a fluid-type list is approved, with no contract change.
   */

  /* ---------------------------------------------------------------- 8 supply */

  supply: {
    heading: "Define volume, packaging and destination together.",
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
    heading: "Use the TDS, SDS and COA for different decisions.",
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
      id: "sample-before-commitment",
      // SITE_STRUCTURE §7 Sampling Policy names base oil and engine oil; §4's Engine Oils row repeats it.
      question: "Is a sample available before committing to an order?",
      answer:
        "Yes. For engine oils a sample is issued at the first stage of an enquiry, before any commitment.",
      link: { label: "Request a Sample", route: "sample" },
    },
    {
      id: "fluid-types",
      // SITE_STRUCTURE §4 names the dimension and enumerates no member of it. See the module note.
      question: "Is the range published by fluid type as well as by vehicle?",
      answer:
        "Not on this page. The vehicle segment is the published dimension; the fluid types within each segment are pending technical confirmation, so none is listed rather than being estimated. Which fluid applies to a given vehicle is confirmed against an enquiry and stated in the Technical Data Sheet.",
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
      question: "Can a fluid be supplied to a specification we provide?",
      answer:
        "Formulation to a customer brief is a route of its own rather than a variant of a published product, and a sample is the first stage of it.",
      link: { label: "Customized Solutions", route: "customization" },
    },
  ],
};
