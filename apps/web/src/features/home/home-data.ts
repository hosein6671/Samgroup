/**
 * Flagship homepage content, as fixtures.
 *
 * Every export is the shape of a real fetch. When M2 lands, `FAMILIES` comes from
 * `GET /api/v1/categories`, `INSIGHTS` from the blog endpoint, and the editorial copy from
 * Payload — the components consuming them do not change. That is why this file exists rather
 * than the values living in JSX: a hardcoded repeating list is the one pattern the project
 * forbids outright (PROJECT_HANDOFF §6.7).
 *
 * **Figures are illustrative.** They are the approved prototype's numbers, not audited company
 * data. `docs/SITE_STRUCTURE.md` marks the homepage statistics `[ESTIMATE — CONFIRM]`, and
 * CLAUDE.md §4 forbids seeding a marker into a page as fact.
 *
 * This note used to claim "the page carries a visible provisional note". **It did not** — nothing
 * in the rendered output said any of this, so the caveat protected only people reading the source.
 * `sections/demo-data-notice.tsx` is that note, rendered first inside `<main>`, above every figure
 * on the page. The figures below still have to be replaced with confirmed data before launch.
 *
 * ── No certification, standard, licence or approval is stated in this file ──
 *
 * There was a `CERTS` list of ten (ISO 9001:2015, ISO 14001, ISO 45001, API Licensed, ACEA, ILSAC
 * GF-6, IATF 16949, SGS, REACH, ASTM) feeding a marquee under the hero, an "International
 * certification" module claiming annually-audited systems with "API and OEM approvals maintained
 * per grade", and a "9 OEM approvals" trust figure. All are removed.
 *
 * SITE_STRUCTURE §7's Outstanding Confirmations is unambiguous about the certificate list —
 * **"do not publish placeholders here"** — and `features/quality` honours that exactly, publishing
 * no certificate and saying on the page that the list is withheld. The homepage was contradicting
 * the page whose entire subject is certification. **Nothing here may name a certificate, standard,
 * licence, accreditation, issuing body or OEM approval until the real list is confirmed.**
 */

import { ROUTES } from "@/features/site/site-routes";

export type Stat = { readonly value: number; readonly suffix: string; readonly label: string };
export type Fact = { readonly value: string; readonly label: string };

/* ------------------------------------------------------------------ 1 · hero */

export const HERO_SPEC: readonly Fact[] = [
  { label: "Product families", value: "6" },
  { label: "Catalogue products", value: "100" },
  { label: "Structured enquiry route", value: "1" },
];

export const HERO_STATS: readonly Stat[] = [
  { value: 6, suffix: "", label: "Product families" },
  { value: 100, suffix: "", label: "Catalogue products" },
  { value: 1, suffix: "", label: "Structured enquiry route" },
];

/* `CERTS` is deleted, not emptied — an empty array is a slot a plausible guess gets dropped into
   later. See the module note: no certificate, standard, licence or approval may be named here. */

/* ----------------------------------------------------------------- 2 · story */

export type Module = {
  readonly phase: string;
  readonly title: string;
  readonly body: string;
  readonly input: string;
  readonly outcome: string;
  readonly tags: readonly string[];
  /** Schematic drawn in the panel corner. Path data only; stroke comes from CSS. */
  readonly diagram: string;
};

export const MODULES: readonly Module[] = [
  {
    phase: "Discover",
    title: "Locate the relevant catalogue route",
    body: "Start from a known product name, application, equipment type, or grade. The catalogue narrows the search to the family and product records that match that context.",
    input: "Product, application, equipment, or grade",
    outcome: "Relevant family and product records",
    tags: ["6 product families", "Grade discovery", "Application context"],
    diagram:
      '<circle cx="95" cy="95" r="70"/><circle cx="95" cy="95" r="46"/><path d="M25 95h140M95 25v140"/>',
  },
  {
    phase: "Evaluate",
    title: "Review the product record in context",
    body: "Read the product description alongside its recorded grades, typical properties, claims, and available documents. Final suitability is checked against the applicable requirement and specification.",
    input: "Candidate product and applicable specification",
    outcome: "Comparable technical context",
    tags: ["Recorded grades", "Typical properties", "TDS and SDS"],
    diagram:
      '<rect x="30" y="30" width="130" height="130" rx="14"/><path d="M30 82h130M82 30v130"/>',
  },
  {
    phase: "Specify",
    title: "Turn the selection into a complete requirement",
    body: "Connect the selected product or application to the required specification, quantity, packaging format, and destination. Unknown details can remain open for review.",
    input: "Specification, quantity, packaging, destination",
    outcome: "Structured product requirement",
    tags: ["Required specification", "Requested quantity", "Destination"],
    diagram: '<path d="M95 22 168 62v76l-73 40-73-40V62z"/><circle cx="95" cy="100" r="30"/>',
  },
  {
    phase: "Plan",
    title: "Prepare the commercial and supply brief",
    body: "Add the preferred Incoterm and any delivery constraints to the product requirement. This gives commercial review a clear basis without presenting an unconfirmed lead time or route as fact.",
    input: "Product brief and preferred trade term",
    outcome: "Commercially reviewable enquiry",
    tags: ["Packaging format", "Preferred Incoterm", "Delivery context"],
    diagram:
      '<circle cx="95" cy="95" r="66"/><path d="M29 95h132M95 29c26 26 26 106 0 132M95 29c-26 26-26 106 0 132"/>',
  },
  /*
   * The "International certification" module is removed, not reworded. Its title, its body ("API
   * and OEM approvals maintained per grade") and all three of its tags were certification claims,
   * so there was nothing left of it once those went. Five modules, not six.
   */
  {
    phase: "Control",
    title: "Keep published technical content traceable",
    body: "Product names remain exact. Specifications, typical properties, and claims retain their recorded source, technical-review state, and publication decision before appearing on a product page.",
    input: "Source document and exact product identity",
    outcome: "Reviewed buyer-facing information",
    tags: ["Recorded source", "Technical review", "Publication decision"],
    diagram: '<path d="M60 30h70v40l40 90H20l40-90z"/><path d="M52 118h86"/>',
  },
];

export const STORY_META: readonly Fact[] = [
  { value: "6", label: "Product families" },
  { value: "100", label: "Catalogue products" },
  { value: "5", label: "Buyer pathways" },
];

/* ------------------------------------------------------------- 3 · ecosystem */

export type Family = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly sub: string;
  /** Degrees on the orbital plane. Fixed so a family always returns to its own station. */
  readonly angle: number;
  readonly body: string;
  readonly specs: readonly (readonly [string, string])[];
};

export const FAMILIES: readonly Family[] = [
  {
    id: "lub",
    code: "LB",
    name: "Lubricants",
    sub: "Engine & transmission",
    angle: -90,
    body: "Explore engine oils, transmission fluids, and related automotive lubricants by application and available grade, then submit the operating and supply details behind the requirement.",
    specs: [
      ["Grades", "SAE 0W-20 → 20W-50"],
      ["Standards", "API SP · ACEA C3"],
      ["Packaging", "1L → 208L · flexitank"],
      ["Shelf life", "60 months"],
    ],
  },
  {
    id: "pet",
    code: "PT",
    name: "Petroleum Products",
    sub: "Distillates & waxes",
    angle: -18,
    body: "Review the available petroleum-product ranges for industrial processing, conversion, and formulation requirements, with product-specific information kept in context.",
    specs: [
      ["Range", "Light distillate → wax"],
      ["Oil content", "0.5 – 5.0 %m/m"],
      ["Congealing pt.", "56 – 64 °C"],
      ["Loading", "ISO tank · bulk"],
    ],
  },
  {
    id: "ind",
    code: "IF",
    name: "Industrial Fluids",
    sub: "Hydraulic & thermal",
    angle: 54,
    body: "Navigate hydraulic, gear, compressor, turbine, heat-transfer, and related industrial-fluid ranges by application and recorded grade.",
    specs: [
      ["ISO VG", "32 → 460"],
      ["Cleanliness", "ISO 4406 17/15/12"],
      ["Oxidation (RPVOT)", "≥ 1,000 min"],
      ["Filterability", "Pass · Denison"],
    ],
  },
  {
    id: "aut",
    code: "AS",
    name: "Automotive Solutions",
    sub: "Fleet & aftermarket",
    angle: 126,
    body: "Explore automotive product routes for fleet, distributor, and aftermarket requirements, including the commercial details needed for packaging and supply review.",
    specs: [
      ["MOQ", "1 × 20ft container"],
      ["Label", "Private / co-brand"],
      ["Lead time", "14 – 21 days"],
      ["Support", "Registration dossier"],
    ],
  },
  {
    id: "spe",
    code: "SP",
    name: "Specialty Products",
    sub: "Engineered niches",
    angle: 198,
    body: "Start a structured review for specialist applications by sharing the operating context, required specification, quantity, packaging, and destination.",
    specs: [
      ["Development", "8 – 14 weeks"],
      ["Pilot batch", "200 – 2,000 L"],
      ["Review route", "Requirement-led"],
      ["IP", "Customer-owned"],
    ],
  },
];

export const BASE_OIL_GROUPS: readonly string[] = ["I", "II", "III"];

/* --------------------------------------------------------------- 4 · why */

export const LINE_OUTPUT: readonly { readonly id: string; readonly pct: number }[] = [
  { id: "EO", pct: 90 },
  { id: "IO", pct: 52 },
  { id: "LA", pct: 30 },
  { id: "MO", pct: 24 },
  { id: "AC", pct: 4 },
];

export const RELEASE_SPEC: readonly (readonly [string, string])[] = [
  ["Technical Data Sheet", "Per product"],
  ["Safety Data Sheet", "Per product"],
  ["Certificate of Analysis", "Per batch"],
];

/* "9 OEM approvals" is dropped from this list — an OEM approval is a certification claim, and it
   is the one entry here that no placeholder notice could make acceptable. Four figures, not five. */
export const TRUST: readonly Fact[] = [
  { value: "100", label: "Catalogue products" },
  { value: "6", label: "Product families" },
  { value: "3", label: "Document enquiry routes" },
  { value: "1", label: "Technical review path" },
];

export const TECH_TAGS: readonly string[] = [
  "Recorded source",
  "Specification review",
  "Claim review",
  "Versioned decision",
  "Publication gate",
];

/* ------------------------------------------------------------- 5 · network */

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
export const HQ = { lon: 56.3, lat: 27.2 } as const;

export const HUBS: readonly Hub[] = [
  { n: "Rotterdam", lon: 4.5, lat: 51.9, lane: "ISO tank · 21 days" },
  { n: "Hamburg", lon: 10.0, lat: 53.5, lane: "Flexitank · 24 days" },
  { n: "Istanbul", lon: 29.0, lat: 41.0, lane: "Drums · 12 days" },
  { n: "Mumbai", lon: 72.9, lat: 19.0, lane: "Bulk · 6 days" },
  { n: "Singapore", lon: 103.8, lat: 1.35, lane: "ISO tank · 11 days" },
  { n: "Shanghai", lon: 121.5, lat: 31.2, lane: "Flexitank · 17 days" },
  { n: "Busan", lon: 129.0, lat: 35.1, lane: "Drums · 19 days" },
  { n: "Houston", lon: -95.4, lat: 29.8, lane: "Bulk · 32 days" },
  { n: "Santos", lon: -46.3, lat: -23.9, lane: "Flexitank · 29 days" },
  { n: "Lagos", lon: 3.4, lat: 6.5, lane: "Drums · 18 days" },
  { n: "Durban", lon: 31.0, lat: -29.9, lane: "ISO tank · 16 days" },
  { n: "Sydney", lon: 151.2, lat: -33.9, lane: "Flexitank · 26 days" },
  { n: "Casablanca", lon: -7.6, lat: 33.6, lane: "Drums · 22 days" },
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

/* ------------------------------------------------------------------ 6 · lab */

export const LAB_CARDS: readonly {
  readonly value: number;
  readonly suffix: string;
  readonly label: string;
  readonly body: string;
}[] = [
  {
    value: 3,
    suffix: "",
    label: "Review stages",
    body: "Source capture, technical review, and publication decisions remain distinct and traceable.",
  },
  {
    value: 3,
    suffix: "",
    label: "Document routes",
    body: "TDS, SDS, and batch-specific COA enquiries stay connected to the relevant product.",
  },
  {
    value: 1,
    suffix: "",
    label: "Traceable content path",
    body: "Technical statements retain their recorded source, review state, and publication decision.",
  },
];

export const LAB_TAGS: readonly string[] = [
  "Source record",
  "Typical properties",
  "Technical documents",
  "Approval status",
];

/* -------------------------------------------------------------- 7 · journey */

export type Stage = {
  readonly n: string;
  readonly title: string;
  readonly body: string;
  readonly facts: readonly (readonly [string, string])[];
  /** Per-step schematic artwork, from the approved reference. */
  readonly art: string;
};

export const STAGES: readonly Stage[] = [
  {
    n: "01",
    title: "Define the operating need",
    body: "Begin with the known product, application, equipment, operating conditions, or specification that frames the requirement.",
    facts: [
      ["Product", "If known"],
      ["Application", "Required"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.16)"><path d="M0 60h400M0 120h400M0 180h400M0 240h400M80 0v300M160 0v300M240 0v300M320 0v300"/></g><g stroke="#2F6BFF" stroke-width="1.3"><path d="M140 110l30-17 30 17v34l-30 17-30-17z"/><path d="M200 144l30-17 30 17v34l-30 17-30-17z"/><path d="M170 93V59M230 127V93l30-17"/></g><g fill="#7DA9FF"><circle cx="170" cy="93" r="3.4"/><circle cx="230" cy="127" r="3.4"/><circle cx="260" cy="76" r="3.4"/><circle cx="140" cy="144" r="3.4"/></g><circle cx="215" cy="150" r="66" stroke="rgba(201,167,92,.45)" stroke-dasharray="4 6"/><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">MOLECULAR SCREENING · 1,240 CANDIDATES</text></svg>',
  },
  {
    n: "02",
    title: "Identify the product route",
    body: "Connect the requirement to the relevant catalogue family and grade, or route it for a structured custom-product review.",
    facts: [
      ["Catalog", "Standard route"],
      ["Custom", "Specific brief"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.2)" stroke-width="1.2"><path d="M150 50h100M170 50v70l-46 96a14 14 0 0013 20h126a14 14 0 0013-20l-46-96V50"/></g><path d="M133 190h134l14 26a14 14 0 01-13 20H132a14 14 0 01-13-20z" fill="rgba(47,107,255,.28)"/><g stroke="#7DA9FF" stroke-width="1"><path d="M60 70h44M60 100h44M60 130h44M296 70h44M296 100h44M296 130h44"/></g><g fill="#C9A75C"><circle cx="82" cy="70" r="2.6"/><circle cx="82" cy="100" r="2.6"/><circle cx="318" cy="100" r="2.6"/></g><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">GRAVIMETRIC DOSING · ±0.35%</text></svg>',
  },
  {
    n: "03",
    title: "Review the product record",
    body: "Review the recorded grade, typical properties, test methods, claims, and available product documents in context.",
    facts: [
      ["TDS", "Product data"],
      ["SDS", "Safety data"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.13)"><path d="M0 75h400M0 150h400M0 225h400M100 0v300M200 0v300M300 0v300"/></g><path d="M0 210C60 206 90 178 140 150S240 92 300 78s80-12 100-10" stroke="#2F6BFF" stroke-width="2"/><path d="M0 230C60 228 90 208 140 186S240 138 300 126s80-10 100-8" stroke="rgba(201,167,92,.6)" stroke-width="1.3" stroke-dasharray="5 7"/><g fill="#7DA9FF"><circle cx="140" cy="150" r="4"/><circle cx="300" cy="78" r="4"/></g><rect x="250" y="36" width="120" height="34" rx="8" fill="rgba(11,19,34,.8)" stroke="rgba(190,212,245,.2)"/><text x="264" y="58" fill="#D5DFEE" font-family="JetBrains Mono,monospace" font-size="11" letter-spacing="1.2">VI 142 · PASS</text><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">SHEAR STABILITY · 90 CYCLES</text></svg>',
  },
  {
    n: "04",
    title: "Complete the commercial brief",
    body: "Add the required quantity, packaging format, destination, and preferred Incoterm so the enquiry can be assessed in context.",
    facts: [
      ["Quantity", "Requested volume"],
      ["Incoterm", "Preferred basis"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.2)" stroke-width="1.2"><rect x="30" y="90" width="70" height="130" rx="8"/><rect x="130" y="60" width="70" height="160" rx="8"/><rect x="230" y="110" width="60" height="110" rx="8"/><rect x="316" y="140" width="54" height="80" rx="8"/></g><g fill="rgba(47,107,255,.24)"><rect x="30" y="160" width="70" height="60" rx="8"/><rect x="130" y="120" width="70" height="100" rx="8"/><rect x="230" y="170" width="60" height="50" rx="8"/></g><g stroke="#2F6BFF" stroke-width="1.4" stroke-dasharray="6 9"><path d="M100 130h30M200 130h30M290 165h26"/></g><path d="M0 244h400" stroke="rgba(190,212,245,.24)"/><g fill="#C9A75C"><circle cx="65" cy="105" r="2.6"/><circle cx="165" cy="75" r="2.6"/><circle cx="260" cy="125" r="2.6"/></g><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">INLINE BLENDING · CONTINUOUS</text></svg>',
  },
  {
    n: "05",
    title: "Arrange evaluation where applicable",
    body: "For a sample enquiry, identify the product, intended application, destination, and purpose of the evaluation.",
    facts: [
      ["Sample", "If available"],
      ["COA", "Batch-specific"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.15)"><rect x="40" y="40" width="320" height="180" rx="10"/><path d="M40 82h320M40 124h320M40 166h320M170 40v180"/></g><g stroke="#7DA9FF" stroke-width="1.6" stroke-linecap="round"><path d="M64 68l9 9 17-19"/><path d="M64 110l9 9 17-19"/><path d="M64 152l9 9 17-19"/><path d="M64 194l9 9 17-19"/></g><g fill="rgba(213,223,238,.5)"><rect x="196" y="56" width="120" height="4" rx="2"/><rect x="196" y="98" width="92" height="4" rx="2"/><rect x="196" y="140" width="134" height="4" rx="2"/><rect x="196" y="182" width="76" height="4" rx="2"/></g><rect x="40" y="40" width="320" height="3" fill="#C9A75C" opacity=".8"/><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">11 BENCH TESTS · BATCH SIGNED</text></svg>',
  },
  {
    n: "06",
    title: "Confirm the supply plan",
    body: "Align the selected product, applicable specification, packaging, destination, and agreed commercial basis before supply.",
    facts: [
      ["Product", "Confirmed"],
      ["Terms", "Documented"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.18)"><rect x="26" y="150" width="86" height="46" rx="4"/><rect x="120" y="150" width="86" height="46" rx="4"/><rect x="73" y="100" width="86" height="46" rx="4"/></g><g stroke="rgba(190,212,245,.12)"><path d="M26 162h86M26 174h86M120 162h86M120 174h86M73 112h86M73 124h86"/></g><path d="M210 176C250 176 268 120 316 104s60-8 72-6" stroke="#2F6BFF" stroke-width="1.6" stroke-dasharray="5 8"/><circle cx="316" cy="104" r="5" fill="#C9A75C"/><circle cx="212" cy="176" r="5" fill="#7DA9FF"/><g stroke="rgba(190,212,245,.14)"><circle cx="330" cy="196" r="42"/><path d="M288 196h84M330 154v84"/><ellipse cx="330" cy="196" rx="18" ry="42"/></g><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">47 MARKETS · CIF / FOB / DAP</text></svg>',
  },
];

/* ------------------------------------------------------------- 8 · insights */

/*
 * `LEAD_ARTICLE` and `INSIGHTS` are deleted, not emptied.
 *
 * They were five fabricated articles — a lead titled "Why Group III supply is rewriting lubricant
 * procurement in 2026" carrying a dated market claim about Gulf hydrocracker capacity, plus four
 * invented secondaries with their own summaries. None corresponded to a `BlogPost` row or to any
 * approved editorial content, and a market assertion published under a company's name is a
 * commercial claim, not decoration.
 *
 * **No blog content is fixtured here, and none may be.** `BlogPost` is Prisma-owned and served by
 * `GET /blog/posts`; `/{locale}/insights` renders it. A second, hand-written blog source on the
 * homepage is exactly the duplication that would drift from the real one. The homepage section now
 * links to that page instead — see `sections/insights.tsx`.
 */

/* --------------------------------------------------------- 9 · partnership */

/* `PRODUCT_INTERESTS` is deleted with the local partnership form it fed. The one Inquiry form on
   the platform owns its own field vocabulary in `features/forms`; a second copy here would drift. */

/**
 * The closing section's three routes.
 *
 * All three used to point at `#partnership` — the section containing them — and one of them
 * offered a "company profile" as "PDF · 4.2 MB", an asset that does not exist and a file size that
 * was invented for it. They now carry real `href`s to routes that resolve.
 *
 * "Request product data sheets" points at the Products landing page's documentation block. That
 * block is itself still gated and inert, which is a known state rather than a broken link: it is a
 * real anchor on a real page that says what it is.
 */
export const CTA_LINKS: readonly {
  readonly title: string;
  readonly meta: string;
  readonly href: string;
}[] = [
  { title: "Send a product enquiry", meta: "Contact route", href: ROUTES.contactUs },
  { title: "Request a quotation", meta: "Commercial brief", href: ROUTES.requestQuote },
  { title: "Review product documents", meta: "TDS / SDS", href: ROUTES.documentation },
];

export const NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: "#story", label: "Buyer Path" },
  { href: "#products", label: "Products" },
  { href: "#network", label: "Export Planning" },
  { href: "#lab", label: "Technical Information" },
  { href: "#journey", label: "Supply Journey" },
  { href: "#insights", label: "Insights" },
];

/* `FOOTER_COLUMNS` now lives in `features/site/site-routes.ts` — the footer is site-level chrome,
   and its columns are navigation data rather than homepage content. Values are unchanged. */
