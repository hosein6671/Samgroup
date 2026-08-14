import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutExperience } from "@/features/about/about-experience";

/**
 * The About Us page, on its canonical route — `/{locale}/about-us`.
 *
 * `AboutExperience` is rendered **unchanged**, exactly as `HomeExperience` and
 * `ProductsExperience` were when the homepage and the Products landing lifted: the component takes
 * no props, reads no locale, performs no fetch, and supplies the `#main-content` target the root
 * layout's skip link points at. Its own header note called this lift "this file unchanged plus
 * swapping `about-data.ts` from fixtures to the Payload `AboutUs` Global through NestJS" — **only
 * the first half is this gate.** The fixture swap arrives with M2 and the CMS work behind it.
 *
 * ── The page's proof-state furniture lifts with it, deliberately ─────────────
 *
 * Three specified sections are absent (Company Milestones, Competitive Advantages, Our Team), the
 * Who We Are aside names all three, and the page carries three designed media frames holding
 * commissions for photography that does not exist. None of that is touched here. It is content
 * state, not route state, and it retires when the copy and the assets arrive — not as a side
 * effect of a URL changing. Removing any of it inside a route promotion would also make this page
 * stop matching the proof route it is validated against.
 *
 * ── Media, recorded and not implemented ─────────────────────────────────────
 *
 * The three frames stay exactly as they are: `MEDIA.hero` (facility, wide establishing view),
 * `MEDIA.whoWeAre` (production floor in context) and `MEDIA.quality` (quality laboratory). Each is
 * the brief for a real photograph from SITE_STRUCTURE's outstanding shot list, and each is a
 * one-element swap when that asset exists. Two of the three still have no field on the Payload
 * `AboutUs` Global, which `about-data.ts` records; whether the hero may eventually carry video is
 * a documented conflict between SITE_STRUCTURE and PAYLOAD_CONTENT_ARCHITECTURE that stays open.
 * Nothing about any of that is decided or built here.
 *
 * ── No `generateStaticParams`, and no `dynamicParams` ───────────────────────
 *
 * The `[locale]` segment is the parent's, and `app/[locale]/layout.tsx` already generates it from
 * the `Locale` table and closes it with `dynamicParams = false`. This route introduces no dynamic
 * segment of its own, so it has nothing to enumerate — restating either here would be a second
 * copy of the locale source that PROJECT_HANDOFF §6.9 keeps singular. This page sits at the same
 * depth as `products`, well outside ADR-010 §2's shared `products/{slug}` namespace.
 *
 * ── Metadata, and what is deliberately absent ───────────────────────────────
 *
 * The title and description are the proof route's own two strings, character for character.
 *
 * **No `robots`.** `app/[locale]/layout.tsx` declares `robots: { index: false, follow: false }` for
 * this whole tree and every page inherits it; a route-level override would be a second answer to a
 * settled question. **No canonical and no `hreflang`** — both are ADR-010 Non-Goals, and P3b is a
 * route promotion, not the SEO launch. **No JSON-LD** — `AboutPage` + `Organization` structured
 * data waits on the shared `<JsonLd>` component specified in FRONTEND_ARCHITECTURE §4, which does
 * not exist.
 *
 * ── The proof route is still live ───────────────────────────────────────────
 *
 * `/design-proof/about-us` renders this same experience until a later gate redirects it, per
 * ADR-010 §9's order. Two URLs answering is the transition's shape, not a duplication left behind:
 * both trees carry `noindex, nofollow` from their own layouts, and the proof route is what this
 * one is validated against.
 */
export const metadata: Metadata = {
  title: "About Us — Sam Group",
  description:
    "Sam Group produces its own range of petroleum products, lubricants and base oils in Iran, across six published product families.",
};

export default function AboutUsPage(): ReactNode {
  return <AboutExperience />;
}
