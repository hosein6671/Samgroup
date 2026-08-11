import type { ReactNode } from "react";

/*
 * The flagship brand scope, imported for the fifth time on the platform.
 *
 * `flagship.css` declares `[data-brand="flagship"]` — palette, type scale, layout wrappers and
 * button vocabulary. It still lives under `features/home` because the approved scope of the chrome
 * extraction was the site-level *components*, deliberately not a CSS reorganisation, and every
 * page built since has repeated that note rather than moving the file. This one does the same.
 * Promoting it remains a one-line move plus five import updates, and it stays deferred rather than
 * done quietly inside a page task.
 *
 * **No second page stylesheet is imported.** Customized Solutions pulls in `products.css` for the
 * inert-form vocabulary it genuinely reuses; this page has no form and borrows no construction
 * from another page, so it imports the brand scope and its own file and nothing else.
 */
import "../home/flagship.css";
import "./about.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import { AboutClosing } from "./sections/closing";
import { AboutExpertise } from "./sections/expertise";
import { AboutHero } from "./sections/hero";
import { AboutQualityStandards } from "./sections/quality-standards";
import { AboutWhoWeAre } from "./sections/who-we-are";

/**
 * The About Us page.
 *
 * ── Five sections of a specified eight ──────────────────────────────────────
 *
 * SITE_STRUCTURE §2 specifies: Hero → Who We Are → Company Milestones → Our Expertise → Our
 * Competitive Advantages → Quality & Standards → Our Team → Final CTA.
 *
 * Five are built. The three omitted — Milestones, Competitive Advantages, Team — have no approved
 * content: the timeline is marked as an estimate end to end and named a launch blocker, the six
 * advantages are named in no document, and the team is blocked on photography with no roster.
 * `about-data.ts` records the reasoning per section and carries no field for any of them, and the
 * Who We Are section names all three on the page itself so a reviewer reads a short page as
 * unfinished rather than as complete.
 *
 * ── What this page is, and is not ───────────────────────────────────────────
 *
 * **Entirely server-rendered.** Not one component here carries `"use client"`. The expertise
 * register is an ordered list, the commitments are a list, the media slots are `<figure>`s, and
 * every reveal is the design system's scroll-driven CSS. The only client JavaScript on the page is
 * the header's, inherited from the shared chrome — the same budget the four pages before it hold.
 *
 * **No GSAP, no new dependency, no client component, no shared architecture change.**
 *
 * **Three media slots and no images.** The hero, Who We Are and Quality sections each reserve a
 * designed frame for a photograph the project does not have. Nothing is generated, nothing is
 * stock, and no facility is illustrated — `MediaFrame` in `sections/hero.tsx` explains what is
 * drawn instead and why.
 *
 * ── Rhythm ──────────────────────────────────────────────────────────────────
 *
 * Dark hero → light Who We Are → dark Expertise → light Quality → dark close. Alternating rather
 * than the category template's three anchors: each dark band carries a statement, each light band
 * carries the detail under it, and the page never puts two light sections next to each other
 * needing to be told apart by construction alone.
 *
 * ── Lift path ───────────────────────────────────────────────────────────────
 *
 * Same shape as the four pages before it. Moving this to `app/[locale]/about-us/page.tsx` is this
 * file unchanged plus swapping `about-data.ts` from fixtures to the Payload `AboutUs` Global
 * through NestJS. The components take the same shapes either way, because the fixture module is
 * written against that Global's field list — with one recorded exception, noted on `MediaSlot`:
 * two of the three media slots have no field in that Global yet.
 */
export function AboutExperience(): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <AboutHero />
        <AboutWhoWeAre />
        <AboutExpertise />
        <AboutQualityStandards />
        <AboutClosing />
      </main>

      <SiteFooter />
    </div>
  );
}
