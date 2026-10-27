/**
 * The self-hosted families, in one place because there are now two root layouts.
 *
 * Extracted verbatim from the single `app/layout.tsx` that preceded them — same families, same
 * weights, same CSS variable names, same `display: "swap"`. Nothing about the typography changed
 * in this move; only its ownership did.
 *
 * **Fonts are self-hosted, not linked.** The prototype pulls three families from the Google Fonts
 * CDN; `next/font` downloads and serves them from our own origin at build time instead. That is
 * the documented rule (FRONTEND_ARCHITECTURE §13) and it matters more here than usual: ADR-005
 * puts the whole platform on one VPS with no third-party edge, so a render-blocking request to
 * fonts.googleapis.com would be a cross-origin round trip on the critical path, plus a GDPR
 * exposure this audience's procurement teams do ask about.
 *
 * **Persian is set in Shabnam, with Vazirmatn as the fallback** for any Arabic-script glyph the
 * Shabnam files do not carry — both chosen by the project owner on 26 October 2026. Two
 * properties keep it off every page that does not need it, which is what DESIGN_SYSTEM §7.4
 * means by "font families are locale-gated at load":
 *
 * - `preload: false` — no `<link rel="preload">` is emitted, so `/en` never fetches it eagerly.
 * - per-subset `unicode-range` from `next/font` — a browser downloads a face only when the page
 *   actually renders a character in its range, and the LTR stacks never name `--font-rtl-src`.
 *
 * The `latin` subset is requested on purpose: under `dir="rtl"` an English word, grade or brand
 * name inside a Persian sentence is set in Vazirmatn's own Latin, so the line reads as one family
 * rather than two unrelated faces side by side. Specification values keep the monospace face —
 * see `rtlFontFamilies` in `packages/ui/src/tokens/typography.ts`.
 *
 * A shared module rather than duplicated calls: `next/font` keys its generated assets on the call
 * site, so two layouts each calling `Inter({...})` would be two font loaders producing two class
 * names for one typeface.
 */

import { IBM_Plex_Mono, Inter, Inter_Tight, Vazirmatn } from "next/font/google";
import localFont from "next/font/local";

const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display-src",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body-src",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-src",
  display: "swap",
});

/**
 * Shabnam — the Persian text face, chosen by the project owner on 26 October 2026.
 *
 * Self-hosted from the `shabnam-font` release (SIL Open Font License 1.1; the licence travels
 * beside the files in `fonts/shabnam/LICENSE`). Four weights cover the scale: 300 for the large
 * display lines, 400 for reading copy, 500 for labels and 700 for buttons and emphasis, so no
 * weight is synthesized by the browser. Its Latin glyphs come from Roboto, which keeps an English
 * word inside a Persian sentence in the same family.
 */
const persian = localFont({
  src: [
    { path: "./fonts/shabnam/Shabnam-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/shabnam/Shabnam.woff2", weight: "400", style: "normal" },
    { path: "./fonts/shabnam/Shabnam-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/shabnam/Shabnam-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-fa-src",
  display: "swap",
  preload: false,
});

const rtl = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-rtl-src",
  display: "swap",
  preload: false,
});

/**
 * The four CSS variable classes, for the `<html>` element of either root layout.
 *
 * One exported string rather than four font objects, so a root layout cannot accidentally apply
 * some of them and not the others — which is the failure the old single layout could not have, and two layouts
 * can.
 */
export const FONT_VARIABLES = `${display.variable} ${body.variable} ${mono.variable} ${persian.variable} ${rtl.variable}`;
