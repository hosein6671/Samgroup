/**
 * About Us page content, as fixtures.
 *
 * ── What this module is ─────────────────────────────────────────────────────
 *
 * Same contract as `features/home/home-data.ts`, `features/products/products-data.ts` and
 * `features/customized-solutions/solutions-data.ts`: every export is the *shape* of a real fetch,
 * so wiring this page up later is a swap of this module rather than a rewrite of the components.
 * A hardcoded repeating list in JSX is the one pattern the project forbids outright
 * (PROJECT_HANDOFF §6.7).
 *
 * The shapes track the **Payload `AboutUs` Global** field-for-field
 * (`docs/content/PAYLOAD_CONTENT_ARCHITECTURE.md` §About Us): `heroTitle`/`heroSupportingText`,
 * `whoWeAreText` (rich text), `expertise[]` (icon, title, description), `qualityStandardsText`
 * (rich text), `finalCtaText`/`finalCtaButton`.
 *
 * ── The three sections that are not here ────────────────────────────────────
 *
 * SITE_STRUCTURE §2 specifies eight sections. Three are **not built and have no fields in this
 * module**:
 *
 * - **Company Milestones** — `milestones[]` is specified as an open-ended `year`/`title`/
 *   `description` repeater. Every year and event in the source is marked `[ESTIMATE — CONFIRM]`,
 *   and SITE_STRUCTURE's Outstanding Confirmations lists "About Us milestones/timeline" as a real
 *   launch blocker. A timeline is the one section on this page a reader will read as history.
 * - **Our Competitive Advantages** — `competitiveAdvantages[]`, described only as an "unchanged
 *   6-item grid". The six items are named in no document under `docs/`.
 * - **Our Team** — `team[]` (photo, name, role, bio). Marked optional at launch and blocked on
 *   photography; no roster exists.
 *
 * Absent, not empty — the precedent `solutions-data.ts` sets for `whatCanWeCustomize`,
 * `privateLabelProgramme` and `caseExamples`. There is no slot below that a plausible guess could
 * be dropped into later by accident. When copy is approved, each is a field here plus a section
 * file, and nothing below changes.
 *
 * **Nothing in this file states a capacity, a volume, a lead time, a market, a customer, a year,
 * a headcount or a certification.** Those are the seven things this page would be expected to
 * claim and the seven this project has not confirmed.
 */

import { PRODUCT_CATEGORIES, ROUTES } from "@/features/site/site-routes";

/* ------------------------------------------------------------------ anchors */

/** In-page anchors, written once so no `#` string is retyped in a component. */
export const ANCHORS = {
  whoWeAre: "who-we-are",
  expertise: "expertise",
  quality: "quality-standards",
  next: "next-step",
} as const;

/* -------------------------------------------------------------- media slots */

/**
 * A designed media slot: a frame the page reserves for an asset that does not exist yet.
 *
 * ── Why this is a typed record and not markup ───────────────────────────────
 *
 * Because it is the asset brief. SITE_STRUCTURE's Outstanding Confirmations lists photography —
 * facility, production, lab — as a launch blocker for this page among others, so what is missing
 * is the file, not the decision about what the file should be. Writing `intent`, `caption` and
 * `alt` down now means the slot is commissioned, reviewable, and a one-line swap when the asset
 * arrives.
 *
 * `alt` is **queued, not applied**. No `<img>` renders today, so it is attached to nothing; it is
 * the alt text the future upload inherits. The placeholder's own state ("Image pending") is real
 * text in the document rather than a decorative flourish, so assistive technology is told the
 * frame is empty instead of being told nothing.
 *
 * ── A gap in the CMS model, recorded rather than worked around ──────────────
 *
 * `PAYLOAD_CONTENT_ARCHITECTURE.md` §About Us lists the Global's media as "Hero image, one photo
 * per `milestones` entry, one photo per `team` entry". Only `hero` below has a field to lift into.
 * **`who-we-are` and `quality` have no corresponding Payload field**, and adding
 * `whoWeAreImage`/`qualityImage` to that Global is a CMS-area change (CLAUDE.md §5) — out of scope
 * for a frontend task, and noted here so it is not discovered as a surprise during M2.
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

export const MEDIA: Record<"hero" | "whoWeAre" | "quality", MediaSlot> = {
  hero: {
    id: "about-hero",
    intent: "Manufacturing · facility",
    caption: "Production facility, wide establishing view.",
    alt: "Sam Group production facility",
    pending: true,
  },
  whoWeAre: {
    id: "about-who-we-are",
    intent: "Production · facility context",
    caption: "Production floor in context — plant, not people.",
    alt: "Production operations at the Sam Group plant",
    pending: true,
  },
  quality: {
    id: "about-quality",
    intent: "Laboratory · quality control",
    caption: "Quality laboratory during batch testing.",
    alt: "Sam Group quality laboratory",
    pending: true,
  },
};

/* --------------------------------------------------------------------- hero */

export type PageIntro = {
  /** Payload `heroTitle`. */
  readonly heading: string;
  readonly eyebrow: string;
  /** Payload `heroSupportingText`. */
  readonly lead: string;
  readonly primary: { readonly label: string; readonly href: string };
  readonly secondary: { readonly label: string; readonly href: string };
};

/**
 * Hero copy.
 *
 * **Three approved facts and no fourth.** Direct-producer positioning, production in Iran, and six
 * published product families — the only content SITE_STRUCTURE §2's Who We Are row supplies that
 * is not marked `[ESTIMATE — CONFIRM]`. The export market list in that same row *is* marked, so no
 * market, region or country appears in this module.
 *
 * The register is the one already published on eight frozen pages rather than a second voice
 * invented for this page: state what is true, then stop.
 *
 * Neither action points at this page. `ROUTES.aboutUs` appears nowhere in this module.
 */
export const INTRO: PageIntro = {
  eyebrow: "About us",
  heading: "A producer, not an intermediary.",
  lead: "Sam Group produces its own range in Iran. Six product families are published, and each one is supplied by the party that makes it.",
  primary: { label: "See the product range", href: ROUTES.products },
  secondary: { label: "Contact us", href: ROUTES.contactUs },
};

/* -------------------------------------------------------------- who we are */

/**
 * A positioning statement — one of the three approved facts, stated once.
 *
 * `note` restates the `term` and adds nothing to it. That is deliberate and it is the whole
 * constraint of this section: SITE_STRUCTURE §2 names six Who We Are sub-topics and supplies
 * finished copy for none of them, so what can be published is the three facts themselves.
 */
export type Position = {
  readonly id: string;
  readonly term: string;
  readonly note: string;
};

/** Payload `whoWeAreText`, as the paragraphs the rich-text field will render as. */
export const WHO_WE_ARE: {
  readonly heading: string;
  readonly body: readonly string[];
  readonly positions: readonly Position[];
} = {
  heading: "What the company is, stated plainly.",
  body: [
    "Sam Group is a producer. The range published on this site is made rather than bought and resold, which means a buyer dealing with Sam Group is dealing with the party that produces the batch — not with a layer in front of it.",
    "Production is in Iran. The published range is organised into six product families, and each one has a page of its own that carries its grades, typical properties and documentation.",
  ],
  positions: [
    {
      id: "direct-producer",
      term: "Direct producer",
      note: "Produced, not resold. There is no intermediary between the buyer and the party that makes the batch.",
    },
    {
      id: "production-iran",
      term: "Production in Iran",
      note: "Where the manufacturing operations are based.",
    },
    {
      id: "six-families",
      term: "Six product families",
      note: "The published range in full. Every family is listed below and every one is a page.",
    },
  ],
};

/**
 * The six families, re-exported from the canonical table rather than restated.
 *
 * The Who We Are section prints them because "six core categories" is one of its three approved
 * facts. Typing the names here would be a second copy of a frozen taxonomy that could drift from
 * the header, the Products landing and the six category pages — all of which already read
 * `PRODUCT_CATEGORIES`.
 */
export const FAMILIES = PRODUCT_CATEGORIES;

/* --------------------------------------------------------------- expertise */

/**
 * One entry of Payload's `expertise` array (`icon`, `title`, `description`).
 *
 * **`description` is not a field here, and `icon` is not either.** Two of the six items are named
 * in `docs/` — SITE_STRUCTURE §2's "(added Base Oil Processing / thin film polishing, Quality
 * Laboratory)" — and *none* of the six has a written description anywhere in this project.
 * SITE_STRUCTURE §4 makes the same point about Thin Film Polishing from the other direction: it is
 * named twice and described nowhere.
 *
 * So this type carries a name and an ordinal, which is what the documentation supports. It is the
 * same handling the Customization Process rail already gives its six step names.
 */
export type ExpertiseItem = {
  readonly id: string;
  readonly name: string;
};

export const EXPERTISE: {
  readonly heading: string;
  readonly lead: string;
  readonly items: readonly ExpertiseItem[];
  /** How many the source specifies in total. Renders as the gap, not as an empty card. */
  readonly specifiedCount: number;
} = {
  heading: "Named where it is documented.",
  lead: "Six areas of expertise are specified for this page. Two are named in the documentation, and they are below. The other four are unnamed, and no description exists for any of the six — including the two that are named.",
  items: [
    { id: "base-oil-processing", name: "Base Oil Processing / Thin Film Polishing" },
    { id: "quality-laboratory", name: "Quality Laboratory" },
  ],
  specifiedCount: 6,
};

/* -------------------------------------------------------- quality standards */

/**
 * One confirmed quality commitment.
 *
 * The four are SITE_STRUCTURE §2's own list for this section — "COA-per-batch, TDS/SDS,
 * sample-before-commitment, batch traceability" — and nothing is added to them.
 *
 * `note` is populated for exactly one entry, and only because a second document states it: §7's
 * Sampling Policy confirms samples are issued at the first stage, before commitment, for base oil
 * and engine oil. The other three are stated as the source states them, without elaboration,
 * because elaborating a quality commitment is writing a warranty.
 */
export type QualityItem = {
  readonly id: string;
  readonly name: string;
  readonly note?: string;
};

/** Payload `qualityStandardsText` plus the repeater the same row specifies for the bullet list. */
export const QUALITY: {
  readonly heading: string;
  readonly lead: string;
  readonly items: readonly QualityItem[];
  readonly footnote: string;
  readonly footnoteLink: { readonly label: string; readonly href: string };
} = {
  heading: "What every batch comes with.",
  lead: "Four commitments, and they are the four the documentation confirms.",
  items: [
    { id: "coa", name: "Certificate of Analysis per batch" },
    { id: "tds-sds", name: "Technical Data Sheet and Safety Data Sheet available" },
    {
      id: "sample",
      name: "Sample before commitment",
      note: "Issued at the first stage of an enquiry rather than the last.",
    },
    { id: "traceability", name: "Batch traceability" },
  ],
  /**
   * The certification gap, stated on the page.
   *
   * SITE_STRUCTURE §7 is emphatic that no placeholder certification is ever published, and §2
   * marks the actual list held `[TO CONFIRM]`. Saying so is not the same as publishing one — it
   * closes the question a reader of a quality section will otherwise answer by assuming.
   */
  footnote:
    "Which certifications the company holds is not published here. That list is unconfirmed, and nothing stands in its place.",
  footnoteLink: { label: "Quality & Certifications", href: ROUTES.qualityCertifications },
};

/* ----------------------------------------------------------------- closing */

/**
 * Payload `finalCtaText` / `finalCtaButton`.
 *
 * The lead is **not new copy**. It is the standing closing language already published on the
 * Products landing and all six category pages ("Formulation to a customer brief is a route of its
 * own, and a sample is the first stage of it"), reused because a visitor arriving here from any of
 * those pages should not meet a second voice at the same moment.
 *
 * Three destinations, none of them this page. `ROUTES.aboutUs` is not referenced anywhere in this
 * module — a closing CTA that points at the page it closes is a loop, not a next step.
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
  heading: "Start with a specification.",
  lead: "Formulation to a customer brief is a route of its own, and a sample is the first stage of it.",
  primary: { label: "Request a quote", href: ROUTES.requestQuote },
  routes: [
    { id: "products", label: "See the product range", href: ROUTES.products },
    { id: "customized", label: "Request a custom solution", href: ROUTES.customizedSolutions },
    { id: "contact", label: "Contact us", href: ROUTES.contactUs },
  ],
};

/* ------------------------------------------------------------ proof state */

/**
 * The three specified sections this page does not carry.
 *
 * Proof-state furniture, exactly as the Customized Solutions introduction's aside is: it exists so
 * a reviewer reads a short page as unfinished rather than as complete, and it is **deleted** when
 * the copy arrives — it is not a permanent design element.
 */
export const WITHHELD: readonly {
  readonly id: string;
  readonly name: string;
  readonly why: string;
}[] = [
  {
    id: "milestones",
    name: "Company Milestones",
    why: "A 2000–2026 timeline, every entry of which is marked as an estimate at source. Real company history is a launch blocker.",
  },
  {
    id: "advantages",
    name: "Our Competitive Advantages",
    why: "Specified as a six-item grid. The six items are named in no approved document.",
  },
  {
    id: "team",
    name: "Our Team",
    why: "Optional at launch and blocked on photography. No roster exists.",
  },
];
