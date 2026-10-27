// Typography tokens — roles, not sizes.
//
// A component names `display-1`, never `text-7xl`. Decoupling the role from the HTML element
// is what allows a correct h1 -> h2 -> h3 outline underneath oversized editorial display type,
// which is the usual way premium layouts break their heading hierarchy.

/**
 * Latin families. Inter only, for now: docs/design/FRONTEND_DESIGN_DIRECTION.md also names
 * Neue Haas Grotesk and Helvetica Neue, both commercially licensed and not procured (D-5).
 * Swapping in a licensed grotesque later is a change to this one object.
 */
export const fontFamilies = {
  display: '"Inter Display", "Inter", ui-sans-serif, system-ui, sans-serif',
  text: '"Inter", ui-sans-serif, system-ui, sans-serif',
  technical: '"Inter", ui-sans-serif, system-ui, sans-serif',
} as const;

/**
 * RTL families — Shabnam first, the Persian face the project owner chose on 26 October 2026,
 * self-hosted through `next/font/local` (`apps/web/src/app/fonts.ts`) as `--font-fa-src` with
 * `preload: false`, so a Latin-only page never downloads it.
 *
 * Shabnam carries four weights and its own Latin (from Roboto), so an English word, grade or brand
 * name inside a Persian sentence stays in the same family. The stack continues with the Latin body
 * face and then Vazirmatn (`--font-rtl-src`) only as fallbacks.
 *
 * The technical stack is Shabnam first too. It used to put the monospace face first so grades and
 * units matched the English page, but a Persian label then took its spaces from the monospace face
 * (word gaps more than twice Shabnam's), and on Windows next/font's metric fallback for that face —
 * the reader's local Arial, which has Arabic-script glyphs — set whole Persian labels in Arial at
 * 135%. Persian labels, eyebrows and dates are now one family with the rest of the page; Shabnam's
 * Latin and digits (Roboto's, tabular by default) still keep specification columns aligned.
 */
export const rtlFontFamilies = {
  display:
    "var(--font-fa-src), var(--font-body-src), var(--font-rtl-src), Vazirmatn, Tahoma, sans-serif",
  text: "var(--font-fa-src), var(--font-body-src), var(--font-rtl-src), Vazirmatn, Tahoma, sans-serif",
  technical:
    "var(--font-fa-src), var(--font-mono-src), var(--font-rtl-src), Vazirmatn, ui-monospace, monospace",
} as const;

export type TypeRole = {
  /** Fluid where the role needs to scale; a fixed rem value where it must not. */
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly letterSpacing: string;
  readonly fontWeight: string;
  /**
   * Persian and Arabic need more leading than Latin — deeper descenders and diacritics.
   * Emitted as a scoped [dir="rtl"] override of the same custom property, so the value is
   * a literal rather than a var() indirection that :root would resolve too early.
   */
  readonly rtlLineHeight?: string;
};

export const typeRoles = {
  "display-1": {
    fontSize: "clamp(3rem, 6vw, 8.75rem)",
    lineHeight: "0.94",
    letterSpacing: "-0.035em",
    fontWeight: "600",
    rtlLineHeight: "1.15",
  },
  "display-2": {
    fontSize: "clamp(2.5rem, 4.5vw, 5.5rem)",
    lineHeight: "0.98",
    letterSpacing: "-0.03em",
    fontWeight: "600",
    rtlLineHeight: "1.2",
  },
  "headline-1": {
    fontSize: "clamp(2rem, 3vw, 3.5rem)",
    lineHeight: "1.06",
    letterSpacing: "-0.02em",
    fontWeight: "600",
    rtlLineHeight: "1.3",
  },
  "headline-2": {
    fontSize: "clamp(1.5rem, 2vw, 2.25rem)",
    lineHeight: "1.15",
    letterSpacing: "-0.015em",
    fontWeight: "600",
    rtlLineHeight: "1.4",
  },
  title: {
    fontSize: "clamp(1.125rem, 1.2vw, 1.5rem)",
    lineHeight: "1.3",
    letterSpacing: "-0.01em",
    fontWeight: "600",
    rtlLineHeight: "1.45",
  },
  "body-lead": {
    fontSize: "clamp(1.125rem, 1.1vw, 1.375rem)",
    lineHeight: "1.55",
    letterSpacing: "-0.005em",
    fontWeight: "400",
    rtlLineHeight: "1.75",
  },
  body: {
    fontSize: "1rem",
    lineHeight: "1.65",
    letterSpacing: "0",
    fontWeight: "400",
    rtlLineHeight: "1.85",
  },
  caption: {
    fontSize: "0.8125rem",
    lineHeight: "1.5",
    letterSpacing: "0.01em",
    fontWeight: "400",
    rtlLineHeight: "1.7",
  },
  /**
   * The engineering signal, and what separates this system from a luxury fashion one.
   * Its RTL form diverges beyond leading: Arabic script has no letter case and positive
   * tracking breaks cursive joining, so uppercase and letter-spacing are dropped entirely
   * for RTL and weight carries the emphasis instead. That divergence is why TechnicalLabel
   * is its own primitive rather than a variant of Text.
   */
  technical: {
    // Floor is 12px, not 11px. This role carries specification keys, test methods and
    // certification marks — uppercase, tracked at +0.12em — for an international B2B audience
    // reading in a second language. It is the hardest legibility case in the system, so it does
    // not get the smallest size in the system.
    fontSize: "clamp(0.75rem, 0.5vw, 0.8125rem)",
    lineHeight: "1.2",
    letterSpacing: "0.12em",
    fontWeight: "500",
    rtlLineHeight: "1.5",
  },
} as const satisfies Readonly<Record<string, TypeRole>>;

export type TypeRoleName = keyof typeof typeRoles;

/** Reading measure. Body copy never runs wider than this, in either direction. */
export const measure = "68ch";
