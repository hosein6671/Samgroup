/*
 * The flagship brand scope, plus the two stylesheets this page borrows constructions from:
 * `products.css` for `.pr-inert` and `.pr-consent`, and `forms.css` for the `.fm-*` submission
 * banner. Restating either under a `cs-` name would duplicate CSS to avoid an import, which is the
 * trade AI_RULES.md's no-duplication rule exists to prevent. Both point at the same eventual
 * tidy-up — the inert-form vocabulary belongs in shared CSS — which is a task of its own.
 *
 * **`ClosingCta` is deliberately not imported.** Its primary action is this page.
 */
import "../home/flagship.css";
import "../products/products.css";
import "../forms/forms.css";
import "./solutions.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { CustomRequestForm } from "./sections/custom-request-form";
import { CustomizationScope } from "./sections/customization-scope";
import { CustomizationProcess } from "./sections/customization-process";
import { SolutionsHero } from "./sections/hero";
import { SolutionsIntroduction } from "./sections/introduction";

import type { CustomizedSolutionsContent } from "@sam-group/types";
import type { ReactNode } from "react";

/**
 * The Customized Solutions page.
 *
 * ── Editorial copy comes from the CMS; the form does not ────────────────────
 *
 * The hero, the introduction and the process rail render what
 * `GET /api/v1/content/globals/customized-solutions` served — the Payload `CustomizedSolutions`
 * Global, projected by the Content module. `apps/web` never calls Payload and has no awareness it
 * exists (ADR-003).
 *
 * **`CustomRequestForm` is not part of that.** It is a client component posting to a Server Action
 * that writes a Prisma `CustomFormulationRequest`; its fields, options, validation and consent text
 * live in `solutions-form.ts` beside the DTO they mirror. It takes no props from this component and
 * renders identically whatever the CMS holds — including when the CMS holds nothing, and including
 * when the CMS is down. That independence is the point: an editorial outage must never take a lead
 * capture path with it.
 *
 * ── Sections render if they exist ───────────────────────────────────────────
 *
 * The introduction and the process rail are nullable and simply absent when the CMS holds nothing
 * for them, so the page can be published in stages. Three sections SITE_STRUCTURE §5 specifies —
 * What Can We Customize, Private Label Programme, Case Examples — have no fields in the Global and
 * no components here; each is blocked on approved content, not on this gate.
 *
 * ── Server-rendered, apart from the form ────────────────────────────────────
 *
 * Only `CustomRequestForm` carries `"use client"`, and it did before this cutover too.
 */
export function SolutionsExperience({
  content,
  locale,
  locales,
  fallbackLocale = null,
}: {
  readonly content: CustomizedSolutionsContent;
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /**
   * The locale the CMS actually served, when it is not the one that was asked for.
   *
   * `null` whenever the requested locale is translated. Non-null it carries the served locale's own
   * `code` and `direction`, read from the `Locale` table rather than inferred from the code.
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
       * row, and a CMS fallback must never move them. What is annotated here is the content: when
       * the CMS served the default locale instead of the requested one, the copy inside `<main>`
       * genuinely is in that other language (WCAG 2.2 AA 3.1.2 Language of Parts), and `dir` travels
       * with it so a left-to-right fallback reads correctly inside a right-to-left document.
       *
       * The form is inside this element and its labels are code-owned English either way — the same
       * position the annotation states.
       */}
      <main
        id="main-content"
        {...(fallbackLocale !== null && {
          lang: fallbackLocale.code,
          dir: fallbackLocale.direction,
        })}
      >
        {fallbackLocale !== null && (
          <p className="cs-fallback-note" role="note">
            This page has not been translated into this language. It is shown in the site&rsquo;s
            default language.
          </p>
        )}

        <SolutionsHero hero={content.hero} process={content.process} locale={locale} />
        {content.introduction !== null && (
          <SolutionsIntroduction introduction={content.introduction} />
        )}
        {content.capabilities.length > 0 && (
          <CustomizationScope capabilities={content.capabilities} />
        )}
        {content.process !== null && <CustomizationProcess process={content.process} />}
        <CustomRequestForm />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
