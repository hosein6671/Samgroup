/**
 * Quality & Certifications page content, as fixtures.
 *
 * ── What this module is ─────────────────────────────────────────────────────
 *
 * Same contract as `home-data.ts`, `products-data.ts` and `solutions-data.ts`: every export is the
 * *shape* of a real fetch, so wiring this page up later is a swap of this module rather than a
 * rewrite of the components. A hardcoded repeating list in JSX is the one pattern the project
 * forbids outright (PROJECT_HANDOFF §6.7).
 *
 * `about-data.ts` used to be the fourth name in that list. It is gone: the About page was cut over
 * to the Payload `AboutUs` Global in CMS-1, and its fixture was deleted rather than kept as a
 * fallback. That is the shape this module's own cutover will take.
 *
 * The shapes track the **Payload `QualityCertifications` Global** field-for-field
 * (`docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md` §Quality & Certifications): `heroTitle`,
 * `qualityApproach[]` (`stage`, `description`), `laboratoryCapability` (rich text +
 * `testsPerformed[]`), `certifications` (a *relation* to the `Certifications` collection),
 * `documentationProvided[]`, `samplingPolicyText`.
 *
 * ── The hardest constraint on this page, stated once ────────────────────────
 *
 * This is, in the source document's own framing, the highest-stakes page on the platform for
 * accuracy. SITE_STRUCTURE §7 is emphatic that **no placeholder certification is ever published**,
 * and it marks the certificate list, the in-house/outsourced split, and lab photography as open.
 *
 * So, exhaustively, **nothing in this file states**: a certificate, standard, licence,
 * accreditation, issuing body, certificate number or validity date; a test method designation; a
 * test condition; a numerical result of any kind; a pass criterion; a testing frequency; a
 * sampling rate; a capacity, market, customer or headcount. Several of those have no field here at
 * all — absent rather than empty, so a plausible guess cannot be dropped into a slot later by
 * accident.
 *
 * What *is* published is the four things the documentation actually confirms: three testing
 * stages, fourteen property names, six documents, and the sampling policy. Everything else is
 * stated as withheld, on the page, in the reader's view.
 */

import { PRODUCT_CATEGORIES, ROUTES } from "@/features/site/site-routes";

/* ------------------------------------------------------------------ anchors */

/** In-page anchors, written once so no `#` string is retyped in a component. */
export const ANCHORS = {
  approach: "quality-approach",
  laboratory: "laboratory-capability",
  certifications: "certifications",
  documentation: "documentation",
  sampling: "sampling-policy",
  next: "next-step",
} as const;

/* --------------------------------------------------------------- media slot */

/**
 * A designed media slot: a frame the page reserves for an asset that does not exist yet.
 *
 * ── Why the type is declared here rather than imported ──────────────────────
 *
 * About Us declares an identical five-field record. Importing it would make `features/about` a
 * dependency of `features/quality` — one page feature reaching into another for a type, which is a
 * coupling neither page needs and which no page on this platform has today. Five fields restated
 * is the cheaper of the two, and the duplication is recorded rather than silent.
 *
 * `alt` is **queued, not applied**. No `<img>` renders today, so it is attached to nothing; it is
 * the alt text the future upload inherits. The placeholder's own state ("Image pending") is real
 * text in the document, so assistive technology is told the frame is empty rather than told
 * nothing.
 */
export type MediaSlot = {
  readonly id: string;
  /** What the asset is of. Rendered in the frame as the commission. */
  readonly intent: string;
  /** The caption area's copy — what the finished asset is expected to show. */
  readonly caption: string;
  /** Alt text for the future upload. Applied to nothing today; see above. */
  readonly alt: string;
  /** Always true at proof stage. It is a field, not an assumption, so the frame reads it. */
  readonly pending: true;
};

/**
 * One slot, not three.
 *
 * `PAYLOAD_CONTENT_ARCHITECTURE.md` §Quality & Certifications lists this Global's media as "Hero
 * image; lab/testing photography". Only the second is reserved here.
 *
 * The hero's right column carries the verification chain instead — the same compositional weight,
 * and the index device every hero on this platform uses (the Products landing a riser diagram, a
 * category page a stratigraphic column, Customized Solutions a numbered sequence). About Us
 * already reserves a facility frame in exactly that position; a second empty frame in the same
 * slot on the adjacent corporate page would read as a template rather than as a commission, and
 * the instruction for these placeholders is not to force one into every section.
 *
 * **Consequence, recorded not worked around:** the Global's `heroImage` field has no slot on this
 * page. Whether that field is dropped for this Global or whether the hero gains a frame is a CMS
 * decision (CLAUDE.md §5), out of scope for a frontend task, and noted here so it is not
 * discovered as a surprise during M2.
 */
export const MEDIA: Record<"laboratory", MediaSlot> = {
  laboratory: {
    id: "quality-laboratory",
    intent: "Laboratory · testing bench",
    caption: "Quality laboratory during batch testing — instruments and bench, not portraits.",
    alt: "Sam Group quality laboratory during batch testing",
    pending: true,
  },
};

/* --------------------------------------------------------------------- hero */

export type PageIntro = {
  /** Payload `heroTitle`. */
  readonly heading: string;
  readonly eyebrow: string;
  readonly lead: string;
  readonly primary: { readonly label: string; readonly href: string };
  readonly secondary: { readonly label: string; readonly href: string };
  /** The index's own heading — the hero states what the chain below it is. */
  readonly indexLabel: string;
};

/**
 * Hero copy.
 *
 * `heading` is the source document's own title for this page, verbatim (SITE_STRUCTURE §7:
 * 'Hero ("Quality You Can Verify")'). It is not a phrase written for this build.
 *
 * The lead claims exactly two things, both already published elsewhere on this platform from the
 * same documentation: testing happens at three stages (§7's Quality Approach), and a certificate
 * of analysis is issued per batch (§2's "COA-per-batch", already carried by About Us's quality
 * commitments). The third sentence is about the page rather than about the company, which is the
 * only kind of additional claim this page is in a position to make.
 *
 * Neither action points at this page. `ROUTES.qualityCertifications` appears nowhere in this
 * feature — see `CLOSING`.
 */
export const INTRO: PageIntro = {
  eyebrow: "Quality & certifications",
  heading: "Quality You Can Verify",
  lead: "Testing happens at three stages, and every batch is released against a certificate of analysis. What follows is what the documentation confirms — stated plainly, including the places where it confirms nothing.",
  primary: { label: "Request a sample", href: ROUTES.contactUs },
  secondary: { label: "See the product range", href: ROUTES.products },
  indexLabel: "Verification chain",
};

/* ---------------------------------------------------------------- approach */

/**
 * One testing stage.
 *
 * ── `when` restates the stage name and adds nothing to it ───────────────────
 *
 * This is deliberate, and it is the whole constraint of the section. SITE_STRUCTURE §7 supplies
 * the three stage names — "Incoming/In-Process/Outgoing testing stages" — and supplies no
 * procedure, no test list, no criterion and no frequency for any of them. So each line below says
 * only *when in the material's passage the stage sits*, which is the meaning already carried by
 * the stage's own name, rather than describing what is done inside it.
 *
 * The same handling About Us's `Position` type carries for its three approved facts, and for the
 * same reason: elaborating a quality stage is writing a procedure, and no document here authorises
 * one.
 */
export type QualityStage = {
  readonly id: string;
  /** Payload `qualityApproach[].stage`. */
  readonly name: string;
  /** Payload `qualityApproach[].description`, at the only length the source supports. */
  readonly when: string;
};

export const APPROACH: {
  readonly heading: string;
  readonly lead: string;
  readonly stages: readonly QualityStage[];
  readonly footnote: string;
} = {
  heading: "Three stages, in the order a batch meets them.",
  lead: "The documentation names the stages at which testing happens. It is a sequence, not a checklist, and each stage is named below by where it sits rather than by what it contains.",
  stages: [
    {
      id: "incoming",
      name: "Incoming",
      when: "Before material enters production.",
    },
    {
      id: "in-process",
      name: "In-Process",
      when: "While the batch is being produced.",
    },
    {
      id: "outgoing",
      name: "Outgoing",
      when: "Before the batch is released.",
    },
  ],
  /**
   * The gap in this section, stated in the section.
   *
   * A reader shown three stage names will fill in what happens inside them unless told that the
   * page is not saying. This says it.
   */
  footnote:
    "Which tests run at which stage is not published here. The documentation names the three stages and does not describe what happens inside them, so neither does this page.",
};

/* -------------------------------------------------------------- laboratory */

/**
 * One property the laboratory tests for.
 *
 * A name, and nothing else. `method`, `condition` and `value` are **not fields on this type** —
 * the same absence `PropertyColumn` carries on the category template, recorded there at length:
 * an audit found that no project document names a single test standard, and a wrong method number
 * cited against a real property is a technical error a buyer would specify against.
 *
 * So there is no slot here for an ASTM designation, an ISO method, a temperature, a duration or a
 * result. When a technical reviewer approves a method list, this type gains a field and the
 * component renders it unchanged.
 */
export type LabProperty = {
  readonly id: string;
  readonly name: string;
};

/** One attribute the page deliberately does not publish, and the reason. */
export type Unpublished = {
  readonly id: string;
  readonly name: string;
  readonly why: string;
};

/**
 * Payload `laboratoryCapability` — the rich text, plus the `testsPerformed` array.
 *
 * **The fourteen are the source's own fourteen, in the source's own order.** SITE_STRUCTURE §7
 * lists "viscosity, VI, flash/pour point, colour, density, TBN, TAN, water content, foam, copper
 * corrosion, coolant freeze point/reserve alkalinity, ICP elemental analysis". Nothing is added to
 * that list, nothing is dropped from it, and it is not regrouped — a grouping (fluids vs. coolants,
 * physical vs. chemical) would be a taxonomy this project has not written down, asserted on the
 * page as though it had.
 */
export const LABORATORY: {
  readonly heading: string;
  readonly lead: string;
  readonly registerLabel: string;
  readonly orderNote: string;
  readonly properties: readonly LabProperty[];
  readonly unpublishedHeading: string;
  readonly unpublished: readonly Unpublished[];
} = {
  heading: "What the laboratory tests for.",
  lead: "Fourteen properties are named in the documentation. They are listed below exactly as it lists them — as properties, with no method, no condition and no result attached to any of them.",
  registerLabel: "Properties tested",
  orderNote: "Source order",
  properties: [
    { id: "viscosity", name: "Viscosity" },
    { id: "viscosity-index", name: "Viscosity index" },
    { id: "flash-point", name: "Flash point" },
    { id: "pour-point", name: "Pour point" },
    { id: "colour", name: "Colour" },
    { id: "density", name: "Density" },
    { id: "tbn", name: "TBN" },
    { id: "tan", name: "TAN" },
    { id: "water-content", name: "Water content" },
    { id: "foam", name: "Foam" },
    { id: "copper-corrosion", name: "Copper corrosion" },
    { id: "coolant-freeze-point", name: "Coolant freeze point" },
    { id: "reserve-alkalinity", name: "Reserve alkalinity" },
    { id: "icp-elemental-analysis", name: "ICP elemental analysis" },
  ],
  unpublishedHeading: "Four things this register does not carry",
  unpublished: [
    {
      id: "method",
      name: "Test method",
      why: "No standard designation is named against any property. No approved document in this project carries one, and a method cited wrongly is an error a buyer would specify against.",
    },
    {
      id: "condition",
      name: "Test condition",
      why: "Temperatures, durations and loads are not published. The documentation names properties and never the conditions they are measured at.",
    },
    {
      id: "value",
      name: "Typical value",
      why: "No number appears on this page. The typical-properties tables are marked at source as estimates to be replaced with real lab data.",
    },
    {
      id: "location",
      name: "In-house or external",
      why: "Which of the fourteen are run in-house rather than at a partner laboratory is marked unconfirmed at source, so the page claims neither.",
    },
  ],
};

/* ---------------------------------------------------------- certifications */

/**
 * The withheld section.
 *
 * ── Why this is three strings and not an array ──────────────────────────────
 *
 * Every other repeating section on this platform is a repeater, because every other section has
 * items. This one has none, and the type says so: there is **no `certifications` array here, no
 * `logos` field, no `issuingBody`, no `certificateNumber`, no `validUntil`** — not empty versions
 * of them, absent. A card grid with six pending slots would publish the *shape* of a certification
 * claim, and a reader counts empty slots.
 *
 * The Payload Global models this as a relation to the `Certifications` collection, which is the
 * right model and is exactly why nothing is needed here: when that collection has approved rows,
 * this constant is replaced by the relation's result and a register component is written against
 * it. Today the honest render is one statement.
 *
 * SITE_STRUCTURE §7 and §2, and About Us's quality footnote, all point at this section. It is the
 * page the platform sends people to for this list, so saying nothing at all would be the one
 * reading a visitor cannot recover from.
 */
export const CERTIFICATIONS: {
  readonly eyebrow: string;
  readonly heading: string;
  readonly status: string;
  readonly statement: string;
  readonly note: string;
} = {
  eyebrow: "Certifications",
  heading: "Not published, and not stood in for.",
  status: "Withheld · unconfirmed",
  statement:
    "No certificate, standard, licence, accreditation, issuing body, certificate number, validity date or mark appears in this section, in any form. The list this company holds is unconfirmed, and a placeholder here would be the one claim on the page a reader has no way to check.",
  note: "It is published when the list is confirmed, and not before.",
};

/* ---------------------------------------------------------- documentation */

/**
 * One document issued with supply — Payload `documentationProvided[]`.
 *
 * `scope` is populated for exactly one entry. SITE_STRUCTURE §2 states the certificate of analysis
 * is issued per batch, so that granularity has a document behind it; §7 names the other five and
 * says nothing about what each is issued against. The same restraint the category template's
 * documentation register already applies, where one claim about per-designation issuance was
 * removed for going further than the source.
 *
 * **There is no `access` field and no `href`.** The category register carries an open/gated split
 * because the Products landing owns a download gate; this page owns none, and whether any of these
 * six can be downloaded from this site is not confirmed. A field that does not exist cannot imply
 * a download.
 */
export type ProvidedDocument = {
  readonly id: string;
  readonly name: string;
  readonly scope?: string;
};

export const DOCUMENTATION: {
  readonly heading: string;
  readonly lead: string;
  readonly registerLabel: string;
  readonly documents: readonly ProvidedDocument[];
  readonly note: string;
} = {
  heading: "What arrives with the goods.",
  lead: "Six documents are named in the documentation. They are the paperwork a shipment carries, listed as the source lists them.",
  registerLabel: "Documents provided",
  documents: [
    {
      id: "coa",
      name: "Certificate of Analysis (COA)",
      scope: "Issued per batch.",
    },
    { id: "tds", name: "Technical Data Sheet (TDS)" },
    { id: "sds", name: "Safety Data Sheet (SDS)" },
    { id: "certificate-of-origin", name: "Certificate of Origin" },
    { id: "commercial-documents", name: "Commercial documents" },
    { id: "loading-photos", name: "Loading photos" },
  ],
  /**
   * The one line that keeps this register from reading as a download list.
   *
   * Six document names under a heading, on a website, is read as six files unless the page says
   * otherwise. Nothing here is a link and nothing here is a file.
   */
  note: "Nothing in this register is a download. These are documents issued with supply, and this page does not state where any of them can be obtained from this site.",
};

/* -------------------------------------------------------------- sampling */

/**
 * The families the sampling policy is confirmed for, taken from the canonical table.
 *
 * ── Why this is a lookup and not two typed names ────────────────────────────
 *
 * SITE_STRUCTURE §7 confirms the policy "for base oil and engine oil". Retyping those two names
 * here would put a third copy of a frozen taxonomy on the platform — one that could drift from the
 * header, the Products landing and the six category pages, all of which read `PRODUCT_CATEGORIES`.
 *
 * The invariant is checked rather than trusted, in the same spirit as `propertyGroups` on the
 * category contract: if a canonical href is ever renamed, this page fails loudly at module load
 * instead of quietly rendering a sampling policy that names one family, or none.
 */
const SAMPLING_FAMILY_HREFS: readonly string[] = [
  "/products/base-oils",
  "/products/engine-oils-automotive-lubricants",
];

export const SAMPLING_FAMILIES = PRODUCT_CATEGORIES.filter((family) =>
  SAMPLING_FAMILY_HREFS.includes(family.href),
);

if (SAMPLING_FAMILIES.length !== SAMPLING_FAMILY_HREFS.length) {
  throw new Error(
    `quality-data: sampling policy expects ${SAMPLING_FAMILY_HREFS.length} product families, resolved ${SAMPLING_FAMILIES.length}`,
  );
}

/**
 * Payload `samplingPolicyText`.
 *
 * ── The strongest confirmed content on this page ────────────────────────────
 *
 * SITE_STRUCTURE states it three times independently — §1's custom-formulation note, §4's engine
 * oils row, and §7's Sampling Policy — and it is the one thing in this area marked as confirmed
 * rather than as an estimate. It is given the page's largest type for that reason: the composition
 * follows the evidence, so the sentence with three documents behind it is the sentence set largest.
 *
 * `limit` is not a hedge. §7 confirms the policy for base oil and engine oil and does not extend
 * it to the other four families, so neither does this page.
 *
 * ── There is no `heading` field, and that is not an omission ────────────────
 *
 * Every other section here carries a heading and a body. This one carries the statement alone,
 * rendered as the section's own `<h2>`. The Payload Global's field for this section is
 * `samplingPolicyText` and nothing else — a separate heading would be copy invented to fill a slot
 * the CMS does not have, and it would sit between the eyebrow and the statement doing the work
 * neither of them needs done.
 */
export const SAMPLING: {
  readonly eyebrow: string;
  readonly statement: string;
  readonly familiesLabel: string;
  readonly limit: string;
} = {
  eyebrow: "Sampling policy",
  statement:
    "A sample is issued at the first stage of an enquiry, before commitment — not at the end of a negotiation.",
  familiesLabel: "Confirmed for",
  limit:
    "Confirmed for these two families. The documentation does not extend the policy to the other four, so this page does not extend it either.",
};

/* ---------------------------------------------------------------- closing */

/**
 * The closing CTA.
 *
 * ── Established vocabulary, and no self-reference ───────────────────────────
 *
 * Four destinations, none of them this page. `ROUTES.qualityCertifications` is referenced nowhere
 * in this feature — a closing CTA that points at the page it closes is a loop, not a next step,
 * and the same rule About Us records for `ROUTES.aboutUs`.
 *
 * The lead states the two facts this page has already established rather than introducing a
 * third at the moment the reader is asked to act: the sample is issued first, and every batch
 * carries its certificate. Both are confirmed above.
 *
 * Every href resolves through the canonical table, so no path is retyped and none is a proof
 * path — they 404 today for the same reason every canonical link on every proof page does.
 */
export const CLOSING: {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lead: string;
  readonly primary: { readonly label: string; readonly href: string };
  readonly routes: readonly {
    readonly id: string;
    readonly label: string;
    readonly href: string;
  }[];
} = {
  eyebrow: "Next step",
  heading: "Ask for the evidence.",
  lead: "A sample is issued at the first stage, and every batch is released against its certificate of analysis. Both start with a specification.",
  primary: { label: "Request a quote", href: ROUTES.requestQuote },
  routes: [
    { id: "products", label: "See the product range", href: ROUTES.products },
    { id: "customized", label: "Request a custom solution", href: ROUTES.customizedSolutions },
    { id: "contact", label: "Contact us", href: ROUTES.contactUs },
  ],
};
