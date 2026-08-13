/**
 * The three self-hosted families, in one place because there are now two root layouts.
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
 * **`subsets: ["latin"]` is a known, unresolved gap, and it is now visible.** These three families
 * carry no Arabic or Persian glyph coverage, so `/fa` and `/ar` render from the browser's fallback
 * font. That is the open RTL typeface-pairing thread recorded in `AI_CONTEXT.md`, waiting on
 * design sign-off — it predates locale routing and is not introduced by it. What changed is that
 * there are now URLs where it can be seen. Widening the subsets would not fix it: no Arabic subset
 * of Inter exists to request, so the answer is a second family, which is a design decision.
 *
 * A shared module rather than duplicated calls: `next/font` keys its generated assets on the call
 * site, so two layouts each calling `Inter({...})` would be two font loaders producing two class
 * names for one typeface.
 */

import { IBM_Plex_Mono, Inter, Inter_Tight } from "next/font/google";

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
 * The three CSS variable classes, for the `<html>` element of either root layout.
 *
 * One exported string rather than three font objects, so a root layout cannot accidentally apply
 * two of the three — which is the failure the old single layout could not have, and two layouts
 * can.
 */
export const FONT_VARIABLES = `${display.variable} ${body.variable} ${mono.variable}`;
