import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every proof route's production behaviour, asserted through the page modules themselves.
 *
 * `features/site/proof-routes.spec.ts` proves the mapping. This proves the wiring — that each page
 * calls its gate, that it calls it **before** any upstream request, and that development is
 * untouched. The two halves matter separately: a correct table nobody calls is exactly the failure
 * this pair is here to catch.
 *
 * The "before any upstream request" assertion is the one carrying real weight. It is what makes
 * "no proof form reaches a production visitor" and "no API call is made for a request that is
 * going to be redirected" testable facts rather than intentions — a gate placed after the fetch
 * would still redirect, and would still be wrong.
 *
 * ── Why every page is imported statically ───────────────────────────────────
 *
 * These suites move `NODE_ENV`, and the JSX transform reads it at **transform** time to choose
 * between `react/jsx-runtime` and `react/jsx-dev-runtime`. A page imported dynamically from inside
 * a test that has already stubbed `NODE_ENV=development` is compiled against the dev runtime this
 * runner does not load, and fails with `jsxDEV is not a function` — a transform artefact that says
 * nothing about the code under test. Importing at module scope compiles everything once, under the
 * runner's own environment, before any stub is in place. The gate reads `NODE_ENV` when it is
 * *called*, so the stubs still do exactly what these tests need.
 */

class RedirectSignal extends Error {
  constructor(readonly target: string) {
    super(`redirect(${target})`);
    this.name = "RedirectSignal";
  }
}

class NotFoundSignal extends Error {
  constructor() {
    super("notFound()");
    this.name = "NotFoundSignal";
  }
}

vi.mock("next/navigation", () => ({
  redirect: (target: string): never => {
    throw new RedirectSignal(target);
  },
  notFound: (): never => {
    throw new NotFoundSignal();
  },
}));

const getActiveLocales = vi.fn(async () => [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
]);

vi.mock("@/lib/locales", () => ({
  getActiveLocales: (): unknown => getActiveLocales(),
}));

const contentFetch = vi.fn(async () => ({ ok: false, reason: "not-configured" }) as const);

vi.mock("@/lib/content", () => ({
  getAboutUsContent: (): unknown => contentFetch(),
  getCustomizedSolutionsContent: (): unknown => contentFetch(),
  getQualityCertificationsContent: (): unknown => contentFetch(),
  getContentPage: (): unknown => contentFetch(),
}));

import CmsProofPage, { generateMetadata } from "../[locale]/cms-proof/[slug]/page";
import AboutUsProofPage from "./about-us/page";
import CustomizedSolutionsProofPage from "./customized-solutions/page";
import HomeProofPage from "./page";
import AntifreezeCoolantsProofPage from "./products/antifreeze-coolants/page";
import BaseOilsProofPage from "./products/base-oils/page";
import EngineOilsProofPage from "./products/engine-oils-automotive-lubricants/page";
import IndustrialOilsProofPage from "./products/industrial-oils-lubricants/page";
import LubricantAdditivesProofPage from "./products/lubricant-additives/page";
import MarineOilsProofPage from "./products/marine-oils-lubricants/page";
import ProductsProofPage from "./products/page";
import TechnicalDataPreviewPage from "./products/technical-data-preview/page";
import QualityCertificationsProofPage from "./quality-certifications/page";

/** The five gated routes: the page, and the canonical URL production must send it to. */
const DESIGN_PROOF_ROUTES = [
  ["/design-proof", HomeProofPage, "/en"],
  ["/design-proof/about-us", AboutUsProofPage, "/en/about-us"],
  ["/design-proof/products", ProductsProofPage, "/en/products"],
  ["/design-proof/customized-solutions", CustomizedSolutionsProofPage, "/en/customized-solutions"],
  [
    "/design-proof/quality-certifications",
    QualityCertificationsProofPage,
    "/en/quality-certifications",
  ],
] as const;

beforeEach(() => {
  getActiveLocales.mockClear();
  contentFetch.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("design-proof routes in production", () => {
  it.each(DESIGN_PROOF_ROUTES)(
    "%s redirects to its canonical route",
    async (_route, Page, target) => {
      vi.stubEnv("NODE_ENV", "production");

      await expect(Page()).rejects.toThrow(RedirectSignal);
      await expect(Page()).rejects.toMatchObject({ target });
    },
  );

  it.each(DESIGN_PROOF_ROUTES)("%s reaches no API before redirecting", async (_route, Page) => {
    vi.stubEnv("NODE_ENV", "production");

    await Page().catch(() => undefined);

    expect(getActiveLocales).not.toHaveBeenCalled();
    expect(contentFetch).not.toHaveBeenCalled();
  });
});

describe("design-proof routes in development", () => {
  it.each(DESIGN_PROOF_ROUTES)("%s still renders rather than redirecting", async (_route, Page) => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(Page()).resolves.toBeDefined();
    expect(getActiveLocales).toHaveBeenCalled();
  });
});

describe("the CMS proof route", () => {
  const params = (): Promise<{ locale: string; slug: string }> =>
    Promise.resolve({ locale: "en", slug: "privacy-policy" });

  it("answers 404 in production, before reaching the API", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(CmsProofPage({ params: params() })).rejects.toThrow(NotFoundSignal);
    expect(getActiveLocales).not.toHaveBeenCalled();
    expect(contentFetch).not.toHaveBeenCalled();
  });

  it("describes nothing in production, so generateMetadata issues no request", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(generateMetadata({ params: params() })).resolves.toEqual({});
    expect(contentFetch).not.toHaveBeenCalled();
  });

  it("still renders in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(CmsProofPage({ params: params() })).resolves.toBeDefined();
    expect(getActiveLocales).toHaveBeenCalled();
  });
});

describe("the technical-data-preview route", () => {
  /*
   * No canonical target exists for this route — it is not a duplicate of any real page, unlike
   * every route above. So it is 404-gated like `cms-proof`, not redirect-gated like the five
   * `PROOF_CANONICAL_TARGETS` routes, and its gate is `isProductionRuntime()` called by hand in
   * the page itself rather than a shared `gateProofRouteForProduction` entry (see the page's own
   * header comment for why widening that shared table was rejected).
   */
  it("answers 404 in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => TechnicalDataPreviewPage()).toThrow(NotFoundSignal);
    expect(() => TechnicalDataPreviewPage()).not.toThrow(RedirectSignal);
  });

  it.each(["development", "test"])("still renders in %s, reaching no API", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);

    expect(() => TechnicalDataPreviewPage()).not.toThrow();
    // The page's own fixtures are the point — it calls neither of the two upstream reads every
    // other proof route above depends on.
    expect(getActiveLocales).not.toHaveBeenCalled();
    expect(contentFetch).not.toHaveBeenCalled();
  });
});

describe("the six Product Family proof routes", () => {
  const FAMILY_ROUTES = [
    ["base-oils", BaseOilsProofPage],
    ["lubricant-additives", LubricantAdditivesProofPage],
    ["engine-oils-automotive-lubricants", EngineOilsProofPage],
    ["industrial-oils-lubricants", IndustrialOilsProofPage],
    ["marine-oils-lubricants", MarineOilsProofPage],
    ["antifreeze-coolants", AntifreezeCoolantsProofPage],
  ] as const;

  /*
   * These were already redirecting before this gate existed and were explicitly left alone, so
   * they redirect in every environment rather than only in production. Asserted in BOTH, because
   * "preserved unchanged" is the requirement — the risk being guarded against is a later tidy-up
   * that folds them into the conditional gate and quietly makes them reachable in development.
   */
  it.each(FAMILY_ROUTES)("%s redirects unconditionally in production", (slug, Page) => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => Page()).toThrow(RedirectSignal);
    expect(() => Page()).toThrow(`/en/products/${slug}`);
  });

  it.each(FAMILY_ROUTES)("%s redirects unconditionally in development too", (slug, Page) => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() => Page()).toThrow(RedirectSignal);
    expect(() => Page()).toThrow(`/en/products/${slug}`);
  });
});
