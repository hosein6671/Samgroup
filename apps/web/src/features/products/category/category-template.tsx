import type { ReactNode } from "react";

/*
 * The flagship brand scope, imported for the third time on the platform.
 *
 * `flagship.css` declares `[data-brand="flagship"]` — palette, type scale, layout wrappers and
 * button vocabulary. It still lives under `features/home` because the approved scope of the
 * chrome extraction was the site-level *components*, deliberately not a CSS reorganisation, and
 * this task's brief repeats that: do not move `flagship.css` again.
 *
 * So it is imported, not moved. `products.css` is imported too, and for one specific reason
 * rather than convenience — the shared closing CTA below is a Products-landing component and its
 * `.pr-close*` constructions live in that file. Importing the stylesheet is what reusing the
 * component honestly costs; duplicating its CSS under a `pc-` name would cost more.
 */
import "../../home/flagship.css";
import "../products.css";
import "./category.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";

import { FAMILIES } from "../products-data";
/*
 * §4 item 12, the "Product Page CTA (shared, per §3)", is genuinely shared — SITE_STRUCTURE
 * specifies one closing block for the landing and all six category pages. It is imported from
 * where it already lives rather than moved up a level, because moving it would edit the frozen
 * Products landing's imports for no behavioural gain. Its own file already notes the move as the
 * eventual tidy-up; this task is not the place for it.
 *
 * It also satisfies §4 item 9 (Customization), whose whole content is "links to Customized
 * Solutions" — the block's primary action *is* Request a Custom Solution.
 */
import { ClosingCta } from "../sections/closing-cta";

import type { ProductCategoryContent } from "./category-contract";
import { CategoryApplications } from "./sections/applications";
import { CategoryDocumentation } from "./sections/documentation";
import { CategoryFaq } from "./sections/faq";
import { CategoryHero } from "./sections/hero";
import { CategoryOverview } from "./sections/overview";
import { CategoryProperties } from "./sections/properties";
import { CategoryQuality } from "./sections/quality";
import { CategoryRangeSection } from "./sections/range";
import { CategoryRelated } from "./sections/related";
import { CategorySupply } from "./sections/supply";

/**
 * The Product Category template — one component, six pages.
 *
 * SITE_STRUCTURE §4 is explicit that this is a shared template: "every one of the six follows
 * this exact structure". So there is one of these, taking content, rather than six pages that
 * happen to resemble each other. Base Oils is its first instance; the remaining five are a
 * fixture file and a route file each, with no component work and no second architecture.
 *
 * ── Section order, against §4's numbering ───────────────────────────────────
 *
 *  1 Hero                    → `CategoryHero`
 *  2 Overview                → `CategoryOverview`
 *  3 Product Range           → `CategoryRangeSection`
 *  4 Key Specifications      → `CategoryProperties`
 *  5 Processing & Quality    → `CategoryQuality` (the named-process block is Base-Oil-only,
 *                              and optional in the contract for exactly that reason)
 *  6 Applications            → `CategoryApplications`
 *  7 Industries Served       → same component, and it does not render: the market list is an
 *                              open launch blocker, so no fixture supplies one
 *  8 Packaging & Supply      → `CategorySupply`
 *  9 Customization           → the shared closing CTA's primary action
 * 10 Documentation           → `CategoryDocumentation`
 * 11 FAQ                     → `CategoryFaq`
 * 12 Product Page CTA        → `ClosingCta`, imported from the landing
 *
 * `CategoryRelated` sits between 11 and 12 and is not one of §4's twelve. It is next-step
 * navigation, which §4's closing paragraph asks every category page for — "Every category page's
 * FAQ, Documentation, and Customization sections link back to …" — rendered as one strip rather
 * than three scattered links.
 *
 * ── What this page is ───────────────────────────────────────────────────────
 *
 * **Entirely server-rendered.** Not one component here carries `"use client"`. The range is
 * links and text, the specification table is a `<table>`, the FAQ is `<details>`, and every
 * reveal is the design system's scroll-driven CSS. The only client JavaScript on the page is the
 * header's, inherited from the shared chrome — the same budget the frozen landing holds to.
 *
 * ── Lift path ───────────────────────────────────────────────────────────────
 *
 * Same shape as the landing's. `app/[locale]/products/[categorySlug]/page.tsx` resolves the slug
 * through `data/index.ts` and renders this component unchanged; swapping the fixture registry for
 * `GET /api/v1/categories/:slug` is a change to that one module, since every section takes the
 * API's shapes already.
 */
export function ProductCategoryTemplate({
  content,
}: {
  readonly content: ProductCategoryContent;
}): ReactNode {
  /*
   * Name, code, href and descriptor come from the canonical family record, resolved once here
   * rather than restated in the fixture. A category page and the header's mega menu therefore
   * cannot disagree about what this category is called.
   */
  const family = FAMILIES.find((entry) => entry.id === content.familyId);
  if (!family) {
    throw new Error(`No product family "${content.familyId}" in products-data.ts`);
  }

  const props = { content, family } as const;

  return (
    <div data-brand="flagship">
      <SiteNav />

      <main id="main-content">
        <CategoryHero {...props} />
        <CategoryOverview {...props} />
        <CategoryRangeSection {...props} />
        <CategoryProperties {...props} />
        <CategoryQuality {...props} />
        <CategoryApplications {...props} />
        <CategorySupply {...props} />
        <CategoryDocumentation {...props} />
        <CategoryFaq {...props} />
        <CategoryRelated {...props} />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  );
}
