import type { ReactNode } from "react";

import "./flagship.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import { BootCurtain, PointerRing, ScrollProgress } from "./chrome/site-chrome";
import { RevealEngine } from "./motion/reveal-engine";
import { Certifications } from "./sections/certifications";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Insights } from "./sections/insights";
import { Journey } from "./sections/journey";
import { Lab } from "./sections/lab";
import { Network } from "./sections/network";
import { Partnership } from "./sections/partnership";
import { Story } from "./sections/story";
import { Why } from "./sections/why";

/**
 * The Sam Group flagship homepage.
 *
 * A faithful rebuild of the approved prototype as a production Next.js composition. Nine
 * sections, each a different construction: a full-viewport oil field, a marquee seam, a sticky
 * column against disclosure panels, a perspective-projected orbital system, four bespoke
 * argument blocks, a dot-matrix world with live lanes, a molecular field, a horizontally pinned
 * journey, a magazine well, and a glass contact panel over rising particles.
 *
 * ── What changed from the prototype, and why ────────────────────────────────
 *
 * **Brand tokens are scoped, not global.** `flagship.css` re-maps the design system's semantic
 * tokens inside `[data-brand="flagship"]`. The prototype's palette contradicts three frozen
 * decisions — gold as the interactive colour, dark-first surfaces, 18/26px radii — so adopting
 * it platform-wide is an ADR, not a stylesheet. Scoped, the homepage is faithful and nothing
 * else on the platform moves.
 *
 * **Fonts are self-hosted.** The prototype links three families from the Google CDN; `next/font`
 * serves them from our origin (see `app/layout.tsx`). ADR-005 gives us no third-party edge, and
 * a render-blocking cross-origin font request is the wrong thing to put on the critical path.
 *
 * **The language switcher is not rebuilt.** Its inline four-language dictionary is precisely
 * what the frozen i18n decision forbids — the locale list is data in a `Locale` table, never
 * code (PROJECT_HANDOFF §6.9), and routing is next-intl's job in M2. Shipping the prototype's
 * version would mean building the thing that has to be deleted.
 *
 * **The form posts nowhere,** and says so. Submission endpoints are M4.
 *
 * **Figures are the prototype's, and are unaudited.** SITE_STRUCTURE marks the homepage
 * statistics `[ESTIMATE — CONFIRM]`; they must be replaced before launch.
 *
 * ── Lift path ──────────────────────────────────────────────────────────────
 *
 * This renders on a proof route. Moving it to `app/[locale]/page.tsx` is this file unchanged
 * plus swapping `home-data.ts` from fixtures to a Payload fetch and a catalog read — the
 * components take the same shapes either way.
 */
export function HomeExperience(): ReactNode {
  return (
    <div id="flagship-root" data-brand="flagship">
      <BootCurtain />
      <ScrollProgress />
      <PointerRing />
      <RevealEngine />

      <SiteNav />

      <main id="main-content">
        <Hero />
        <Certifications />
        <Story />
        <Ecosystem />
        <Why />
        <Network />
        <Lab />
        <Journey />
        <Insights />
        <Partnership />
      </main>

      <SiteFooter />
    </div>
  );
}
