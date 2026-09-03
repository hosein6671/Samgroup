import {
  Anchor,
  Atom,
  Boxes,
  Car,
  ChevronDown,
  ClipboardCheck,
  Container,
  Download,
  Droplet,
  Factory,
  FlaskConical,
  Gauge,
  Handshake,
  Layers,
  Microscope,
  Route,
  Ship,
  SlidersHorizontal,
  Snowflake,
  TestTube,
  Truck,
} from "lucide-react";

import type { ReactNode } from "react";

/**
 * The public site's icon set — one family, one stroke, one size scale.
 *
 * ── This is the same contract `features/forms/wizard/icons.tsx` already established ──────────
 *
 * That module was written for the inquiry forms and holds nine status and action glyphs. This one
 * carries the *subject-matter* icons — the substances, processes and shipping units the catalogue
 * is about — for the marketing surface. The two are separate files on purpose: they are read by
 * different features and neither should grow the other's imports. What they are NOT allowed to be
 * is two different visual systems, so the three properties that make an icon set read as a set are
 * written here exactly as they are written there, and for the same reasons:
 *
 *   1. **One stroke width.** Mixing 1.5 and 2 across a page is the most common way an icon set
 *      stops looking like one. `STROKE` is the only place it appears.
 *   2. **Sizes from the shared tokens**, not from Lucide's numeric `size` prop, so an icon scales
 *      with the same `--fs-icon-*` scale as the rest of the Flagship system rather than carrying a
 *      second, private one.
 *   3. **`aria-hidden` by default**, because every icon here sits beside text that already says
 *      what it means.
 *
 * ── None of these icons carries meaning on its own ───────────────────────────────────────────
 *
 * Each one is paired with a visible label: the route step names its own stage, the specification
 * row names its own figure. Remove every icon on the page and nothing becomes unavailable to
 * anyone. That is the test they are held to (WCAG 1.1.1, 1.4.1), and it is why `aria-hidden` is
 * correct here rather than lazy.
 *
 * ── Why Lucide, and why this is not a new dependency ─────────────────────────────────────────
 *
 * `lucide-react` is already a dependency of `apps/web` and already ships in the three-step inquiry
 * forms. Nothing is being introduced; a set that existed on one surface is being extended to
 * another, under the contract that surface already proved.
 */

/**
 * One stroke width for the whole set, matching the forms' icons.
 *
 * Lucide's default is 2, which reads heavy at 14px and heavier still against the Flagship's
 * 300-weight display type. 1.75 is the figure the forms settled on and there is no reason for the
 * marketing surface to disagree with the form a visitor reaches from it.
 */
export const STROKE = 1.75;

export type IconSize = "sm" | "md" | "lg" | "xl";

export type IconProps = {
  /** Maps to `--fs-icon-sm|md|lg|xl`. Defaults to `md`, the 14px inline size. */
  readonly size?: IconSize;
  /** Adds the RTL mirror. Only glyphs that point somewhere need it. */
  readonly directional?: boolean;
  /**
   * Draws the glyph's strokes on when it scrolls into view, rather than fading it in whole.
   *
   * `.fs-draw` is a capability `flagship.css` and `motion/reveal-engine.tsx` have carried since the
   * homepage was built and **nothing had ever used**: the engine measures every path's
   * `getTotalLength()` into `--len` and the CSS animates `stroke-dashoffset` from it. A Lucide
   * glyph is pure stroke, which is exactly what that pattern was written for.
   *
   * Opt-in, because it is not free: it observes one more element per icon and it only reads as
   * intentional where a few glyphs appear together. A menu row does not want it.
   */
  readonly draw?: boolean;
};

function iconClass({ size = "md", directional = false, draw = false }: IconProps): string {
  return ["fs-icon", `fs-icon--${size}`, directional ? "fs-icon--dir" : "", draw ? "fs-draw" : ""]
    .filter((token) => token !== "")
    .join(" ");
}

/*
 * `focusable="false"` alongside `aria-hidden`: IE-era SVG behaviour still surfaces in some
 * assistive technology, and an `aria-hidden` element that is still focusable is a tab stop that
 * announces nothing.
 */
const HIDDEN = { "aria-hidden": true, focusable: "false" } as const;

/* ------------------------------------------------- the product route, in order */

/** Stage 1 — the base stock a blend starts from. */
export function BaseStockIcon(props: IconProps = {}): ReactNode {
  return <Droplet className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Stage 2 — blending and the additive package. */
export function BlendIcon(props: IconProps = {}): ReactNode {
  return <FlaskConical className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Stage 3 — the grade: viscosity and the recorded specification. */
export function GradeIcon(props: IconProps = {}): ReactNode {
  return <Gauge className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Stage 4 — packaging: bulk, flexitank, IBC, drum. */
export function PackagingIcon(props: IconProps = {}): ReactNode {
  return <Container className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Stage 5 — destination and the shipping term. */
export function DestinationIcon(props: IconProps = {}): ReactNode {
  return <Ship className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/* ------------------------------------------- the hero specification panel rows */

/** The six product families. */
export function FamiliesIcon(props: IconProps = {}): ReactNode {
  return <Layers className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** The catalogue's product count. */
export function CatalogueIcon(props: IconProps = {}): ReactNode {
  return <Boxes className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** The single structured enquiry route. */
export function EnquiryRouteIcon(props: IconProps = {}): ReactNode {
  return <Route className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/* ------------------------------------------- the six product families, in nav order */

/*
 * One glyph per family, and the set is chosen so no two are confusable at 14px: a drop, an atom,
 * a car, a factory, an anchor, a snowflake. Each names the SUBJECT — the substance or the machine
 * the family is for — rather than an abstract mark, because a buyer scanning a menu is looking for
 * their application, not for decoration.
 *
 * `BaseOilsIcon` is deliberately the same `Droplet` as the hero route's stage 1. Both mean the same
 * substance, and giving one thing two glyphs is how an icon set stops being a language.
 */

/** Base Oils. */
export function BaseOilsIcon(props: IconProps = {}): ReactNode {
  return <Droplet className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Lubricant Additives & Components. */
export function AdditivesIcon(props: IconProps = {}): ReactNode {
  return <Atom className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Engine Oils & Automotive Lubricants. */
export function AutomotiveIcon(props: IconProps = {}): ReactNode {
  return <Car className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Industrial Oils & Lubricants. */
export function IndustrialIcon(props: IconProps = {}): ReactNode {
  return <Factory className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Marine Oils & Lubricants. An anchor, not a ship — the hero route already spends `Ship`. */
export function MarineIcon(props: IconProps = {}): ReactNode {
  return <Anchor className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Antifreeze & Coolants. */
export function CoolantsIcon(props: IconProps = {}): ReactNode {
  return <Snowflake className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/* --------------------------------------------------- the menu's two utility rows */

/** Product Finder — a filtered view, so the filter control's own glyph. */
export function FinderIcon(props: IconProps = {}): ReactNode {
  return <SlidersHorizontal className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Download Catalogue. */
export function CatalogueDownloadIcon(props: IconProps = {}): ReactNode {
  return <Download className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/* ------------------------------- the homepage's capability and industry glyphs */

/*
 * Some of these draw the same Lucide glyph as a family icon above — `ManufacturerIcon` and
 * `IndustrialIcon` are both `Factory`, `FormulationIcon` and `AdditivesIcon` are both `Atom`.
 * That is deliberate and it is the opposite of the rule further up: there, one *substance* may not
 * have two glyphs. Here, two different *ideas* legitimately share a picture — a factory is both
 * "we manufacture" and "industrial oils" — and giving each its own export means a later change to
 * one does not silently move the other.
 */

/** "Direct manufacturer" — the position the whole page rests on. */
export function ManufacturerIcon(props: IconProps = {}): ReactNode {
  return <Factory className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** "Sample before commitment" — the first step for engine oil and base oil enquiries alike. */
export function SampleIcon(props: IconProps = {}): ReactNode {
  return <TestTube className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Formulation to requirement. */
export function FormulationIcon(props: IconProps = {}): ReactNode {
  return <Atom className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Quality control. A clipboard, not a shield or a badge — neither of which we may imply. */
export function QualityIcon(props: IconProps = {}): ReactNode {
  return <ClipboardCheck className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Flexible supply. */
export function SupplyIcon(props: IconProps = {}): ReactNode {
  return <Truck className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Technical expertise. */
export function ExpertiseIcon(props: IconProps = {}): ReactNode {
  return <Microscope className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/** Long-term partnership. */
export function PartnershipIcon(props: IconProps = {}): ReactNode {
  return <Handshake className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}

/* ------------------------------------------------------------------- disclosure */

/**
 * The caret on a disclosure trigger — the Products menu and its mobile accordion.
 *
 * It replaces two hand-drawn `<path d="M5 9l7 7 7-7">` chevrons that carried `stroke-width="2.2"`
 * and `"2"`. Both were heavier than every other glyph on the page, and neither could be corrected
 * anywhere but at its own call site. **Not directional**: a caret points down, and down is down in
 * both reading directions — mirroring it would be a bug, not a fix.
 */
export function DisclosureCaretIcon(props: IconProps = {}): ReactNode {
  return <ChevronDown className={iconClass(props)} strokeWidth={STROKE} {...HIDDEN} />;
}
