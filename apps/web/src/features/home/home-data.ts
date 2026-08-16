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
  { label: "Blending capacity", value: "240,000 MT/yr" },
  { label: "Base oil groups", value: "I · II · III" },
  { label: "Batch traceability", value: "100%" },
  { label: "Lab tests / month", value: "12,400+" },
  { label: "Export terminals", value: "6" },
];

export const HERO_STATS: readonly Stat[] = [
  { value: 52, suffix: "", label: "Countries served" },
  { value: 240, suffix: "K MT", label: "Annual output" },
  { value: 27, suffix: "", label: "Years of manufacturing" },
  { value: 480, suffix: "+", label: "Product formulations" },
];

/* `CERTS` is deleted, not emptied — an empty array is a slot a plausible guess gets dropped into
   later. See the module note: no certificate, standard, licence or approval may be named here. */

/* ----------------------------------------------------------------- 2 · story */

export type Module = {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  /** Schematic drawn in the panel corner. Path data only; stroke comes from CSS. */
  readonly diagram: string;
};

export const MODULES: readonly Module[] = [
  {
    title: "Quality control",
    body: "Two independent release gates. A batch that misses the window is re-blended, never re-labelled.",
    tags: ["COA per batch", "5-year retention", "Third-party audit"],
    diagram:
      '<circle cx="95" cy="95" r="70"/><circle cx="95" cy="95" r="46"/><path d="M25 95h140M95 25v140"/>',
  },
  {
    title: "Advanced manufacturing",
    body: "Automated gravimetric dosing across four blending lines, with nitrogen blanketing on sensitive grades.",
    tags: ["4 lines", "±0.15% dosing", "N₂ blanketing"],
    diagram:
      '<rect x="30" y="30" width="130" height="130" rx="14"/><path d="M30 82h130M82 30v130"/>',
  },
  {
    title: "Research & development",
    body: "Formulation, accelerated ageing and field-return analysis run on the same bench, so lab data meets road data.",
    tags: ["34 engineers", "1,000h ageing", "Four-ball wear"],
    diagram: '<path d="M95 22 168 62v76l-73 40-73-40V62z"/><circle cx="95" cy="100" r="30"/>',
  },
  {
    title: "Global export network",
    body: "Six loading terminals and a routing desk that plans around vessel schedules rather than sales targets.",
    tags: ["52 markets", "6 terminals", "98.6% on-time"],
    diagram:
      '<circle cx="95" cy="95" r="66"/><path d="M29 95h132M95 29c26 26 26 106 0 132M95 29c-26 26-26 106 0 132"/>',
  },
  /*
   * The "International certification" module is removed, not reworded. Its title, its body ("API
   * and OEM approvals maintained per grade") and all three of its tags were certification claims,
   * so there was nothing left of it once those went. Five modules, not six.
   */
  {
    title: "Laboratory technology",
    body: "Viscometry, FTIR, ICP elemental analysis and oxidation rigs — 12,400 tests a month under one roof.",
    tags: ["FTIR", "ICP-OES", "Rotary bomb"],
    diagram: '<path d="M60 30h70v40l40 90H20l40-90z"/><path d="M52 118h86"/>',
  },
];

export const STORY_META: readonly Fact[] = [
  { value: "4", label: "Production lines" },
  { value: "18", label: "Lab instruments" },
  { value: "99.4%", label: "First-pass yield" },
  { value: "24/7", label: "Process monitoring" },
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
    body: "Passenger car, heavy-duty diesel and transmission fluids blended against API, ACEA and OEM sequences. Formulated for extended drain intervals in high-ambient markets.",
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
    body: "Solvents, paraffin waxes, slack wax and process oils supplied to converters and industrial formulators with consistent cut specifications.",
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
    body: "Hydraulic, gear, compressor, turbine and heat-transfer fluids for plants where an unplanned stop costs more than the fluid ever will.",
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
    body: "Private-label and branded programmes for distributors: formulation, packaging design, registration support and container-level export logistics.",
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
    body: "Metalworking, transformer, rubber process and food-grade fluids developed to a customer brief, from bench formulation to first commercial batch.",
    specs: [
      ["Development", "8 – 14 weeks"],
      ["Pilot batch", "200 – 2,000 L"],
      ["Approvals", "NSF H1 available"],
      ["IP", "Customer-owned"],
    ],
  },
];

export const BASE_OIL_GROUPS: readonly string[] = ["I", "II", "III"];

/* --------------------------------------------------------------- 4 · why */

export const LINE_OUTPUT: readonly { readonly id: string; readonly pct: number }[] = [
  { id: "L-01", pct: 58 },
  { id: "L-02", pct: 74 },
  { id: "L-03", pct: 46 },
  { id: "L-04", pct: 92 },
  { id: "L-05", pct: 66 },
  { id: "L-06", pct: 80 },
];

export const RELEASE_SPEC: readonly (readonly [string, string])[] = [
  ["Kinematic viscosity @100°C", "10.8 cSt"],
  ["Viscosity index", "168"],
  ["Pour point", "−42 °C"],
  ["Flash point (COC)", "228 °C"],
  ["Sulphated ash", "0.78 %m/m"],
];

/* "9 OEM approvals" is dropped from this list — an OEM approval is a certification claim, and it
   is the one entry here that no placeholder notice could make acceptable. Four figures, not five. */
export const TRUST: readonly Fact[] = [
  { value: "52", label: "Export markets" },
  { value: "130+", label: "Active distributors" },
  { value: "0", label: "Major NCRs, 5 years" },
  { value: "98.6%", label: "On-time shipment" },
];

export const TECH_TAGS: readonly string[] = [
  "SCADA",
  "Inline NIR",
  "Gravimetric dosing",
  "Nitrogen blanketing",
  "Batch genealogy",
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
  { value: "52", label: "Countries served" },
  { value: "240K", label: "MT export capacity" },
  { value: "130+", label: "Global partners" },
  { value: "4", label: "Production complexes" },
  { value: "98.6%", label: "On-time delivery" },
];

/* ------------------------------------------------------------------ 6 · lab */

export const LAB_CARDS: readonly {
  readonly value: number;
  readonly suffix: string;
  readonly label: string;
  readonly body: string;
}[] = [
  {
    value: 12400,
    suffix: "+",
    label: "Laboratory tests per month",
    body: "Viscometry, spectrometry, FTIR and elemental analysis under one roof.",
  },
  {
    value: 1000,
    suffix: "h",
    label: "Endurance validation",
    body: "Accelerated ageing before a formulation is released to production.",
  },
  {
    value: 34,
    suffix: "",
    label: "Research engineers",
    body: "Chemists, tribologists and process engineers on a shared bench.",
  },
];

export const LAB_TAGS: readonly string[] = [
  "Tribology",
  "Oxidation stability",
  "Additive synergy",
  "Field return analysis",
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
    title: "Research",
    body: "A brief becomes a target property set: viscosity envelope, oxidation life, seal compatibility and cost ceiling.",
    facts: [
      ["8–14 wk", "Cycle"],
      ["34", "Engineers"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.16)"><path d="M0 60h400M0 120h400M0 180h400M0 240h400M80 0v300M160 0v300M240 0v300M320 0v300"/></g><g stroke="#2F6BFF" stroke-width="1.3"><path d="M140 110l30-17 30 17v34l-30 17-30-17z"/><path d="M200 144l30-17 30 17v34l-30 17-30-17z"/><path d="M170 93V59M230 127V93l30-17"/></g><g fill="#7DA9FF"><circle cx="170" cy="93" r="3.4"/><circle cx="230" cy="127" r="3.4"/><circle cx="260" cy="76" r="3.4"/><circle cx="140" cy="144" r="3.4"/></g><circle cx="215" cy="150" r="66" stroke="rgba(201,167,92,.45)" stroke-dasharray="4 6"/><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">MOLECULAR SCREENING · 1,240 CANDIDATES</text></svg>',
  },
  {
    n: "02",
    title: "Formulation",
    body: "Base stock and additive chemistry are balanced on the bench. Most candidates die here, and that is the point.",
    facts: [
      ["480+", "Formulations"],
      ["±0.15%", "Dosing"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.2)" stroke-width="1.2"><path d="M150 50h100M170 50v70l-46 96a14 14 0 0013 20h126a14 14 0 0013-20l-46-96V50"/></g><path d="M133 190h134l14 26a14 14 0 01-13 20H132a14 14 0 01-13-20z" fill="rgba(47,107,255,.28)"/><g stroke="#7DA9FF" stroke-width="1"><path d="M60 70h44M60 100h44M60 130h44M296 70h44M296 100h44M296 130h44"/></g><g fill="#C9A75C"><circle cx="82" cy="70" r="2.6"/><circle cx="82" cy="100" r="2.6"/><circle cx="318" cy="100" r="2.6"/></g><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">GRAVIMETRIC DOSING · ±0.35%</text></svg>',
  },
  {
    n: "03",
    title: "Testing",
    body: "Accelerated ageing, four-ball wear, foam and corrosion rigs run for 1,000 hours before anything is approved.",
    facts: [
      ["1,000h", "Endurance"],
      ["12,400", "Tests / month"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.13)"><path d="M0 75h400M0 150h400M0 225h400M100 0v300M200 0v300M300 0v300"/></g><path d="M0 210C60 206 90 178 140 150S240 92 300 78s80-12 100-10" stroke="#2F6BFF" stroke-width="2"/><path d="M0 230C60 228 90 208 140 186S240 138 300 126s80-10 100-8" stroke="rgba(201,167,92,.6)" stroke-width="1.3" stroke-dasharray="5 7"/><g fill="#7DA9FF"><circle cx="140" cy="150" r="4"/><circle cx="300" cy="78" r="4"/></g><rect x="250" y="36" width="120" height="34" rx="8" fill="rgba(11,19,34,.8)" stroke="rgba(190,212,245,.2)"/><text x="264" y="58" fill="#D5DFEE" font-family="JetBrains Mono,monospace" font-size="11" letter-spacing="1.2">VI 142 · PASS</text><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">SHEAR STABILITY · 90 CYCLES</text></svg>',
  },
  {
    n: "04",
    title: "Production",
    body: "Approved recipes are locked into SCADA. The line cannot dose outside the released envelope, by design.",
    facts: [
      ["4", "Blend lines"],
      ["240K MT", "Capacity"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.2)" stroke-width="1.2"><rect x="30" y="90" width="70" height="130" rx="8"/><rect x="130" y="60" width="70" height="160" rx="8"/><rect x="230" y="110" width="60" height="110" rx="8"/><rect x="316" y="140" width="54" height="80" rx="8"/></g><g fill="rgba(47,107,255,.24)"><rect x="30" y="160" width="70" height="60" rx="8"/><rect x="130" y="120" width="70" height="100" rx="8"/><rect x="230" y="170" width="60" height="50" rx="8"/></g><g stroke="#2F6BFF" stroke-width="1.4" stroke-dasharray="6 9"><path d="M100 130h30M200 130h30M290 165h26"/></g><path d="M0 244h400" stroke="rgba(190,212,245,.24)"/><g fill="#C9A75C"><circle cx="65" cy="105" r="2.6"/><circle cx="165" cy="75" r="2.6"/><circle cx="260" cy="125" r="2.6"/></g><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">INLINE BLENDING · CONTINUOUS</text></svg>',
  },
  {
    n: "05",
    title: "Quality assurance",
    body: "Every batch is sampled, tested and released against a certificate of analysis. Retains are archived for five years.",
    facts: [
      ["100%", "Batch traceability"],
      ["5 yr", "Retained samples"],
    ],
    art: '<svg viewBox="0 0 400 300" fill="none"><g stroke="rgba(190,212,245,.15)"><rect x="40" y="40" width="320" height="180" rx="10"/><path d="M40 82h320M40 124h320M40 166h320M170 40v180"/></g><g stroke="#7DA9FF" stroke-width="1.6" stroke-linecap="round"><path d="M64 68l9 9 17-19"/><path d="M64 110l9 9 17-19"/><path d="M64 152l9 9 17-19"/><path d="M64 194l9 9 17-19"/></g><g fill="rgba(213,223,238,.5)"><rect x="196" y="56" width="120" height="4" rx="2"/><rect x="196" y="98" width="92" height="4" rx="2"/><rect x="196" y="140" width="134" height="4" rx="2"/><rect x="196" y="182" width="76" height="4" rx="2"/></g><rect x="40" y="40" width="320" height="3" fill="#C9A75C" opacity=".8"/><text x="24" y="278" fill="#5C6980" font-family="JetBrains Mono,monospace" font-size="8.5" letter-spacing="1.4">11 BENCH TESTS · BATCH SIGNED</text></svg>',
  },
  {
    n: "06",
    title: "Global distribution",
    body: "Drums, IBCs, flexitanks or ISO tanks leave one of six terminals with documents cleared before the vessel calls.",
    facts: [
      ["52", "Markets"],
      ["98.6%", "On-time"],
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
  { title: "Contact us", meta: "Inquiry form", href: ROUTES.contactUs },
  { title: "Request a quote", meta: "Pre-filtered inquiry", href: ROUTES.requestQuote },
  { title: "Product data sheets", meta: "TDS / SDS", href: ROUTES.documentation },
];

export const NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: "#story", label: "Manufacturing" },
  { href: "#products", label: "Products" },
  { href: "#network", label: "Global Network" },
  { href: "#lab", label: "Research" },
  { href: "#journey", label: "Process" },
  { href: "#insights", label: "Insights" },
];

/* `FOOTER_COLUMNS` now lives in `features/site/site-routes.ts` — the footer is site-level chrome,
   and its columns are navigation data rather than homepage content. Values are unchanged. */
