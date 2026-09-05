import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../../../../features/home/flagship.css";
import "../../../../features/products/products.css";
import "../../../../features/products/detail/product-detail.css";

import { SiteFooter } from "@/features/site/site-footer";
import { SiteNav } from "@/features/site/site-nav";
import { ProductSpecifications } from "@/features/products/detail/sections/specifications";
import { isProductionRuntime } from "@/features/site/proof-routes";

import type { LocaleResponse, ProductSpecificationResponse } from "@sam-group/types";

/**
 * A development-only preview of the ADR-014 Specification response extension, rendered by the
 * real `ProductSpecifications` component (`features/products/detail/sections/specifications.tsx`)
 * with fixture data, unmodified from what a real Product Detail page mounts.
 *
 * ── What each scenario proves, and why three rather than one ────────────────
 *
 * **"Full structured profile"** puts every value-shape the public API now serves on one product:
 * a single typical reading, a minimum limit, a maximum limit, a bounded range carrying a test
 * condition, and a legacy row with none of the additive columns set at all — proving the same
 * component renders all six without special-casing any of them. **"Incomplete product"** is the
 * component's genuine empty state — an empty array, called exactly as
 * `product-detail-template.tsx` now calls it unconditionally, drawing the "Technical data is under
 * review" panel rather than a table with nothing in it. **"Superseded revision stays
 * private"** exists because it cannot be shown any other way: there is no public field that could
 * ever prove a supersession happened, so the only way to demonstrate the guarantee is to state
 * what happened internally beside a row that looks, correctly, like it has no history at all.
 *
 * **No fixture name, value or grade here is an approved SAM technical claim.**
 *
 * This calls the section component directly rather than the shared `ProductDetailTemplate`,
 * because the point of this preview is the Specifications section specifically; a full template
 * mount would repeat the same hero/gallery/CTA chrome three times for no comparative value.
 *
 * ── Why the locale set is a literal, unlike the sibling proof pages ─────────
 *
 * `design-proof/page.tsx` and its siblings call `getActiveLocales()` because their whole point is
 * exercising the real experience end to end, locale switcher included. This page's point is the
 * data contract, and it should remain reviewable even with `apps/api` not running — so the three
 * Phase 1 locales are written out here, matching `Locale` table's seeded values exactly
 * (`INTERNATIONALIZATION_STRATEGY.md §1`) rather than fetched.
 *
 * ── Why this is gated by hand rather than through `proof-routes.ts` ─────────
 *
 * `gateProofRouteForProduction` redirects to a canonical target this route does not have — it is
 * not a duplicate of any real page, the way the six Family proof routes or `design-proof/about-us`
 * are. `gateCmsProofRouteForProduction` is the right shape (404, no target) but is written
 * specifically for `cms-proof`. Rather than widen a carefully curated, single-purpose file for one
 * temporary preview route, the same two-line gate is inlined here, using the same exported
 * `isProductionRuntime` check every other gate in that file is built on.
 */
const PREVIEW_LOCALES: readonly LocaleResponse[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl", isDefault: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl", isDefault: false },
];

export const metadata: Metadata = {
  title: "Structured Specifications Preview — Sam Group (internal)",
  robots: { index: false, follow: false },
};

/**
 * `SAM Diesel Engine Oil CI-4/SL 15W-40` (fixture, not an approved product record). Six rows,
 * six distinct value shapes:
 *
 * 1. `flash-1`  — a single TYPICAL reading (`valueType: "point"`)
 * 2. `flash-2`  — a MINIMUM limit (`valueType: "minimum"`, no `numericMax`)
 * 3. `pour-1`   — a MAXIMUM limit (`valueType: "maximum"`, no `numericMin`)
 * 4. `kv40-1`   — a bounded RANGE carrying a test CONDITION (`qualifier`)
 * 5. `bn-1`     — repeats the Grade badge on a MEASURED reading
 * 6. `ash-1`    — a legacy, unnormalized row: no `displayValue`, no `method`, no `qualifier`, no
 *    `valueType`, `resultBasis` at its column default — exactly what every row imported before
 *    ADR-014 looks like today.
 */
const ENGINE_OIL_SPECS: readonly ProductSpecificationResponse[] = [
  {
    id: "flash-1",
    key: "Flash point, COC",
    value: "225",
    unit: "°C",
    method: "ASTM D92",
    qualifier: null,
    resultBasis: "typical",
    valueType: "point",
    numericMin: "225",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: { label: "15W-40", gradeSystem: "sae" },
  },
  {
    id: "flash-2",
    key: "Flash point, minimum",
    value: "≥ 200 °C",
    unit: null,
    method: "ASTM D92",
    qualifier: null,
    resultBasis: "specification_limit",
    valueType: "minimum",
    numericMin: "200",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: { label: "15W-40", gradeSystem: "sae" },
  },
  {
    id: "pour-1",
    key: "Pour point",
    value: "≤ −33 °C",
    unit: null,
    method: "ASTM D6892",
    qualifier: null,
    resultBasis: "specification_limit",
    valueType: "maximum",
    numericMin: null,
    numericMax: "-33",
    pairFirst: null,
    pairSecond: null,
    grade: { label: "15W-40", gradeSystem: "sae" },
  },
  {
    id: "kv40-1",
    key: "Kinematic viscosity, 40 °C",
    value: "28.8 – 33.5 mm²/s",
    unit: null,
    method: "ASTM D445",
    qualifier: "After shear, 30 cycles (ASTM D6278)",
    resultBasis: "specification_limit",
    valueType: "range",
    numericMin: "28.8",
    numericMax: "33.5",
    pairFirst: null,
    pairSecond: null,
    grade: { label: "15W-40", gradeSystem: "sae" },
  },
  {
    id: "bn-1",
    key: "Base number",
    value: "10.9",
    unit: "mg KOH/g",
    method: "ASTM D2896",
    qualifier: null,
    resultBasis: "measured",
    valueType: "point",
    numericMin: "10.9",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: { label: "15W-40", gradeSystem: "sae" },
  },
  {
    id: "ash-1",
    key: "Sulfated ash",
    value: "1.0",
    unit: "mass %",
    method: null,
    qualifier: null,
    resultBasis: "unspecified",
    valueType: null,
    numericMin: null,
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: null,
  },
];

/**
 * The current, single approved fact on `SAM Grease Based on Calcium NLGI 2` — the low dropping
 * point (98 °C) matches this session's terminology-audit finding that the captured source
 * measures a **hydrated** calcium grease, not an anhydrous one (anhydrous types hold past 140 °C).
 *
 * Internally, an EARLIER captured dropping-point reading for this product was superseded by this
 * corrected one before either was reviewed — `SpecificationEvidence`'s `SUPERSEDED` role and
 * ADR-014 §6's immutable `SourceFact` history record that fact, permanently, in `sam_platform`.
 * **Neither the superseded value nor the fact that a supersession ever happened is a field this
 * API can return** — `v_specification_public` carries no history, no evidence link and no
 * `SourceDocument` identity by design (ADR-014 §6/§8), so the row below is indistinguishable from
 * a property with no history at all. That is the correct, deliberate behaviour, not something
 * this preview can demonstrate any more directly than by stating it here.
 */
const SUPERSEDED_REVISION_SPECS: readonly ProductSpecificationResponse[] = [
  {
    id: "preview-gr-1",
    key: "Dropping point",
    value: "98",
    unit: "°C",
    method: "ASTM D566",
    qualifier: null,
    resultBasis: "measured",
    valueType: "point",
    numericMin: "98",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: { label: "NLGI 2", gradeSystem: "nlgi" },
  },
  {
    id: "preview-gr-2",
    key: "Worked penetration",
    value: "280",
    unit: "0.1 mm",
    method: "ASTM D217",
    qualifier: null,
    resultBasis: "typical",
    valueType: "point",
    numericMin: "280",
    numericMax: null,
    pairFirst: null,
    pairSecond: null,
    grade: { label: "NLGI 2", gradeSystem: "nlgi" },
  },
];

function PreviewScenario({
  index,
  title,
  note,
  children,
}: {
  readonly index: number;
  readonly title: string;
  readonly note: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section
      style={{
        borderBlockStart: "1px dashed var(--color-border-hairline)",
        paddingBlockStart: "32px",
        marginBlockStart: index === 1 ? "0" : "48px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-technical)",
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-secondary)",
          margin: "0 0 6px",
        }}
      >
        Preview scenario {index} — not a real product page
      </p>
      {/*
       * A styled label, not a heading: the real `ProductSpecifications` mounted below already
       * contributes its own "Published values" <h2> (`fs-d2`), which is the correct level for it
       * on a real Product Detail page. Giving this annotation its own heading would nest an <h2>
       * inside an <h2> only because this proof page stacks three instances on one document — a
       * document-outline defect this page's own stacking creates and this page's own markup
       * should not introduce.
       */}
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
          margin: "0 0 8px",
          color: "var(--color-text-primary)",
        }}
      >
        {title}
      </p>
      <p style={{ maxWidth: "62ch", color: "var(--color-text-secondary)", marginBlockEnd: "20px" }}>
        {note}
      </p>
      {children}
    </section>
  );
}

export default function TechnicalDataPreviewPage(): ReactNode {
  if (isProductionRuntime()) notFound();

  return (
    <div data-brand="flagship">
      <SiteNav locale="en" locales={PREVIEW_LOCALES} />

      <main id="main-content" style={{ paddingBlock: "48px" }}>
        <div className="fs-wrap">
          <p
            style={{
              fontFamily: "var(--font-technical)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-secondary)",
              margin: "0 0 10px",
            }}
          >
            Internal — development preview, not indexed, not a real product
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "30px", margin: "0 0 12px" }}>
            Specifications — structured value coverage
          </h1>
          <p style={{ maxWidth: "68ch", color: "var(--color-text-secondary)" }}>
            Every table and card list below is the real{" "}
            <code style={{ fontFamily: "var(--font-technical)" }}>ProductSpecifications</code>{" "}
            component, fed fixture data instead of a live API response. No network call, database
            row, or approval was involved in producing this page. Resize the pane, or view at 768px
            or narrower, to see the accessible card records this same component renders in place of
            the table.
          </p>

          <PreviewScenario
            index={1}
            title="Full structured profile — six value shapes, one product"
            note="SAM Diesel Engine Oil CI-4/SL 15W-40 (fixture). Covers a typical single value, a minimum limit, a maximum limit, a bounded range carrying a test condition, a grade-specific reading, and one legacy row with none of the ADR-014 columns set — the same shape every specification imported before this gate carries today."
          >
            <ProductSpecifications specifications={ENGINE_OIL_SPECS} />
          </PreviewScenario>

          <PreviewScenario
            index={2}
            title="Incomplete product — zero published specifications"
            note="SAM Turbine Oil ISO VG 46 (fixture, awaiting technical review). Called with an empty array exactly as product-detail-template.tsx now calls it unconditionally — the component itself draws the 'Technical data is under review' state below, not this preview page."
          >
            <ProductSpecifications specifications={[]} />
          </PreviewScenario>

          <PreviewScenario
            index={3}
            title="Superseded technical revision — history stays private"
            note="SAM Grease Based on Calcium NLGI 2 (fixture). See the comment on SUPERSEDED_REVISION_SPECS in this file's source for what happened internally to this product's dropping-point reading before it reached this row — nothing below can show it, which is exactly ADR-014 §6's public revision boundary working as designed."
          >
            <ProductSpecifications specifications={SUPERSEDED_REVISION_SPECS} />
          </PreviewScenario>
        </div>
      </main>

      <SiteFooter locale="en" />
    </div>
  );
}
