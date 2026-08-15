import type { ReactNode } from "react";

/*
 * The flagship brand scope, imported for the fourth time on the platform.
 *
 * `flagship.css` declares `[data-brand="flagship"]` — palette, type scale, layout wrappers, field
 * styling and button vocabulary. It still lives under `features/home` because the approved scope
 * of the chrome extraction was the site-level *components*, deliberately not a CSS
 * reorganisation, and every page built since has repeated that note rather than moving the file.
 * This one does the same. Promoting it remains a one-line move plus four import updates, and it
 * stays deferred rather than done quietly inside a page task.
 *
 * ── Why `products.css` is imported by a page that renders none of its sections ──
 *
 * For exactly two constructions now: `.pr-inert` and `.pr-consent` — a dashed notice and a consent
 * row. Nothing about them is specific to the Products landing; they happen to have been written
 * there first, because that is where the first inert form appeared. `.pr-gate-fieldset` is no
 * longer used here: the request form is connected, and only its attachment control is disabled, so
 * there is no fieldset to dim. The class stays in `products.css` for the download gate that still
 * uses it.
 *
 * `forms.css` is imported for the `.fm-*` submission constructions this page now shares with
 * Contact Us — the outcome banner, and the one class that dims the disabled attachment field.
 *
 * Restating them under a `cs-` name would be duplicating CSS to avoid an import, which is the
 * trade AI_RULES.md's no-duplication rule exists to prevent. The category template already sets
 * this precedent, importing the same stylesheet for the one component it borrows. Both cases
 * point at the same eventual tidy-up: the inert-form vocabulary belongs in shared CSS, and that
 * is a task of its own rather than something to do inside a page build.
 *
 * **`ClosingCta` is deliberately not imported.** Its primary action is this page.
 */
import "../home/flagship.css";
import "../products/products.css";
import "../forms/forms.css";
import "./solutions.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import { CustomRequestForm } from "./sections/custom-request-form";
import { CustomizationProcess } from "./sections/customization-process";
import { SolutionsHero } from "./sections/hero";
import { SolutionsIntroduction } from "./sections/introduction";

/**
 * The Customized Solutions page.
 *
 * ── Four sections of a specified seven ──────────────────────────────────────
 *
 * SITE_STRUCTURE §5 specifies: Heading → Introduction → What Can We Customize? → Our Customization
 * Process → Private Label Programme → Case Examples → Custom Product Request.
 *
 * Four are built. The three omitted — What Can We Customize?, Private Label Programme, Case
 * Examples — have no approved copy, and the last of them is marked at source as placeholder
 * content pending real, customer-approved cases. They are withheld rather than invented, which is
 * the same handling the category template gives `industries` and `applications`. `solutions-data.ts`
 * records the reasoning per section, and the introduction names them on the page itself so a
 * reviewer reads a short page as unfinished rather than as complete.
 *
 * ── What this page is, and is not ───────────────────────────────────────────
 *
 * **Entirely server-rendered.** Not one component here carries `"use client"`. The process rail is
 * an ordered list, the form is a disabled `<fieldset>` with no `<form>` around it, and every
 * reveal is the design system's scroll-driven CSS. The only client JavaScript on the page is the
 * header's, inherited from the shared chrome — the same budget the three pages before it hold to.
 *
 * **No GSAP.** FRONTEND_ARCHITECTURE §8 reserves GSAP + ScrollTrigger for `CustomizationProcess`,
 * and it is not used: the dependency is not installed, adding one needs approval, and the
 * choreographed treatment was reserved for a sequence of six descriptions that this page does not
 * yet have. Noted in the component rather than silently skipped.
 *
 * **It closes on the form.** The shared `ClosingCta` is not rendered here — its primary action
 * points at this page. Seven frozen pages send visitors here to submit a request; the request is
 * the last thing on the page.
 *
 * ── Lift path ───────────────────────────────────────────────────────────────
 *
 * Same shape as the three pages before it. Moving this to
 * `app/[locale]/customized-solutions/page.tsx` is this file unchanged plus swapping
 * `solutions-data.ts` from fixtures to the Payload `CustomizedSolutions` Global through NestJS.
 * The components take the same shapes either way, because the fixture module is already written
 * against that Global's field list.
 */
export function SolutionsExperience(): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <SolutionsHero />
        <SolutionsIntroduction />
        <CustomizationProcess />
        <CustomRequestForm />
      </main>

      <SiteFooter />
    </div>
  );
}
