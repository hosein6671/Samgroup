import "../home/flagship.css";
import "./about.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { AboutIndex } from "./about-index";
import { AboutClosing } from "./sections/closing";
import { AboutExpertise } from "./sections/expertise";
import { AboutHero } from "./sections/hero";
import { AboutQualityStandards } from "./sections/quality-standards";
import { AboutTeam } from "./sections/team";
import { AboutWhoWeAre } from "./sections/who-we-are";

import type { AboutUsContent } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The About Us page.
 *
 * ── Content comes from the CMS, through NestJS, and from nowhere else ───────
 *
 * This component took no props and read a fixture module until the CMS-1 gate. It now renders what
 * `GET /api/v1/content/globals/about-us` served — the Payload `AboutUs` Global, projected by the
 * Content module. `apps/web` never calls Payload and has no awareness it exists (ADR-003); nothing
 * in this subtree imports a CMS client, a CMS type or a CMS URL.
 *
 * The one thing on the page that is **not** CMS content is the published range in Who We Are: the
 * six Product Families are `Category` data in `sam_platform` and their navigation is code. Payload
 * may never mirror a Prisma-owned entity (ADR-002).
 *
 * ── Sections render if they exist ───────────────────────────────────────────
 *
 * Four of the five are nullable, and a `null` section is simply not rendered. That is the approved
 * cutover rule, and it is what lets this page be published a section at a time. It also means the
 * page cannot render a heading over an empty band.
 *
 * Company Milestones and Competitive Advantages remain absent until their factual content is
 * approved. Team is represented by accountable functions and approved editorial photography,
 * without fictional names or biographies.
 *
 * ── Still entirely server-rendered ──────────────────────────────────────────
 *
 * Not one component in this subtree carries `"use client"`. The only client JavaScript on the page
 * is the shared header's, and every reveal is the design system's scroll-driven CSS.
 */
export function AboutExperience({
  content,
  locale,
  locales,
  fallbackLocale = null,
}: {
  readonly content: AboutUsContent;
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /**
   * The locale the CMS actually served, when it is not the one that was asked for.
   *
   * `null` whenever the requested locale is translated, which is the ordinary case. Non-null it
   * carries the served locale's own `code` and `direction` — read from the `Locale` table, never
   * inferred from the code.
   */
  readonly fallbackLocale?: { readonly code: string; readonly direction: "ltr" | "rtl" } | null;
}): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      {/*
       * ── The route locale is not changed by a fallback ─────────────────────
       *
       * `<html lang>`/`<html dir>` are set by `app/[locale]/layout.tsx` from the **route's** locale
       * row, and a CMS fallback must never move them: `/ar/about-us` is an Arabic URL whose document
       * language is `ar` whether or not an editor has translated the page yet. Changing it would
       * change the page's language identity to work around missing content.
       *
       * What does change is this element. When the CMS served the default locale instead of the
       * requested one, the content inside `<main>` genuinely is in that other language, so it is
       * annotated here — WCAG 2.2 AA 3.1.2 Language of Parts — and `dir` travels with it so a
       * left-to-right fallback reads correctly inside a right-to-left document. The header, the
       * footer and the document itself keep the route's language and direction.
       */}
      <main
        id="main-content"
        {...(fallbackLocale !== null && {
          lang: fallbackLocale.code,
          dir: fallbackLocale.direction,
        })}
      >
        {fallbackLocale !== null && (
          <p className="ab-fallback-note" role="note">
            This page has not been translated into this language. It is shown in the site&rsquo;s
            default language.
          </p>
        )}

        <AboutHero hero={content.hero} locale={locale} />
        <AboutIndex content={content} />
        {content.whoWeAre !== null && <AboutWhoWeAre whoWeAre={content.whoWeAre} locale={locale} />}
        {content.expertise !== null && <AboutExpertise expertise={content.expertise} />}
        {content.team !== null && <AboutTeam team={content.team} />}
        {content.qualityStandards !== null && (
          <AboutQualityStandards qualityStandards={content.qualityStandards} locale={locale} />
        )}
        {content.closing !== null && <AboutClosing closing={content.closing} locale={locale} />}
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
