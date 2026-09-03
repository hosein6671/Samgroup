import type { ReactNode } from "react";

import "./flagship.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { BootCurtain, PointerRing, ScrollProgress } from "./chrome/site-chrome";
import { RevealEngine } from "./motion/reveal-engine";
import { Advantages } from "./sections/advantages";
import { CustomFormulation } from "./sections/custom-formulation";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Industries } from "./sections/industries";
import { Insights } from "./sections/insights";
import { Network } from "./sections/network";
import { Trust } from "./sections/trust";
import { WhoWeAre } from "./sections/who-we-are";

/**
 * The Sam Group flagship homepage.
 *
 * Nine sections, aligned to the eight segments of `Sam Group Website Structure_v2.xlsx`'s
 * `Home Page` sheet plus the export map the owner asked to keep. Each is a different
 * construction: a full-viewport oil field with a product-route schematic, a two-column editorial
 * statement, three card grids, a perspective-projected orbital system, a horizontally pinned
 * six-step process, a dot-matrix world with live lanes, and a magazine well.
 *
 * ── What changed with the content realignment ───────────────────────────────
 *
 * The page previously ran Hero → Story → Ecosystem → Why → Network → Lab → Journey → Insights →
 * Partnership, which is not a specification of anything: it was the approved prototype's order.
 * The workbook specifies eight segments, and the map below is now that order. Four sections were
 * deleted outright, three were retargeted onto the segment they already fitted, and three are new.
 * The per-section notes carry the reasoning; `home-data.ts` carries the sourcing rules.
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
 * **No unaudited figure is left on the page.** The prototype's statistics — capacity, countries
 * served, production lines, lab instruments, on-time percentages — went with the sections that
 * carried them, and `DemoDataNotice`, the banner that disclaimed them, went with the last of them.
 * **The certification marquee was already removed** — ten unverified standards, which
 * SITE_STRUCTURE §7 forbids publishing under any framing — and the same rule now covers markets:
 * the export map names only the regions the workbook's `Notes` sheet does.
 *
 * ── Lift path ──────────────────────────────────────────────────────────────
 *
 * Swapping `home-data.ts` from fixtures to a Payload fetch and a catalog read is the whole
 * migration — the components take the same shapes either way.
 */
export function HomeExperience({
  locale,
  locales,
}: SiteNavProps & {
  /**
   * The published Privacy Policy's address, or `null`. **No longer consumed here**, and still
   * accepted so that `app/[locale]/page.tsx` — which belongs to the Legal workstream and is
   * unstaged — keeps compiling untouched.
   *
   * It existed for the `Partnership` section's consent line, and that section is removed: the
   * workbook's `Home Page` sheet has no final-CTA segment. The footer's own privacy link does not
   * come through here; `SiteFooter` resolves it itself.
   *
   * Dropping the prop, and the `getPrivacyPolicyHref` call that feeds it, is a one-line cleanup
   * for whoever lands the Legal workstream. Doing it here would mean editing that workstream's
   * file from this one.
   */
  readonly privacyPolicyHref?: string | null;
}): ReactNode {
  return (
    <div id="flagship-root" data-brand="flagship">
      <BootCurtain />
      <ScrollProgress />
      <PointerRing />
      <RevealEngine />

      <SiteNav locale={locale} locales={locales} />

      {/*
       * The eight segments of the workbook's `Home Page` sheet, in its order, followed by the
       * footer. Each maps to exactly one section, and the page carries nothing the sheet does not
       * specify — see `home-data.ts` for the sourcing rules the copy is written under.
       *
       *   1 Hero                          Hero
       *   2 Who We Are                     WhoWeAre
       *   3 Company Statistics             Trust        (rendered as Trust Indicators, no figures)
       *   4 Product Portfolio Overview     Ecosystem
       *   5 Why Choose Sam Group           Advantages
       *   6 Industries We Serve            Industries
       *   7 Custom Formulation Highlight   CustomFormulation
       *   -  (owner's addition)            Network
       *   8 Latest News / Insights         Insights
       *   9 Footer                         SiteFooter
       *
       * Removed with this gate: `Story`, `Why`, `Lab`, `Partnership` — none has a segment in the
       * sheet — and `DemoDataNotice`, which existed only to disclaim the illustrative figures those
       * sections carried. There are none left to disclaim.
       *
       * `Network` was removed with them and **restored at the owner's request**. It has no segment
       * in the sheet either; the instruction to keep it stands above the sheet. It sits after Custom
       * Formulation because that is where the page stops describing the product and starts
       * describing how it reaches the buyer, and its destinations were rewritten to the three
       * regions the `Notes` sheet names — see `HUBS` in `home-data.ts`.
       */}
      <main id="main-content">
        <Hero locale={locale} />
        <WhoWeAre locale={locale} />
        <Trust />
        <Ecosystem locale={locale} />
        <Advantages />
        <Industries />
        <CustomFormulation locale={locale} />
        <Network />
        <Insights locale={locale} />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
