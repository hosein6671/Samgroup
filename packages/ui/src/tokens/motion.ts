// Motion tokens.
//
// A-2 ships no animation library. These are CSS custom properties only, so the motion
// foundation costs 0 KB of JavaScript; Framer Motion arrives with the first animated feature
// (docs/frontend/FRONTEND_ARCHITECTURE.md section 8), not here.

export const durations = {
  instant: "80ms",
  fast: "160ms",
  base: "240ms",
  slow: "400ms",
  editorial: "700ms",
  reveal: "900ms",
} as const;

export const easings = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  editorial: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/**
 * Four reveal patterns, named and finite. Applied consistently they read as designed; a dozen
 * ad-hoc ones read as busy.
 *
 * Implemented in styles/motion.css as scroll-driven CSS animations — `animation-timeline:
 * view()`, no IntersectionObserver, no animation library, no JavaScript at all. The whole
 * block sits behind @supports, so a browser without scroll-driven animation simply renders
 * the content in its final state rather than running the reveal on page load. Content is
 * always present in the DOM either way, which is what crawlers and screen readers require.
 */
export const revealPatterns = ["fade-rise", "mask-wipe", "hairline-draw", "stagger"] as const;

export type RevealPattern = (typeof revealPatterns)[number];

/** How far through an element's entry the reveal completes. */
export const revealRange = {
  start: "entry 5%",
  end: "entry 60%",
} as const;

/** Stagger step between siblings in a revealed group. */
export const staggerStep = "70ms";

/**
 * Global motion switches, both consumed at the point of use (inside calc() in a real CSS
 * property), never as var() nested in another custom property declaration.
 *
 * --motion-scale collapses every duration to zero under prefers-reduced-motion, site-wide,
 * including in components whose authors forgot to check.
 * --motion-dir flips the sign of directional transforms under [dir="rtl"], which is the
 * concrete mechanism for the RTL animation risk raised in the i18n strategy section 6.
 */
export const motionSwitches = {
  scale: { default: "1", reduced: "0" },
  direction: { ltr: "1", rtl: "-1" },
} as const;
