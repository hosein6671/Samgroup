import type { ReactNode } from "react";

/*
 * The flagship brand scope, imported for the sixth time on the platform.
 *
 * `flagship.css` declares `[data-brand="flagship"]` — palette, type scale, layout wrappers and
 * button vocabulary. It still lives under `features/home` because the approved scope of the chrome
 * extraction was the site-level *components*, deliberately not a CSS reorganisation, and every page
 * built since has repeated that note rather than moving the file. This one does the same.
 * Promoting it remains a one-line move plus six import updates, and it stays deferred rather than
 * done quietly inside a page task.
 *
 * **No second page stylesheet is imported.** This page borrows no construction from another page's
 * layout, so it takes the brand scope and its own file and nothing else.
 */
import "../home/flagship.css";
import "./quality.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import { QualityApproach } from "./sections/approach";
import { QualityCertifications } from "./sections/certifications";
import { QualityClosing } from "./sections/closing";
import { QualityDocumentation } from "./sections/documentation";
import { QualityHero } from "./sections/hero";
import { QualityLaboratory } from "./sections/laboratory";
import { QualitySampling } from "./sections/sampling";

/**
 * The Quality & Certifications page.
 *
 * ── Seven sections, all seven specified ─────────────────────────────────────
 *
 * SITE_STRUCTURE §7 specifies: Hero → Our Quality Approach → Laboratory Capability →
 * Certifications → Documentation We Provide → Sampling Policy → Final CTA. All seven render. This
 * is the first page on the platform to carry its full specified section list — About Us omitted
 * three for want of any approved content at all.
 *
 * That is not because this page has more confirmed material. It is because its one blocked
 * section, Certifications, is blocked in a way that has a correct rendering: the section exists to
 * answer a question, and "the list is unconfirmed and nothing stands in its place" is an answer.
 * A milestone timeline has no equivalent — an empty timeline says nothing.
 *
 * ── What this page is, and is not ───────────────────────────────────────────
 *
 * **Entirely server-rendered.** Not one component here carries `"use client"`. The stages are an
 * ordered list, the properties are an ordered list, the documents are an ordered list, the media
 * slot is a `<figure>`, and every reveal is the design system's scroll-driven CSS. The only client
 * JavaScript on the page is the header's, inherited from the shared chrome — the same budget the
 * five pages before it hold.
 *
 * **No GSAP, no Mapbox, no new dependency, no client component, no shared architecture change, no
 * JSON-LD.** `AboutPage` structured data waits on the shared `<JsonLd>` component specified in
 * FRONTEND_ARCHITECTURE §4, which does not exist; building it here would be adding shared site
 * architecture inside a page task.
 *
 * ── Rhythm ──────────────────────────────────────────────────────────────────
 *
 * Dark hero → light Approach → dark Laboratory → light Certifications → dark Documentation →
 * light Sampling → dark close. Strict alternation across seven bands, which the page can carry
 * because its sections genuinely alternate in kind: each dark band holds a register of things the
 * page publishes, each light band holds a statement about them.
 *
 * The two light bands in the middle are the quiet ones by design — Certifications says the least
 * of any section here, and Sampling says the one thing this page is most certain of. They are
 * adjacent so the page's weakest and strongest claims are read against each other rather than
 * spread apart where the contrast would be lost.
 *
 * ── Lift path ───────────────────────────────────────────────────────────────
 *
 * Same shape as the five pages before it. Moving this to `app/[locale]/quality-certifications/
 * page.tsx` is this file unchanged plus swapping `quality-data.ts` from fixtures to the Payload
 * `QualityCertifications` Global through NestJS. The components take the same shapes either way,
 * because the fixture module is written against that Global's field list — with two recorded
 * exceptions, both noted in that module: the Global's `heroImage` has no slot on this page, and
 * its `certifications` relation has no component yet, because it has no approved rows to render.
 */
export function QualityExperience(): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <QualityHero />
        <QualityApproach />
        <QualityLaboratory />
        <QualityCertifications />
        <QualityDocumentation />
        <QualitySampling />
        <QualityClosing />
      </main>

      <SiteFooter />
    </div>
  );
}
