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
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { QualityApproach } from "./sections/approach";
import { QualityCertifications } from "./sections/certifications";
import { QualityClosingSection } from "./sections/closing";
import { QualityDocumentationSection } from "./sections/documentation";
import { QualityHero } from "./sections/hero";
import { QualityLaboratorySection } from "./sections/laboratory";
import { QualitySamplingSection } from "./sections/sampling";

import type { QualityCertificationsContent } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Quality & Certifications page.
 *
 * ── Content comes from the CMS, through NestJS, and from nowhere else ───────
 *
 * This component took no props and read a fixture module until the CMS-2B gate. It now renders what
 * `GET /api/v1/content/globals/quality-certifications` served — the Payload `QualityCertifications`
 * Global, projected by the Content module. `quality-data.ts` was **deleted** with the cutover rather
 * than kept as a fallback: two sources of truth for one published page is the failure mode the
 * cutover policy exists to prevent, and a page that silently fell back to code would hide from
 * everyone that the CMS is empty or unreachable.
 *
 * `apps/web` calls NestJS and nothing else. The browser makes no request to the CMS, and no Payload
 * origin, credential or shape exists anywhere in this app (ADR-003).
 *
 * ── The certifications band is unchanged by the cutover, deliberately ───────
 *
 * It still publishes one statement and no list. That is not restraint exercised here — it is the
 * only thing available: the Global models five localized strings for that section, the wire type has
 * no array, and the projection iterates nothing. No certificate, standard, licence, accreditation,
 * issuing body, number, validity date, mark or greyed-out slot can reach this page, because none of
 * them exists anywhere along the path.
 *
 * The `Certifications` collection and its Admin-only publish gate are a later gate. Moving editorial
 * control of this page into the CMS was precisely the moment **not** to soften it.
 *
 * ── Sections render if they exist ───────────────────────────────────────────
 *
 * Six of the seven are nullable, and a `null` section is simply not rendered. That is the approved
 * cutover rule, and it is what lets this page be published a section at a time without ever
 * rendering a heading over an empty band. The sampling section can additionally decline to render
 * itself when no product family key resolves — publishing the policy without its scope would be a
 * broader promise than the documentation makes.
 *
 * ── Rhythm ──────────────────────────────────────────────────────────────────
 *
 * Dark hero → light Approach → dark Laboratory → light Certifications → dark Documentation → light
 * Sampling → dark close. Strict alternation across seven bands, which the page can carry because its
 * sections genuinely alternate in kind: each dark band holds a register of things the page
 * publishes, each light band holds a statement about them.
 *
 * ── Still entirely server-rendered ──────────────────────────────────────────
 *
 * Not one component in this subtree carries `"use client"`. The only client JavaScript on the page
 * is the shared header's, and every reveal is the design system's scroll-driven CSS.
 */
export function QualityExperience({
  content,
  locale,
  locales,
  fallbackLocale = null,
}: {
  readonly content: QualityCertificationsContent;
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
       * row, and a CMS fallback must never move them: `/ar/quality-certifications` is an Arabic URL
       * whose document language is `ar` whether or not an editor has translated the page yet.
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
          <p className="qc-fallback-note" role="note">
            This page has not been translated into this language. It is shown in the site&rsquo;s
            default language.
          </p>
        )}

        <QualityHero hero={content.hero} approach={content.approach} locale={locale} />
        {content.approach !== null && <QualityApproach approach={content.approach} />}
        {content.laboratory !== null && (
          <QualityLaboratorySection laboratory={content.laboratory} />
        )}
        {content.certifications !== null && (
          <QualityCertifications certifications={content.certifications} />
        )}
        {content.documentation !== null && (
          <QualityDocumentationSection documentation={content.documentation} />
        )}
        {content.sampling !== null && (
          <QualitySamplingSection sampling={content.sampling} locale={locale} />
        )}
        {content.closing !== null && (
          <QualityClosingSection closing={content.closing} locale={locale} />
        )}
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
