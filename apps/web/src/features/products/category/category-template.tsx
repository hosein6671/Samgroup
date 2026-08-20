import { Suspense } from "react";
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
/*
 * The product list's own stylesheet, imported on exactly the principle stated for `products.css`
 * above: the block is a Products-domain component reused here, and importing its CSS is what that
 * reuse honestly costs. It is a separate file rather than a section of `category.css` because
 * `ProductCard` is written against the `GET /products` row and the Product Finder lists the same
 * row — a card styled inside the category template's stylesheet could not be reused without
 * dragging this page along with it.
 */
import "../product-list.css";
import "./category.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav, type SiteNavProps } from "@/features/site/site-nav";

import type { ProductListResult } from "@/lib/products";

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

import type { ProductFamily } from "../products-data";

import type { ProductCategoryContent } from "./category-contract";
import { CategoryApplications } from "./sections/applications";
import { CategoryCatalog, CategoryCatalogSkeleton } from "./sections/catalog";
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
 *  – Published products      → `CategoryCatalog` — see below; not one of §4's twelve
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
 * `CategoryCatalog` is not one of the twelve either, and for a plainer reason: §4 was written when
 * `apps/web` had no Product entity at all. It states the family's CATALOG — the `Product` rows
 * `sam_platform` actually holds — where item 3 above it states the family's approved TAXONOMY.
 * Two different claims, so two blocks; see the section's own note.
 *
 * ── What this page is ───────────────────────────────────────────────────────
 *
 * **Entirely server-rendered.** Not one component here carries `"use client"`. The range is
 * links and text, the specification table is a `<table>`, the FAQ is `<details>`, and every
 * reveal is the design system's scroll-driven CSS. The only client JavaScript on the page is the
 * header's, inherited from the shared chrome — the same budget the frozen landing holds to.
 *
 * **The Segment filter does not change that.** It is a row of links to this same route carrying a
 * `?segment=` query, so filter state lives in the URL, refresh and sharing work by construction,
 * and the browser's history is the state machine. No control, no handler, no hydration.
 *
 * ── Why the catalog is the one section inside a `Suspense` boundary ─────────
 *
 * The route creates the product-list promise and does **not** await it, so this template streams
 * the eleven sections that owe the catalog nothing while that request is in flight. Without the
 * boundary, a slow catalog service would hold the whole page for up to the API client's ten-second
 * timeout — approved editorial content blocked on a list it does not depend on, which is the same
 * failure ADR-010 §7 forbids in its stronger form.
 *
 * Data access still belongs to the route (FRONTEND_ARCHITECTURE §7): the promise is created there
 * and passed down. This template awaits nothing and fetches nothing.
 *
 * ── Lift path ───────────────────────────────────────────────────────────────
 *
 * Same shape as the landing's. `app/[locale]/products/[categorySlug]/page.tsx` resolves the slug
 * through `resolve-category-page.ts` and renders this component unchanged.
 *
 * ── Why `family` is a prop ──────────────────────────────────────────────────
 *
 * It used to be looked up here, from `FAMILIES`, by `content.familyId`. It is now resolved by
 * `resolve-category-page.ts` and passed in, because the family record is no longer purely local:
 * its `name` is merged from `GET /api/v1/categories/:slug` when that call succeeds. A component
 * that fetched its own would be a Server Component doing data access below the page — the one
 * thing FRONTEND_ARCHITECTURE.md §7 asks routes not to do — and one that kept looking the record
 * up locally would silently discard the merge.
 *
 * The lookup's invariant did not soften in the move: a fixture naming a `familyId` outside the
 * canonical six still throws, in the resolver.
 */
export function ProductCategoryTemplate({
  content,
  family,
  locale,
  locales,
  products,
  activeSegment,
}: {
  readonly content: ProductCategoryContent;
  /*
   * Name, code, href and descriptor come from the canonical family record, resolved once by the
   * caller rather than restated in the fixture or re-looked-up per section. A category page and
   * the header's mega menu therefore cannot disagree about what this category is called.
   */
  readonly family: ProductFamily;
  /** The active locale segment. Half of every filter link the catalog section emits. */
  readonly locale: string;
  readonly locales: SiteNavProps["locales"];
  /** Created by the route and deliberately un-awaited — see the boundary note above. */
  readonly products: Promise<ProductListResult>;
  /** The normalized `?segment=` value, or `null` for the unfiltered view. */
  readonly activeSegment: string | null;
}): ReactNode {
  const props = { content, family } as const;
  /*
   * The catalog section takes the family's canonical identifier rather than the fixture's or the
   * route's, and they are the same string by the invariant `products-data.ts` enforces at module
   * load. Taking it from the resolved family record is what makes that explicit: this is the value
   * that goes on the wire as `?category=`, so it must be the one identity ADR-009 froze.
   */
  const catalog = {
    locale,
    familySlug: family.id,
    activeSegment,
  } as const;

  return (
    <div data-brand="flagship">
      <SiteNav locale={locale} locales={locales} />

      <main id="main-content">
        <CategoryHero {...props} />
        <CategoryOverview {...props} />
        <CategoryRangeSection {...props} />

        <Suspense fallback={<CategoryCatalogSkeleton {...catalog} />}>
          <CategoryCatalog {...catalog} products={products} />
        </Suspense>

        <CategoryProperties {...props} />
        <CategoryQuality {...props} />
        <CategoryApplications {...props} />
        <CategorySupply {...props} />
        <CategoryDocumentation {...props} />
        <CategoryFaq {...props} />
        <CategoryRelated {...props} />
        <ClosingCta />
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
