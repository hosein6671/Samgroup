import type { ReactNode } from "react";

/*
 * The flagship brand scope, imported for the second time on the platform.
 *
 * `flagship.css` declares `[data-brand="flagship"]` — the palette, type scale, layout wrappers
 * and button vocabulary this page is built on. It still lives under `features/home` because the
 * approved scope of the chrome extraction was the site-level *components* only, deliberately not
 * a CSS reorganisation. Importing it here is the honest consequence: the stylesheet is already
 * site-level in fact, and this makes that visible instead of duplicating any of it.
 *
 * Promoting it to a shared location is a one-line move plus two import updates, and is listed in
 * the report as deferred rather than done quietly inside a page task.
 */
import "../home/flagship.css";
import "./products.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import { ClosingCta } from "./sections/closing-cta";
import { Documentation } from "./sections/documentation";
import { FinderTeaser } from "./sections/finder-teaser";
import { ProductsHero } from "./sections/hero";
import { ProductRegister } from "./sections/register";

/**
 * The Products landing page.
 *
 * Five sections in the order SITE_STRUCTURE §3 specifies: hero, the six families, the Product
 * Finder teaser, the documentation block, and the shared closing CTA.
 *
 * ── What this page is, and is not ───────────────────────────────────────────
 *
 * **It is entirely server-rendered.** Not one component here carries `"use client"`. The register
 * is links, the finder teaser is a picture and a link, the gate is a disabled fieldset, and every
 * reveal is `packages/ui`'s scroll-driven CSS. The only client JavaScript on the page is the
 * header's, which it inherits from the shared chrome.
 *
 * **It reuses the homepage's language rather than restating it.** Wrapper, section rhythm,
 * eyebrows, display scale, buttons, blueprint ground, glass and surface switching are all
 * flagship vocabulary used as-is; `products.css` adds only the constructions that did not exist
 * — the register, the facet still, the two document tiers, the closing routes.
 *
 * **The homepage's motion system is not borrowed.** `RevealEngine`, the pointer ring, the boot
 * curtain and the canvas visuals stay homepage-only. This page uses the design system's four
 * scroll-driven patterns instead, which need no JavaScript at all.
 *
 * ── Lift path ───────────────────────────────────────────────────────────────
 *
 * Same shape as the homepage's: moving this to `app/[locale]/products/page.tsx` is this file
 * unchanged plus swapping `products-data.ts` from fixtures to `GET /api/v1/categories`. The
 * components take the same shapes either way.
 */
export function ProductsExperience({ locale, locales }: SiteNavProps): ReactNode {
  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <ProductsHero locale={locale} />
        <ProductRegister locale={locale} />
        <FinderTeaser locale={locale} />
        <Documentation />
        <ClosingCta locale={locale} />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
