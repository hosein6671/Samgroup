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
 * The hero reel: four of the site's own lab photographs, played as one graded sequence.
 *
 * The NAMES are editable in /admin (`hero_shots`) and so are the PHOTOGRAPHS (`hero_shot_1` to
 * `hero_shot_4`); what stays here is the built-in photograph each slot falls back to, and the
 * framing of its slow push-in: `focus` is the transform origin the camera pushes towards and
 * `drift` is where the frame ends up. Presentational only.
 */
export type HeroShot = {
  readonly name: string;
  /** The /admin photograph slot that replaces `src` when an editor picks one. */
  readonly slot: "hero_shot_1" | "hero_shot_2" | "hero_shot_3" | "hero_shot_4";
  readonly src: string;
  readonly focus: string;
  readonly drift: string;
};

export const HERO_SHOTS: readonly HeroShot[] = [
  {
    name: "Base Oils",
    slot: "hero_shot_1",
    src: "/images/base-oils-lab-samples.webp",
    focus: "62% 58%",
    drift: "-3% -1%",
  },
  {
    name: "Engine Oils",
    slot: "hero_shot_2",
    src: "/images/engine-oils-automotive-lab-samples.webp",
    focus: "55% 50%",
    drift: "2% -2%",
  },
  {
    name: "Industrial",
    slot: "hero_shot_3",
    src: "/images/industrial-oils-lab-samples.webp",
    focus: "60% 55%",
    drift: "-2% 1%",
  },
  {
    name: "Marine",
    slot: "hero_shot_4",
    src: "/images/marine-oils-lab-samples.webp",
    focus: "50% 55%",
    drift: "-3% -1%",
  },
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
  readonly term: string;
  readonly detail: string;
  /** The built-in photograph; the editable one is the /admin slot named in `photo`. */
  readonly src: string;
  readonly photo: "who_we_are" | "who_we_are_2" | "who_we_are_3";
};

export const WHO_WE_ARE: readonly WhoWeAreClaim[] = [
  {
    term: "We produce",
    detail: "Base oils, engine oils, lubricants and additives — made, not bought in and resold.",
    src: "/images/home/story-product-portfolio.webp",
    photo: "who_we_are",
  },
  {
    term: "We formulate",
    detail: "Products developed against a stated technical and commercial requirement.",
    src: "/images/home/lab-refrigerator-compressor-oil.webp",
    photo: "who_we_are_2",
  },
  {
    term: "We supply",
    detail: "Packaging and volumes arranged around the product and the route it travels.",
    src: "/images/home/journey-requirement-to-supply.webp",
    photo: "who_we_are_3",
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
 * **`supplied` and `enquiry` name no standard.** Each describes a property of the family — how
 * it is packaged, what an enquiry needs — and never a specification a certificate would have to
 * back.
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
  /** How the family is supplied: the detail panel's "Supplied as" row. Editable in /admin. */
  readonly supplied: string;
  /** What an enquiry needs: the detail panel's "Enquiry needs" row. Editable in /admin. */
  readonly enquiry: string;
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
    supplied: "Bulk and flexitank",
    enquiry: "Grade, volume, destination",
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
    supplied: "Drum and IBC",
    enquiry: "Application and target property",
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
    supplied: "1 L to 208 L, and bulk",
    enquiry: "Equipment and operating conditions",
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
    supplied: "Drum, IBC and bulk",
    enquiry: "Equipment, duty and volume",
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
    supplied: "Drum and bulk",
    enquiry: "Vessel, system and port",
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
    supplied: "Concentrate or ready-to-use",
    enquiry: "System, climate and volume",
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
  readonly name: string;
  readonly body: string;
  /** The built-in photograph; the editable one is the /admin slot named in `photo`. */
  readonly src: string;
  readonly photo: "industry_1" | "industry_2" | "industry_3" | "industry_4" | "industry_5";
};

export const INDUSTRIES: readonly Industry[] = [
  {
    name: "Automotive & Transportation",
    body: "Engine, transmission and driveline lubricants for vehicle fleets and workshops.",
    src: "/images/engine-oils-automotive-lab-samples.webp",
    photo: "industry_1",
  },
  {
    name: "Industrial Manufacturing",
    body: "Hydraulic, gear and process fluids specified against plant duty cycles.",
    src: "/images/industrial-oils-lab-samples.webp",
    photo: "industry_2",
  },
  {
    name: "Lubricant Manufacturers",
    body: "Base oils and additive components supplied as blending inputs.",
    src: "/images/lubricant-additives-lab-samples.webp",
    photo: "industry_3",
  },
  {
    name: "Petrochemical Industry",
    body: "Petroleum-based products supplied into downstream processing and formulation.",
    src: "/images/marine-oils-lab-samples.webp",
    photo: "industry_4",
  },
  {
    name: "Packaging & Specialty Industries",
    body: "Specialty grades and packaging formats for lower-volume, specific applications.",
    src: "/images/antifreeze-coolants-lab-samples.webp",
    photo: "industry_5",
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
 * `icon` names the faint glyph behind each step card, drawn from the site's own icon set
 * (`features/site/icons.tsx`) and `aria-hidden`. It carries no text: the step's number, title and
 * copy are real text in the card.
 */
export type Stage = {
  readonly n: string;
  readonly title: string;
  readonly body: string;
  /** The step's Input and Output rows. Plain strings so the /admin list can overlay them by name. */
  readonly input: string;
  readonly output: string;
  /** The faint glyph behind the card, from the site's own icon set (features/site/icons.tsx). */
  readonly icon: "search" | "formulation" | "sample" | "quality" | "manufacturer" | "supply";
};

export const CUSTOM_STEPS: readonly Stage[] = [
  {
    n: "01",
    title: "Understand",
    body: "We start from the technical, commercial and application requirements behind the request — what the product has to do, where it has to do it, and on what terms.",
    input: "Application and duty",
    output: "Stated requirement",
    icon: "search",
  },
  {
    n: "02",
    title: "Develop",
    body: "The technical team evaluates the requirement and either adapts an existing formulation or develops a new one to meet it.",
    input: "Stated requirement",
    output: "Candidate formulation",
    icon: "formulation",
  },
  {
    n: "03",
    title: "Test",
    body: "The candidate product is tested and evaluated against the specification and performance criteria the requirement set out.",
    input: "Candidate formulation",
    output: "Measured result",
    icon: "sample",
  },
  {
    n: "04",
    title: "Approve",
    body: "Samples are reviewed and approved against the customer's own requirements before anything moves into production.",
    input: "Sample and result",
    output: "Customer approval",
    icon: "quality",
  },
  {
    n: "05",
    title: "Produce",
    body: "The approved product moves into controlled production, made to the formulation that was signed off rather than to a near equivalent.",
    input: "Approved formulation",
    output: "Produced batch",
    icon: "manufacturer",
  },
  {
    n: "06",
    title: "Deliver",
    body: "The finished product is packaged and delivered on the supply and logistics terms agreed with the requirement.",
    input: "Produced batch",
    output: "Delivered order",
    icon: "supply",
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

export const NETWORK_STATS: readonly Fact[] = [
  { value: "4", label: "Named Incoterms" },
  { value: "6", label: "Packaging formats" },
  { value: "1", label: "Export enquiry path" },
];
