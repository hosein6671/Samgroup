import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SolutionsExperience } from "@/features/customized-solutions/solutions-experience";

/**
 * The Customized Solutions page, on its canonical route — `/{locale}/customized-solutions`.
 *
 * `SolutionsExperience` is rendered **unchanged**, exactly as the three pages promoted before it
 * were: the component takes no props, reads no locale, performs no fetch, and supplies the
 * `#main-content` target the root layout's skip link points at. Its own header note called this
 * lift "this file unchanged plus swapping `solutions-data.ts` from fixtures to the Payload
 * `CustomizedSolutions` Global through NestJS" — **only the first half is this gate.**
 *
 * ── What this promotion actually resolves ───────────────────────────────────
 *
 * More links than any other page in this batch. `ROUTES.customizedSolutions` is a primary nav
 * item, the gold action on `ClosingCta` across the Products landing and all six Family pages, the
 * `customization` action on the category contract, and one of the three routes in both About Us's
 * and Quality's closing navigation. Every one of those redirected through middleware and then
 * 404'd. They resolve from this file onward. The proof route's own note said repointing the
 * canonical table at `/design-proof/*` "would be faking the lift rather than doing it" — this is
 * doing it.
 *
 * ── The page's proof-state furniture lifts with it, deliberately ─────────────
 *
 * Three specified sections are absent (What Can We Customize?, Private Label Programme, Case
 * Examples) and the introduction's aside names all three. The request form stays a `<fieldset
 * disabled>` with no `<form>` around it, behind its "Not connected" notice: there is still no
 * `POST /custom-formulation-requests`, and a form that accepts a specification and discards it is
 * worse than no form. None of that is touched here. `introduction.tsx` says of its aside that it
 * "should not lift"; read with its own next sentence, deletion is tied to approved copy arriving,
 * not to a URL changing — so it lifts unchanged and retires in the content gate that supersedes
 * it.
 *
 * ── Media, recorded and not implemented ─────────────────────────────────────
 *
 * This page reserves **no media frame at all** — the hero's right column is the six-step process
 * index, which is also the page's table of contents. That is unchanged here, and it is where the
 * platform's strongest motion opportunity sits: a process film belongs to `CustomizationProcess`,
 * as a full-width 16:9 band between the rail and the process note, because the section's whole
 * claim is a *sequence* and it currently publishes six bare step names for want of approved
 * descriptions. Recorded, not built: `customizationProcess[]` has no media field, the Payload
 * Global's own hero image has no slot on this page, and FRONTEND_ARCHITECTURE §8's reserved GSAP
 * treatment is still not a dependency of `apps/web`.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment is the parent's, and `app/[locale]/layout.tsx` already generates it from
 * the `Locale` table and closes it with `dynamicParams = false`. This route introduces no dynamic
 * segment of its own, so it has nothing to enumerate — restating either here would be a second
 * copy of the locale source that PROJECT_HANDOFF §6.9 keeps singular.
 *
 * ── Metadata, and what is deliberately absent ───────────────────────────────
 *
 * The title and description are the proof route's own two strings, character for character.
 *
 * **No `robots`.** `app/[locale]/layout.tsx` declares `robots: { index: false, follow: false }` for
 * this whole tree and every page inherits it. **No canonical and no `hreflang`** — both are
 * ADR-010 Non-Goals, and P3b is a route promotion, not the SEO launch. **No JSON-LD** — `Service`
 * structured data waits on the shared `<JsonLd>` component specified in FRONTEND_ARCHITECTURE §4,
 * which does not exist.
 *
 * ── The proof route is still live ───────────────────────────────────────────
 *
 * `/design-proof/customized-solutions` renders this same experience until a later gate redirects
 * it, per ADR-010 §9's order. Both trees carry `noindex, nofollow` from their own layouts, and the
 * proof route is what this one is validated against.
 */
export const metadata: Metadata = {
  title: "Customized Solutions — Sam Group",
  description:
    "Custom lubricant and base oil formulation developed against a stated specification, qualified by sample before commitment.",
};

export default function CustomizedSolutionsPage(): ReactNode {
  return <SolutionsExperience />;
}
