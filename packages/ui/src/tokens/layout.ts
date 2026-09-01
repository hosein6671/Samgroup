// Layout tokens — containers, breakpoints, radii, elevation, glass.

import { measure } from "./typography";

/**
 * Container widths. `bleed` is deliberately absent as a token: it is the absence of a
 * max-width, which Container expresses directly rather than through a 100% value.
 */
export const containers = {
  narrow: "45rem",
  default: "75rem",
  wide: "90rem",
  /** Reading measure, exposed through the container namespace so `max-w-measure` exists. */
  measure,
} as const;

export type ContainerWidth = keyof typeof containers | "bleed";

/**
 * Tailwind's sm..2xl defaults are kept. 3xl exists so oversized editorial display type keeps
 * scaling on the large monitors this site's B2B audience actually uses, rather than stalling
 * at 1536px.
 */
export const breakpoints = {
  "3xl": "1800px",
} as const;

/**
 * Sharp by default. Rounding is what makes an industrial surface look like a consumer app.
 *
 * `pill` is the one exception and is not part of the scale: it is a fully-rounded end cap for
 * short, self-contained controls — the Admin filter and legend summary actions, the record
 * back-link — where the shape *is* the affordance. It is a large constant rather than a computed
 * `50%` so it stays correct as the control's height changes, and it is deliberately not `full`,
 * because nothing here is a circle.
 *
 * It was referenced by `features/admin/admin.css` before it existed, which resolved to no radius
 * at all — see ADR-022 §4.2 on `var()` names that are defined nowhere.
 */
export const radii = {
  none: "0",
  sm: "2px",
  md: "4px",
  lg: "8px",
  panel: "12px",
  pill: "999px",
} as const;

/**
 * Elevation, warm-tinted and low-opacity. A neutral grey shadow on a warm white canvas reads
 * as dirt; these are graphite at low alpha so they stay in the same temperature family.
 */
export const shadows = {
  hairline: "0 1px 0 0 rgb(16 20 28 / 0.04)",
  panel: "0 1px 2px 0 rgb(16 20 28 / 0.04), 0 8px 24px -8px rgb(16 20 28 / 0.08)",
  lifted: "0 2px 4px 0 rgb(16 20 28 / 0.05), 0 24px 48px -12px rgb(16 20 28 / 0.14)",
} as const;

/** Backdrop blur radius for IndustrialGlassPanel. */
export const glassBlur = "16px";

/**
 * The editorial grid — 12 columns, but addressed by named position rather than by counting
 * spans. `col-md-6` describes arithmetic; `half-start` and `margin-end` describe a place on a
 * page, which is how an editorial layout is actually reasoned about.
 *
 * The margin positions are the industrial part: a narrow annotation column for figure numbers,
 * methods and technical labels running alongside the main text block, the way a specification
 * sheet or an engineering drawing is set. They are the reason this is a grid and not a
 * two-column flexbox.
 *
 * The grid only engages from `md` up. Below that every placement collapses to full width —
 * a 12-column grid on a phone is arithmetic nobody can see.
 */
export const editorialGrid = {
  columns: 12,
  gutter: "clamp(1rem, 2vw, 2.5rem)",
  /** Viewport at which placements stop collapsing. Matches Tailwind's `md`. */
  engagesAt: "768px",
} as const;

/**
 * Named placements, expressed as CSS grid column ranges over the 12 tracks.
 * Kept as data so the CSS and the TypeScript union can never disagree about what exists.
 */
export const gridPlacements = {
  /** Edge to edge — full-bleed imagery, cinematic bands. */
  full: "1 / -1",
  /** Inset one track each side. The default for most editorial content. */
  wide: "2 / -2",
  /** The main text block, offset to leave a start margin for annotation. */
  main: "3 / 11",
  "half-start": "1 / 7",
  "half-end": "7 / -1",
  "third-start": "1 / 5",
  "third-mid": "5 / 9",
  "third-end": "9 / -1",
  "two-thirds-start": "1 / 9",
  "two-thirds-end": "5 / -1",
  /** The annotation columns — captions, figure numbers, methods, technical labels. */
  "margin-start": "1 / 3",
  "margin-end": "11 / -1",
} as const;

/**
 * Aspect ratios for photography slots. Launch photography is an open content dependency
 * (docs/ROADMAP.md M5), so every slot has a defined shape before it has an image — which is
 * what lets the empty state read as intentional instead of broken, and keeps CLS at zero
 * whenever the real asset does arrive.
 */
export const mediaRatios = {
  "media-editorial": "3 / 2",
  "media-portrait": "4 / 5",
  "media-cinematic": "21 / 9",
  "media-technical": "1 / 1",
} as const;
