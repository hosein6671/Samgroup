/**
 * Flagship homepage content, as fixtures.
 *
 * Every export is the shape of a real fetch. When M2 lands, the product families come from
 * `GET /api/v1/categories`, the insights from the blog endpoint, and the editorial copy from
 * Payload — the components consuming them do not change. That is why this file exists rather
 * than the values living in JSX: a hardcoded repeating list is the one pattern the project
 * forbids outright (PROJECT_HANDOFF §6.7).
 *
 * ── The homepage is now specified by `Sam Group Website Structure_v2.xlsx` ───────────────────
 *
 * The owner made that file the single content source of truth on 2 September 2026, above
 * `Completed.xlsx`, `SITE_STRUCTURE.md` and any existing implementation — recorded in
 * `AI_CONTEXT.md`. Its `Home Page` sheet specifies eight segments plus the footer, and the
 * sections in `sections/` map one-to-one onto them:
 *
 *   Hero · Who We Are · Company Statistics · Product Portfolio Overview ·
 *   Why Choose Sam Group · Industries We Serve · Custom Formulation Highlight ·
 *   Latest News / Insights
 *
 * The sheet's Title and Supporting Text columns are approved content. The copy below is written
 * FROM them rather than pasted: the owner asked for one continuous editorial voice and for no
 * duplicate messaging between the Hero, Who We Are, Why Choose and Custom Formulation segments,
 * which a literal transcription of eight independently-written rows does not give.
 *
 * ── No figure on this page is unverified, and that is new ───────────────────────────────────
 *
 * The previous homepage carried illustrative prototype numbers throughout — blending capacity,
 * countries served, production lines, lab instruments, test volumes, distributor counts, on-time
 * percentages, first-pass yield — and a rendered banner (`sections/demo-data-notice.tsx`) saying
 * so. **Every one of those figures is gone with the sections that carried them**, so the banner
 * is gone too: its own note said it "is deleted by the gate that supplies that data (or that
 * removes the metrics)", and this is the gate that removes them.
 *
 * What remains numeric is countable from this repository — six product families, six
 * customization steps, one enquiry route — and nothing here asserts a company fact that has not
 * been confirmed.
 *
 * ── No certification, standard, licence, approval or market is named in this file ────────────
 *
 * A `CERTS` list of ten (ISO 9001:2015, ISO 14001, ISO 45001, API Licensed, ACEA, ILSAC GF-6,
 * IATF 16949, SGS, REACH, ASTM) once fed a marquee under the hero; it was removed rather than
 * annotated, because SITE_STRUCTURE §7 forbids publishing a placeholder certification under any
 * framing. The product families below carried the same defect in a quieter form — a
 * `["Standards", "API SP · ACEA C3"]` row per family — and those rows are removed here.
 *
 * **Markets are held to the same rule, and the authority is the workbook's `Notes` sheet**, which
 * the owner named as the factual authority for market claims: Africa, the countries around India,
 * and Türkiye. The `Home Page` sheet's "worldwide" and "global partnerships" phrasing is NOT
 * reproduced, because the Notes sheet does not support it.
 *
 * **Nothing here may name a certificate, standard, licence, accreditation, issuing body, OEM
 * approval, market, capacity or company statistic until the real value is confirmed.**
 */

import { ROUTES } from "@/features/site/site-routes";

/* ------------------------------------------------------------------ 1 · hero */

/**
 * The icon a fact is drawn with, as a NAME rather than a component.
 *
 * This file is the shape of a real fetch, so nothing in it may be a React reference — an API
 * cannot send one. The consuming component maps the name to a glyph from
 * `features/site/icons.tsx`, which is the same separation `ContentTranslation` will need when
 * these fixtures become live content.
 */
export type FactIcon = "families" | "catalogue" | "enquiry-route";

export type Fact = { readonly value: string; readonly label: string; readonly icon?: FactIcon };

/**
 * The hero's panel — the catalogue's own shape, not a credibility claim.
 *
 * Every value is countable from this repository: six families in `PRODUCT_CATEGORIES`, six steps
 * in `CUSTOM_STEPS` below, one inquiry route. The Trust Indicators segment further down carries
 * the credibility message, and it carries no numbers at all — which is what keeps the two from
 * saying the same thing twice.
 */
export const HERO_SPEC: readonly Fact[] = [
  { label: "Product families", value: "6", icon: "families" },
  { label: "Customization steps", value: "6", icon: "catalogue" },
  { label: "Structured enquiry route", value: "1", icon: "enquiry-route" },
];

/**
 * The product route — the hero's schematic, as data. **Six stages.**
 *
 * It ran five and the missing one was Quality control, which is not a detail: the workbook's
 * `EXPORT & LOGISTICS` sheet gives the supply chain as Production → **Quality Control** →
 * Packaging → … , and the `Home Page` sheet's advantages promise that products are tested and
 * evaluated before release. The route was drawing a product that went from blend to packaging
 * without either. It now sits where that sheet puts it — after the grade is set, before anything
 * is packed.
 *
 * The detail lines name no certificate, standard, licence or approval. They describe what a stage
 * *is* — a fraction, a package, a property, a shipping unit — and stop there. "Tested before
 * release" is the same claim the Why Choose segment already publishes, in fewer words; it names no
 * test, no method and no issuing body.
 */
export type RouteStep = {
  readonly index: string;
  readonly name: string;
  readonly detail: string;
  readonly icon: "base-stock" | "blend" | "grade" | "quality" | "packaging" | "destination";
};

export const HERO_ROUTE: readonly RouteStep[] = [
  { index: "01", name: "Base stock", detail: "Refined base fractions", icon: "base-stock" },
  { index: "02", name: "Blend", detail: "Additive package", icon: "blend" },
  { index: "03", name: "Grade", detail: "Viscosity and properties", icon: "grade" },
  { index: "04", name: "Quality control", detail: "Tested before release", icon: "quality" },
  { index: "05", name: "Packaging", detail: "Bulk, flexitank, drum", icon: "packaging" },
  { index: "06", name: "Destination", detail: "Port and shipping term", icon: "destination" },
];

/* --------------------------------------------------------- 2 · who we are */

/**
 * Who We Are — the sheet's second segment.
 *
 * Its stated purpose is the whole point of the section: **"Introduce Sam Group as a manufacturer,
 * not a trading company."** Everything below serves that one sentence, and the section deliberately
 * says nothing about product range, advantages or customization — those are segments 4, 5 and 7,
 * and repeating them here is exactly the duplication the owner asked to remove.
 */
export type WhoWeAreClaim = {
  readonly index: string;
  readonly icon: "produce" | "formulate" | "supply";
  readonly term: string;
  readonly detail: string;
};

export const WHO_WE_ARE: readonly WhoWeAreClaim[] = [
  {
    index: "01",
    icon: "produce",
    term: "We produce",
    detail: "Base oils, engine oils, lubricants and additives — made, not bought in and resold.",
  },
  {
    index: "02",
    icon: "formulate",
    term: "We formulate",
    detail: "Products developed against a stated technical and commercial requirement.",
  },
  {
    index: "03",
    icon: "supply",
    term: "We supply",
    detail: "Packaging and volumes arranged around the product and the route it travels.",
  },
];

/* ------------------------------------------------- 3 · company statistics */

/**
 * The sheet's third segment, titled **Trust Indicators** — and its Supporting Text and Buttons
 * cells are **empty**. It says a credibility block belongs here and does not say what goes in it.
 *
 * So this carries no statistics. Each indicator restates something the workbook itself supports:
 * the manufacturer position (the Who We Are segment's stated purpose), the sample-first step (the
 * `Notes` sheet, twice — engine oil and base oil both begin with a sample), custom formulation
 * (the Customized Solutions sheet), and packaging flexibility (the Export & Logistics sheet).
 *
 * **A number here would have to be invented, and the owner ruled that out.** When audited figures
 * exist, they belong in this shape.
 */
export type Indicator = {
  readonly icon: "manufacturer" | "sample" | "formulation" | "packaging";
  readonly title: string;
  readonly body: string;
};

export const TRUST_INDICATORS: readonly Indicator[] = [
  {
    icon: "manufacturer",
    title: "Direct manufacturer",
    body: "Your specification reaches the people who produce the product, without an intermediary in between.",
  },
  {
    icon: "sample",
    title: "Sample before commitment",
    body: "Engine oil and base oil enquiries begin with a sample, so the product is evaluated before anything is agreed.",
  },
  {
    icon: "formulation",
    title: "Formulation to requirement",
    body: "Where the catalogue does not answer the need, the product is developed against the requirement instead.",
  },
  {
    icon: "packaging",
    title: "Supply built around the order",
    body: "Bulk, flexitank, IBC and drum, selected for the volume and the route rather than offered as a fixed list.",
  },
];

/* ------------------------------------------- 4 · product portfolio overview */

/**
 * The six product families, as the homepage presents them.
 *
 * `id` and `key` are separate on purpose: `id` is the orbital station this family returns to in
 * `visuals/orbit-visual.tsx`, and `key` is the canonical `ProductFamilyKey` that addresses its
 * page. Keeping them apart is what lets the visual be reordered without moving a URL.
 *
 * `angle` places the station on the orbital plane; six families sit at 60° intervals.
 *
 * **`specs` names no standard.** Each row describes a property of the family — what it covers,
 * how it is packaged, what an enquiry needs — and never a specification a certificate would have
 * to back.
 */
export type Family = {
  readonly id: string;
  readonly key: string;
  readonly code: string;
  /** The full family name. Detail panel, link label, and the page's own vocabulary. */
  readonly name: string;
  /**
   * The orbit's label, and the tab strip's.
   *
   * "Engine Oils & Automotive Lubricants" is 35 characters. As a pill riding a rotating ring it
   * crosses the core, its neighbours and the stage edge — there is no rotation phase in which a
   * label that long does not collide with something. The full name is still what the detail panel
   * and the link say; this is the schematic's label, and a schematic label has to be short enough
   * to read while it moves.
   */
  readonly short: string;
  readonly sub: string;
  readonly angle: number;
  readonly body: string;
  readonly specs: readonly (readonly [string, string])[];
};

export const FAMILIES: readonly Family[] = [
  {
    id: "base",
    key: "base-oils",
    code: "BO",
    name: "Base Oils",
    short: "Base Oils",
    sub: "Blending base stock",
    angle: -90,
    body: "Refined base fractions supplied to lubricant manufacturers and blenders, and used as the starting point for the formulations below.",
    specs: [
      ["Supplied as", "Bulk and flexitank"],
      ["Enquiry needs", "Grade, volume, destination"],
    ],
  },
  {
    id: "add",
    key: "lubricant-additives",
    code: "AD",
    name: "Lubricant Additives & Components",
    short: "Additives",
    sub: "Performance components",
    angle: -30,
    body: "Additive components and packages for blenders formulating their own products, selected against the performance the finished lubricant has to reach.",
    specs: [
      ["Supplied as", "Drum and IBC"],
      ["Enquiry needs", "Application and target property"],
    ],
  },
  {
    id: "eng",
    key: "engine-oils-automotive-lubricants",
    code: "EO",
    name: "Engine Oils & Automotive Lubricants",
    short: "Engine Oils",
    sub: "Engine, transmission and driveline",
    angle: 30,
    body: "Finished lubricants for road transport and vehicle fleets, covering engine, transmission and driveline applications across viscosity grades.",
    specs: [
      ["Supplied as", "1 L to 208 L, and bulk"],
      ["Enquiry needs", "Equipment and operating conditions"],
    ],
  },
  {
    id: "ind",
    key: "industrial-oils-lubricants",
    code: "IN",
    name: "Industrial Oils & Lubricants",
    short: "Industrial",
    sub: "Plant, hydraulics and gearing",
    angle: 90,
    body: "Hydraulic, gear, compressor and process fluids for manufacturing plant, chosen against the duty the equipment runs at rather than by name alone.",
    specs: [
      ["Supplied as", "Drum, IBC and bulk"],
      ["Enquiry needs", "Equipment, duty and volume"],
    ],
  },
  {
    id: "mar",
    key: "marine-oils-lubricants",
    code: "MR",
    name: "Marine Oils & Lubricants",
    short: "Marine",
    sub: "Vessel engines and systems",
    angle: 150,
    body: "Lubricants for marine engines and onboard systems, supplied against the vessel's requirement and the port the delivery has to reach.",
    specs: [
      ["Supplied as", "Drum and bulk"],
      ["Enquiry needs", "Vessel, system and port"],
    ],
  },
  {
    id: "cool",
    key: "antifreeze-coolants",
    code: "AC",
    name: "Antifreeze & Coolants",
    short: "Coolants",
    sub: "Thermal management",
    angle: 210,
    body: "Antifreeze and coolant products for automotive and industrial cooling systems, supplied as concentrate or ready-to-use according to the requirement.",
    specs: [
      ["Supplied as", "Concentrate or ready-to-use"],
      ["Enquiry needs", "System, climate and volume"],
    ],
  },
];

/* --------------------------------------------- 5 · why choose sam group */

/**
 * The sheet's six advantages, rewritten into one voice.
 *
 * The wording is tightened and the sixth is **changed in substance, not merely in phrasing**: the
 * sheet's "Global Partnership … partners worldwide" is a market claim, and the `Notes` sheet —
 * which the owner made the factual authority on markets — names Africa, the countries around
 * India, and Türkiye. "Worldwide" is not supported, so the advantage is stated as the durability
 * of the relationship rather than as its geographic reach.
 *
 * Three of these are company claims the workbook asserts and this repository cannot verify —
 * marked below. They are published because the workbook is the approved source for factual
 * content; they are listed in the gate's report as items to confirm.
 */
export type Advantage = {
  readonly icon:
    "manufacturer" | "formulation" | "quality" | "supply" | "expertise" | "partnership";
  readonly title: string;
  readonly body: string;
};

export const ADVANTAGES: readonly Advantage[] = [
  {
    icon: "manufacturer",
    title: "Direct manufacturer",
    body: "Buying from the producer keeps pricing, supply and quality in one accountable place.",
  },
  {
    icon: "formulation",
    title: "Customized solutions",
    body: "Technical capability to develop a product against a customer's own requirement.",
  },
  {
    /* Company claim, from the sheet: "Every product undergoes strict testing and quality
       evaluation." Stated as the workbook states it; unverified in this repository. */
    icon: "quality",
    title: "Quality control",
    body: "Products are tested and evaluated for performance before they are released.",
  },
  {
    icon: "supply",
    title: "Flexible supply",
    body: "Order volumes, packaging formats and delivery arrangements handled case by case.",
  },
  {
    icon: "expertise",
    title: "Technical expertise",
    body: "Support with product selection and formulation development, not just order taking.",
  },
  {
    icon: "partnership",
    title: "Long-term partnership",
    body: "Built for repeat supply with distributors, blenders and industrial manufacturers.",
  },
];

/* ------------------------------------------------- 6 · industries we serve */

/**
 * The five industries the sheet names, in its order.
 *
 * Its stated purpose is SEO and demonstrating market understanding, so each entry says what the
 * industry buys rather than restating the family list — the Product Portfolio segment two above
 * already does that, and repeating it here is the duplication the owner asked to remove.
 */
export type Industry = {
  readonly icon: "automotive" | "manufacturing" | "blenders" | "petrochemical" | "packaging";
  readonly name: string;
  readonly body: string;
};

export const INDUSTRIES: readonly Industry[] = [
  {
    icon: "automotive",
    name: "Automotive & Transportation",
    body: "Engine, transmission and driveline lubricants for vehicle fleets and workshops.",
  },
  {
    icon: "manufacturing",
    name: "Industrial Manufacturing",
    body: "Hydraulic, gear and process fluids specified against plant duty cycles.",
  },
  {
    icon: "blenders",
    name: "Lubricant Manufacturers",
    body: "Base oils and additive components supplied as blending inputs.",
  },
  {
    icon: "petrochemical",
    name: "Petrochemical Industry",
    body: "Petroleum-based products supplied into downstream processing and formulation.",
  },
  {
    icon: "packaging",
    name: "Packaging & Specialty Industries",
    body: "Specialty grades and packaging formats for lower-volume, specific applications.",
  },
];

/* ------------------------------------- 7 · custom formulation highlight */

/**
 * The customization process, in **six** steps.
 *
 * The workbook states this process twice and disagrees with itself: the `Home Page` sheet gives
 * five stages (Customer Requirements, Formula Development, Laboratory Testing, Production, Final
 * Approval) and the `Customized Solutions` sheet gives six (Understand, Develop, Test, Approve,
 * Produce, Deliver). **The owner chose six**, so the Customized Solutions sheet's sequence is the
 * one rendered — here and on that page — and the two surfaces cannot drift apart.
 *
 * `art` is a decorative schematic per step. Each is `aria-hidden` inside `.fs-jstep-art`.
 *
 * **They carry no text.** The illustrations these replaced embedded `<text font-size="8.5">`
 * labels in a 400-unit `viewBox`, which scales with the container: measured at 13.1px on desktop
 * and under 12px on a narrow column, they were the last text on the public site below the floor
 * (DESIGN_SYSTEM §7.1, ADR-022 §4.6), and they asked for `JetBrains Mono`, a family this
 * application does not load. Geometry only, in the Flagship's own steel and brass rather than the
 * prototype's off-palette blue.
 */
export type Stage = {
  readonly n: string;
  readonly title: string;
  readonly body: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly art: string;
};

const HAIRLINE = 'stroke="rgba(199,205,214,.22)"';
const LINE = 'stroke="rgba(199,205,214,.5)" stroke-width="1.3"';
const BRASS = 'stroke="rgba(195,154,78,.62)" stroke-width="1.3"';
const NODE = 'fill="rgba(227,198,137,.75)"';
const GRID = `<g ${HAIRLINE}><path d="M0 75h400M0 150h400M0 225h400M100 0v300M200 0v300M300 0v300"/></g>`;

export const CUSTOM_STEPS: readonly Stage[] = [
  {
    n: "01",
    title: "Understand",
    body: "We start from the technical, commercial and application requirements behind the request — what the product has to do, where it has to do it, and on what terms.",
    facts: [
      ["Input", "Application and duty"],
      ["Output", "Stated requirement"],
    ],
    art: `<svg viewBox="0 0 400 300" fill="none">${GRID}<g ${LINE}><path d="M120 190V110h60v80M220 190v-50h60v50"/><path d="M90 190h220"/></g><g ${BRASS}><path d="M150 110V70M250 140v-40"/></g><g ${NODE}><circle cx="150" cy="70" r="4"/><circle cx="250" cy="100" r="4"/></g></svg>`,
  },
  {
    n: "02",
    title: "Develop",
    body: "The technical team evaluates the requirement and either adapts an existing formulation or develops a new one to meet it.",
    facts: [
      ["Input", "Stated requirement"],
      ["Output", "Candidate formulation"],
    ],
    art: `<svg viewBox="0 0 400 300" fill="none">${GRID}<g ${LINE}><path d="M140 110l32-18 32 18v36l-32 18-32-18z"/><path d="M204 146l32-18 32 18v36l-32 18-32-18z"/><path d="M172 92V58M236 128V92l32-18"/></g><circle cx="205" cy="150" r="70" ${BRASS} stroke-dasharray="4 7"/><g ${NODE}><circle cx="172" cy="92" r="4"/><circle cx="236" cy="128" r="4"/><circle cx="268" cy="74" r="4"/></g></svg>`,
  },
  {
    n: "03",
    title: "Test",
    body: "The candidate product is tested and evaluated against the specification and performance criteria the requirement set out.",
    facts: [
      ["Input", "Candidate formulation"],
      ["Output", "Measured result"],
    ],
    art: `<svg viewBox="0 0 400 300" fill="none">${GRID}<path d="M20 220C80 214 110 182 160 152S250 92 300 80s60-8 80-6" ${LINE}/><path d="M20 244C80 240 110 214 160 190S250 136 300 124s60-6 80-4" ${BRASS} stroke-dasharray="5 8"/><g ${NODE}><circle cx="160" cy="152" r="5"/><circle cx="300" cy="80" r="5"/></g></svg>`,
  },
  {
    n: "04",
    title: "Approve",
    body: "Samples are reviewed and approved against the customer's own requirements before anything moves into production.",
    facts: [
      ["Input", "Sample and result"],
      ["Output", "Customer approval"],
    ],
    art: `<svg viewBox="0 0 400 300" fill="none">${GRID}<g ${LINE}><rect x="120" y="70" width="160" height="160" rx="14"/><path d="M120 118h160"/></g><g ${BRASS} stroke-linecap="round"><path d="M158 168l24 24 60-60"/></g><g ${NODE}><circle cx="146" cy="94" r="4"/></g></svg>`,
  },
  {
    n: "05",
    title: "Produce",
    body: "The approved product moves into controlled production, made to the formulation that was signed off rather than to a near equivalent.",
    facts: [
      ["Input", "Approved formulation"],
      ["Output", "Produced batch"],
    ],
    art: `<svg viewBox="0 0 400 300" fill="none">${GRID}<g ${LINE}><rect x="60" y="120" width="66" height="110" rx="10"/><rect x="150" y="92" width="66" height="138" rx="10"/><rect x="240" y="142" width="66" height="88" rx="10"/></g><g ${BRASS} stroke-dasharray="6 9"><path d="M126 160h24M216 160h24"/></g><path d="M40 230h320" ${HAIRLINE}/><g ${NODE}><circle cx="93" cy="136" r="4"/><circle cx="183" cy="108" r="4"/></g></svg>`,
  },
  {
    n: "06",
    title: "Deliver",
    body: "The finished product is packaged and delivered on the supply and logistics terms agreed with the requirement.",
    facts: [
      ["Input", "Produced batch"],
      ["Output", "Delivered order"],
    ],
    art: `<svg viewBox="0 0 400 300" fill="none">${GRID}<g ${LINE}><rect x="60" y="150" width="90" height="70" rx="8"/><rect x="164" y="150" width="90" height="70" rx="8"/><path d="M60 178h90M164 178h90"/></g><path d="M262 190C300 190 316 138 356 122" ${BRASS} stroke-dasharray="5 8"/><g ${NODE}><circle cx="356" cy="122" r="6"/></g></svg>`,
  },
];

/* --------------------------------------------------------------- 8 · CTAs */

/**
 * The homepage's closing actions.
 *
 * The `Home Page` sheet has **no final-CTA segment** — its last content row is Latest News /
 * Insights and then the footer. The previous homepage ended with a Partnership section carrying
 * three closing links; the owner removed it. So the actions are distributed across the sections
 * that earn them, and this pair is the Custom Formulation segment's, which is the last place on
 * the page where a visitor is holding a specific requirement.
 *
 * Paths are **structural** — no locale segment. `localeHref` adds it at the call site, which is
 * the only prefix rule on the platform (`site-routes.ts`).
 */
export const CUSTOM_CTA = {
  primary: { label: "Request a custom solution", href: ROUTES.customizedSolutions },
  secondary: { label: "Talk to our team", href: ROUTES.contactUs },
} as const;

/* ------------------------------------------------- 9 · export network map */

/**
 * The export network map — restored at the owner’s request after this gate first removed it.
 *
 * The workbook’s `Home Page` sheet has no segment for it, and the owner asked for it back
 * anyway; that instruction stands above the sheet. What could NOT come back unchanged is its data.
 *
 * ── What the hubs were, and why they could not stay ─────────────────────────────────────────
 *
 * Thirteen named ports — Rotterdam, Hamburg, Singapore, Shanghai, Busan, Houston, Santos, Sydney
 * among them — each carrying an invented transit time ("ISO tank · 21 days", "Bulk · 6 days").
 * That is a served-market claim and a set of statistics, and the owner ruled out both. The page
 * used to carry a rendered banner calling the whole thing illustrative; that banner is gone with
 * the other prototype figures, so hedging is no longer available as an answer.
 *
 * ── What they are now ───────────────────────────────────────────────────────────────────────
 *
 * The regions the workbook’s `Notes` sheet names — **Africa, the countries around India, and
 * Türkiye** — which the owner made the factual authority for market claims. Africa is drawn as
 * four sub-regions so the map still reads as a map; no port is named, no transit time is stated,
 * and nothing is labelled illustrative because nothing here is invented.
 */
export type Hub = {
  readonly n: string;
  readonly lon: number;
  readonly lat: number;
  readonly lane: string;
};

/**
 * The origin point every lane on the map is drawn from — **coordinates only**.
 *
 * It carried `name: "Persian Gulf Complex"`, which nothing rendered and which nothing may: a named
 * production site is a facility claim, and the identical one was removed from the footer in this
 * pass. The map needs somewhere to draw from; it does not need to say what is there.
 */

/**
 * The point the lanes are drawn FROM.
 *
 * Coordinates only. A convergence point in a lane diagram asserts no ownership, names no site and
 * carries no marker — the "Manufacturing complex" legend row and the marker it described were
 * removed for exactly that reason and are not coming back with this section.
 */
export const HQ = { lon: 56.3, lat: 27.2 } as const;

export const HUBS: readonly Hub[] = [
  { n: "Türkiye", lon: 35.0, lat: 39.0, lane: "Export destination" },
  { n: "Countries around India", lon: 78.0, lat: 21.0, lane: "Export destination" },
  { n: "North Africa", lon: 10.0, lat: 31.0, lane: "Export destination" },
  { n: "West Africa", lon: 3.4, lat: 6.5, lane: "Export destination" },
  { n: "East Africa", lon: 39.3, lat: -6.8, lane: "Export destination" },
  { n: "Southern Africa", lon: 25.0, lat: -29.0, lane: "Export destination" },
];

/**
 * Coarse continent outlines in [lon, lat]. Stylised, not survey-grade — they are rasterised to
 * a dot matrix at ~2° resolution, so the dots are visibly the precision of the drawing.
 */
export const LAND: readonly (readonly (readonly [number, number])[])[] = [
  [
    [-168, 65],
    [-160, 71],
    [-140, 70],
    [-125, 70],
    [-110, 68],
    [-95, 70],
    [-85, 73],
    [-75, 68],
    [-60, 60],
    [-55, 52],
    [-65, 45],
    [-70, 42],
    [-75, 35],
    [-81, 25],
    [-90, 29],
    [-97, 26],
    [-105, 22],
    [-115, 30],
    [-125, 40],
    [-130, 52],
    [-140, 60],
    [-155, 58],
  ],
  [
    [-80, 8],
    [-72, 11],
    [-62, 10],
    [-52, 5],
    [-45, -2],
    [-35, -6],
    [-38, -15],
    [-48, -25],
    [-58, -35],
    [-62, -40],
    [-65, -50],
    [-70, -55],
    [-73, -45],
    [-72, -35],
    [-71, -20],
    [-75, -12],
    [-79, -5],
  ],
  [
    [-17, 15],
    [-10, 25],
    [0, 32],
    [10, 34],
    [20, 32],
    [32, 31],
    [35, 25],
    [40, 15],
    [43, 11],
    [51, 12],
    [48, 3],
    [41, -3],
    [40, -12],
    [35, -20],
    [33, -27],
    [27, -34],
    [20, -35],
    [15, -28],
    [12, -17],
    [9, -2],
    [3, 5],
    [-8, 5],
    [-15, 12],
  ],
  [
    [-10, 36],
    [-9, 43],
    [0, 50],
    [5, 53],
    [10, 57],
    [20, 58],
    [30, 60],
    [40, 64],
    [55, 68],
    [70, 72],
    [90, 75],
    [110, 74],
    [130, 71],
    [150, 70],
    [165, 67],
    [178, 66],
    [178, 60],
    [160, 56],
    [145, 50],
    [135, 45],
    [130, 42],
    [122, 38],
    [120, 32],
    [118, 25],
    [110, 20],
    [105, 12],
    [100, 8],
    [98, 15],
    [94, 22],
    [88, 22],
    [85, 20],
    [80, 13],
    [77, 8],
    [72, 20],
    [68, 24],
    [62, 25],
    [57, 20],
    [50, 28],
    [45, 38],
    [38, 38],
    [30, 36],
    [28, 41],
    [22, 38],
    [15, 40],
    [10, 44],
    [3, 42],
    [-5, 36],
  ],
  [
    [114, -22],
    [122, -18],
    [130, -12],
    [138, -12],
    [142, -10],
    [145, -15],
    [150, -22],
    [153, -28],
    [150, -37],
    [143, -39],
    [135, -35],
    [129, -32],
    [120, -34],
    [115, -33],
    [113, -26],
  ],
  [
    [95, 5],
    [105, 0],
    [115, -5],
    [125, -8],
    [135, -4],
    [130, 1],
    [120, 2],
    [110, 3],
    [100, 6],
  ],
  [
    [130, 32],
    [136, 35],
    [141, 40],
    [145, 44],
    [142, 45],
    [138, 37],
    [132, 33],
  ],
  [
    [-6, 50],
    [-5, 55],
    [-3, 58],
    [0, 54],
    [1, 51],
  ],
  [
    [-45, 60],
    [-55, 70],
    [-50, 78],
    [-30, 82],
    [-20, 75],
    [-25, 68],
    [-40, 60],
  ],
  [
    [166, -46],
    [172, -42],
    [174, -37],
    [178, -38],
    [175, -42],
    [170, -46],
  ],
];

export const NETWORK_STATS: readonly Fact[] = [
  { value: "4", label: "Named Incoterms" },
  { value: "6", label: "Packaging formats" },
  { value: "1", label: "Export enquiry path" },
];
