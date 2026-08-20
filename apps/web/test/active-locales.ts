import type { LocaleResponse } from "@sam-group/types";

/**
 * The active locale set, **as a test double for `GET /locales`**.
 *
 * ── Why this is here and not in `src` ──────────────────────────────────────
 *
 * NAV-1 made the shared chrome take the active locale set as a prop, supplied by the page from the
 * `Locale` table. Every spec that renders a page template therefore has to hand it one, and it has
 * to come from somewhere that can never be mistaken for the platform's answer to "which locales
 * exist". `test/` is outside the runner's `include`, is not reachable from `src`, and ships in no
 * bundle — which is exactly the property the deleted `LOCALES` fixture in `site-routes.ts` did not
 * have, and the reason it was deleted rather than moved.
 *
 * The values match the frozen Phase 1 set (`apps/cms/src/localization.ts`, the `Locale` seed) so
 * the specs exercise the real shape — three locales, one default, two of them RTL.
 */
export const ACTIVE_LOCALES: readonly LocaleResponse[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl", isDefault: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl", isDefault: false },
];

/** Just the codes, for the helpers that take a code list rather than the records. */
export const ACTIVE_LOCALE_CODES: readonly string[] = ACTIVE_LOCALES.map((entry) => entry.code);
