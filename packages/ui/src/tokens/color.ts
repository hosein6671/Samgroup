// Colour tokens — three tiers.
//
// Tier 1 (primitives) are raw ramps. Components must never reference them.
// Tier 2 (semantics) are the only names a component may use.
// Tier 3 (surface contexts) re-map tier 2 onto different tier 1 values, scoped to a
// [data-surface] block. That scoping is what makes selective midnight sections work with
// zero JavaScript and no theme provider: a Button inside <Section surface="midnight">
// is correct without knowing it sits on a dark background.
//
// Every value here is literal. The token build resolves primitive references at build time
// rather than emitting var() indirection, because a custom property whose value contains
// var() is substituted where it is *declared* (:root), not where it is used — so indirection
// through :root would silently defeat the [data-surface] override.

export type ColorRamp = Readonly<Record<string, string>>;

/** Warm neutrals. The canvas, the silver detail, and every hairline. */
export const platinum = {
  50: "#fbfaf8",
  100: "#f4f2ee",
  200: "#eae7e1",
  300: "#dad6ce",
  400: "#c9c5bc",
  500: "#ada89e",
  600: "#8a867d",
  700: "#66635c",
  800: "#45433e",
  900: "#2a2823",
} as const satisfies ColorRamp;

/** Dark section surfaces. Cinematic, never the default page background. */
export const midnight = {
  500: "#24334f",
  600: "#1b2740",
  700: "#121b2e",
  800: "#0b1220",
  900: "#070c18",
  950: "#04070f",
} as const satisfies ColorRamp;

/**
 * SAM Group's brand blue — the primary identity colour, taken from the logo mark.
 *
 * `sam-blue-500` IS the logo colour and is not to be nudged for convenience: the mark is the
 * source of truth for brand identity. Every other step is derived from it, holding hue 207.5°
 * and moving lightness and saturation, so the whole ramp reads as one colour family rather
 * than a blue that merely resembles the logo.
 *
 * PROVENANCE — `sam-blue-500` is currently **sampled from the supplied logo raster**, not read
 * from a brand specification. If an official vector, Pantone or CMYK definition exists, it
 * supersedes this value: replace this one constant and run `tokens:build`. Nothing else in the
 * codebase needs to change, because components reference semantic tokens (`accent-default`,
 * `text-accent`, `focus-ring`) and never a colour name. Re-run the contrast audit afterwards —
 * a lighter brand blue would not necessarily keep the light-context headroom this value has.
 *
 * It is deliberately not a navy. `midnight` below is a separate ramp for dark surfaces and is
 * never the brand or accent colour — the two must not be conflated.
 *
 * The logo blue is dark enough (L 27%) to carry white text at 9.14:1, so it serves as both the
 * identity colour and the interactive accent on light surfaces without a derived substitute.
 * On midnight it inverts to a lighter step, since the brand value itself disappears there.
 */
export const samBlue = {
  50: "#f0f7fc",
  100: "#dcecf9",
  200: "#b9d9f4",
  300: "#81b9e9",
  400: "#318cd8",
  500: "#0a4a80",
  600: "#073c69",
  700: "#043055",
  800: "#032440",
  900: "#01192d",
} as const satisfies ColorRamp;

/**
 * Rare gold. Governed by a hard rule, not taste:
 * never a call to action, never body text, never a background, never the sole carrier of
 * meaning, and at most once per viewport. It marks certification, provenance and milestone
 * numerals. Without the rule, "rare premium gold" becomes ordinary gold within two sprints.
 */
export const brass = {
  200: "#e8d6ac",
  300: "#d9be7e",
  400: "#c9a24b",
  500: "#a67f33",
  600: "#7d5f26",
} as const satisfies ColorRamp;

/** Text on light surfaces. Cool enough to separate from the warm canvas. */
export const graphite = {
  500: "#5f6775",
  600: "#525a68",
  700: "#4a5261",
  800: "#2b313c",
  900: "#10141c",
} as const satisfies ColorRamp;

// Keys are the emitted CSS custom-property segment, so they are kebab-case, not the
// TypeScript identifier: --color-sam-blue-500, never --color-samBlue-500.
export const colorPrimitives = {
  platinum,
  "sam-blue": samBlue,
  midnight,
  brass,
  graphite,
} as const;

/** The tier 2 vocabulary. Every surface context supplies exactly these keys. */
export type SemanticColorToken =
  | "surface-canvas"
  | "surface-raised"
  | "surface-sunken"
  | "surface-inset"
  | "surface-inverse"
  | "text-primary"
  | "text-secondary"
  | "text-tertiary"
  | "text-accent"
  | "text-inverse"
  | "text-on-accent"
  | "border-hairline"
  | "border-strong"
  | "border-accent"
  | "accent-default"
  | "accent-hover"
  | "accent-muted"
  | "highlight-rare"
  | "focus-ring"
  | "glass-fill"
  | "glass-border";

export type SurfaceContextTokens = Readonly<Record<SemanticColorToken, string>>;

/** Light — the default context. The site is light-first; midnight is the exception. */
export const lightContext = {
  "surface-canvas": platinum[50],
  "surface-raised": "#ffffff",
  "surface-sunken": platinum[100],
  "surface-inset": platinum[200],
  "surface-inverse": midnight[800],
  "text-primary": graphite[900],
  "text-secondary": graphite[700],
  "text-tertiary": graphite[500],
  // The brand value itself, unmodified — it measures 8.71:1 here, so identity and legibility
  // do not have to be traded against each other on light surfaces.
  "text-accent": samBlue[500],
  "text-inverse": platinum[50],
  "text-on-accent": "#ffffff",
  "border-hairline": platinum[200],
  // platinum-600, not the lighter 400 the eye would pick: border-strong is the boundary that
  // identifies an interactive component (the secondary Button's outline), so WCAG 1.4.11 puts
  // a hard 3:1 floor under it. border-hairline stays decorative and is exempt.
  "border-strong": platinum[600],
  "border-accent": samBlue[500],
  // The brand blue is the call to action. One blue in the system, so identity and interaction
  // reinforce each other instead of competing.
  "accent-default": samBlue[500],
  "accent-hover": samBlue[600],
  "accent-muted": samBlue[50],
  "highlight-rare": brass[600],
  "focus-ring": samBlue[500],
  "glass-fill": "rgb(255 255 255 / 0.62)",
  "glass-border": "rgb(255 255 255 / 0.78)",
} as const satisfies SurfaceContextTokens;

/**
 * Midnight — a section treatment, not a dark mode. There is no colour-scheme media query
 * and no toggle anywhere in this system; a section opts in and its descendants follow.
 */
export const midnightContext = {
  "surface-canvas": midnight[800],
  "surface-raised": midnight[700],
  "surface-sunken": midnight[900],
  "surface-inset": midnight[600],
  "surface-inverse": platinum[50],
  "text-primary": platinum[50],
  "text-secondary": "#aeb8c9",
  "text-tertiary": "#8791a3",
  // sam-blue-500 is invisible against midnight (1.44:1). The brand hue is preserved by
  // stepping up the ramp rather than reaching for a different colour — same family, legible.
  "text-accent": samBlue[300],
  "text-inverse": graphite[900],
  "text-on-accent": midnight[900],
  "border-hairline": "rgb(255 255 255 / 0.10)",
  // 0.40, not 0.22: composited over midnight-800 the lower alpha measures 1.88:1, under the
  // same 3:1 interactive-boundary floor as its light counterpart.
  "border-strong": "rgb(255 255 255 / 0.40)",
  "border-accent": samBlue[300],
  "accent-default": samBlue[300],
  "accent-hover": samBlue[200],
  "accent-muted": "rgb(49 140 216 / 0.18)",
  "highlight-rare": brass[300],
  "focus-ring": samBlue[300],
  "glass-fill": "rgb(255 255 255 / 0.06)",
  "glass-border": "rgb(255 255 255 / 0.14)",
} as const satisfies SurfaceContextTokens;

export const surfaceContexts = {
  light: lightContext,
  midnight: midnightContext,
} as const;

export type SurfaceContextName = keyof typeof surfaceContexts;

/**
 * Industrial gradients. Surface treatments and hairlines only — never behind body text.
 * These are the non-photographic texture the design leans on, since launch photography is
 * an open content dependency (docs/ROADMAP.md M5).
 *
 * They are **surface-scoped, exactly like the semantic colours above**, and for the same
 * reason. Emitted only into :root they were not: `accent-edge` kept the light brand blue
 * inside a midnight section and measured 2.05:1 against the canvas, so
 * `<Divider variant="accent">` — the rule the system documents for cinematic sections —
 * drew itself invisibly in the one place it was meant to be used. The colour tokens beside
 * it stepped correctly to sam-blue-300; the gradients had no tier 3 to step into.
 */
export type GradientToken = "platinum-sheen" | "midnight-depth" | "accent-edge" | "brass-hairline";

export type GradientContextTokens = Readonly<Record<GradientToken, string>>;

const platinumSheen = `linear-gradient(135deg, ${platinum[300]} 0%, ${platinum[50]} 42%, ${platinum[400]} 100%)`;
const midnightDepth = `radial-gradient(120% 100% at 50% 0%, ${midnight[600]} 0%, ${midnight[800]} 55%, ${midnight[900]} 100%)`;

export const lightGradients = {
  // Named for its role, not its colour, so a future brand revision is a value change here and
  // nothing else — no class rename propagating through every feature that drew a rule.
  "accent-edge": `linear-gradient(90deg, transparent 0%, ${samBlue[500]} 50%, transparent 100%)`,
  "brass-hairline": `linear-gradient(90deg, transparent 0%, ${brass[400]} 50%, transparent 100%)`,
  // A metallic highlight reads as metal on both canvases, so these two do not diverge.
  "platinum-sheen": platinumSheen,
  "midnight-depth": midnightDepth,
} as const satisfies GradientContextTokens;

export const midnightGradients = {
  // Stepped up the same ramp as `accent-default`/`border-accent`, not swapped for a different
  // colour: the brand hue is preserved and legibility is restored.
  "accent-edge": `linear-gradient(90deg, transparent 0%, ${samBlue[300]} 50%, transparent 100%)`,
  "brass-hairline": `linear-gradient(90deg, transparent 0%, ${brass[300]} 50%, transparent 100%)`,
  "platinum-sheen": platinumSheen,
  "midnight-depth": midnightDepth,
} as const satisfies GradientContextTokens;

export const gradientContexts = {
  light: lightGradients,
  midnight: midnightGradients,
} as const;

/** The :root defaults, for anything rendered outside a surface context. */
export const gradients = lightGradients;
