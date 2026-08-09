// Spacing and rhythm tokens.
//
// Tailwind v4 derives the whole numeric scale from a single --spacing base, so the ordinary
// steps (p-1 .. p-64, i.e. 4px .. 256px) need no enumeration here. What does need naming is
// the vertical rhythm: three section heights, applied consistently, are what produce the
// register. Free-form padding across 27 pages is what destroys it.

/** The base multiplier Tailwind's dynamic spacing scale is generated from. */
export const spacingBase = "0.25rem";

/**
 * Vertical rhythm. Owned exclusively by Section — Container never sets vertical padding.
 * One owner per axis is what stops rhythm drifting page to page.
 */
export const sectionRhythm = {
  compact: "clamp(3rem, 6vw, 6rem)",
  default: "clamp(5rem, 9vw, 10rem)",
  editorial: "clamp(7rem, 13vw, 14rem)",
} as const;

export type SectionRhythmName = keyof typeof sectionRhythm;

/** Horizontal page gutter. Logical (padding-inline), so RTL needs no branch. */
export const gutter = "clamp(1.25rem, 4vw, 4rem)";

/**
 * Named spacing steps that carry meaning beyond a number. Kept deliberately short — anything
 * expressible as a plain scale step stays a plain scale step.
 */
export const namedSpacing = {
  "section-compact": sectionRhythm.compact,
  "section-default": sectionRhythm.default,
  "section-editorial": sectionRhythm.editorial,
  gutter,
} as const;
