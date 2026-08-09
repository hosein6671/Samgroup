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
 * PROVISIONAL — the RTL typeface pairing is the one open i18n decision (D-6, and
 * docs/i18n/INTERNATIONALIZATION_STRATEGY.md "Remaining Decisions"). Inter has no Arabic or
 * Persian coverage, so fa/ar must not inherit the Latin stack — it renders as tofu.
 * Until the pairing is signed off these fall back to whatever Arabic-capable face the system
 * provides, which is legible but is not a brand decision and must not be treated as one.
 */
export const rtlFontFamilies = {
  display: 'system-ui, "Segoe UI", "Noto Naskh Arabic", Tahoma, sans-serif',
  text: 'system-ui, "Segoe UI", "Noto Naskh Arabic", Tahoma, sans-serif',
  technical: 'system-ui, "Segoe UI", "Noto Naskh Arabic", Tahoma, sans-serif',
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
