import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROOF_CANONICAL_TARGETS,
  gateCmsProofRouteForProduction,
  gateProofRouteForProduction,
  isProductionRuntime,
} from "./proof-routes";

/**
 * The proof-route production gate — owner decision, 2 September 2026.
 *
 * These assert the **mapping and the environment split**, which is the part that can be wrong
 * silently. `redirect()` and `notFound()` are Next's and are stubbed: what matters here is that the
 * gate calls them in production, does not call them in development, and hands `redirect()` the
 * right canonical URL for each route.
 *
 * The companion suite, `app/design-proof/proof-route-gate.spec.tsx`, asserts the other half — that
 * each page actually invokes its gate, and does so before it touches the API.
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isProductionRuntime", () => {
  it.each([
    ["production", true],
    ["development", false],
    ["test", false],
    [undefined, false],
  ])("reads NODE_ENV=%s as production=%s", (nodeEnv, expected) => {
    expect(isProductionRuntime(nodeEnv)).toBe(expected);
  });
});

/**
 * The approved table, restated here as data rather than imported from the module under test, so a
 * silent edit to a target is a failing test rather than a test that agrees with itself.
 */
const APPROVED_MAPPING = [
  ["/design-proof", "/en"],
  ["/design-proof/about-us", "/en/about-us"],
  ["/design-proof/products", "/en/products"],
  ["/design-proof/customized-solutions", "/en/customized-solutions"],
  ["/design-proof/quality-certifications", "/en/quality-certifications"],
] as const;

describe("the design-proof canonical mapping", () => {
  it("covers exactly the five approved routes and no others", () => {
    expect(Object.keys(PROOF_CANONICAL_TARGETS).sort()).toEqual(
      APPROVED_MAPPING.map(([route]) => route).sort(),
    );
  });

  it.each(APPROVED_MAPPING)("maps %s to %s", (route, target) => {
    expect(PROOF_CANONICAL_TARGETS[route]).toBe(target);
  });

  it("targets the default-locale canonical URL, never a locale-less path", () => {
    for (const target of Object.values(PROOF_CANONICAL_TARGETS)) {
      expect(target).toMatch(/^\/en(\/|$)/);
    }
  });

  /*
   * The six Product Family proof routes redirect unconditionally from their own files and were
   * explicitly left alone. If one is ever added here it would start answering differently in
   * development, which is a behaviour change nobody asked for.
   */
  it("does not govern the six Product Family proof routes", () => {
    for (const route of Object.keys(PROOF_CANONICAL_TARGETS)) {
      expect(route).not.toMatch(/^\/design-proof\/products\/./);
    }
  });
});

describe("gateProofRouteForProduction", () => {
  describe("in production", () => {
    it.each(APPROVED_MAPPING)("redirects %s to %s", (route, target) => {
      vi.stubEnv("NODE_ENV", "production");

      expect(() => gateProofRouteForProduction(route)).toThrow(RedirectSignal);

      try {
        gateProofRouteForProduction(route);
      } catch (error) {
        expect((error as RedirectSignal).target).toBe(target);
      }
    });
  });

  describe("in development", () => {
    it.each(APPROVED_MAPPING)("leaves %s reachable", (route) => {
      vi.stubEnv("NODE_ENV", "development");

      expect(() => gateProofRouteForProduction(route)).not.toThrow();
    });
  });

  describe("under test", () => {
    it.each(APPROVED_MAPPING)("leaves %s reachable", (route) => {
      vi.stubEnv("NODE_ENV", "test");

      expect(() => gateProofRouteForProduction(route)).not.toThrow();
    });
  });
});

describe("gateCmsProofRouteForProduction", () => {
  /*
   * 404 and not a redirect, and this is the assertion that has to hold: the canonical counterparts
   * of `cms-proof` are the legal pages, none of which is published, so there is nowhere to send a
   * reader. A future edit that "helpfully" turns this into a redirect would point one 404 at
   * another, or publish CMS content as though it were policy.
   */
  it("answers 404 in production, and never redirects", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => gateCmsProofRouteForProduction()).toThrow(NotFoundSignal);
    expect(() => gateCmsProofRouteForProduction()).not.toThrow(RedirectSignal);
  });

  it.each(["development", "test"])("leaves the route reachable in %s", (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);

    expect(() => gateCmsProofRouteForProduction()).not.toThrow();
  });
});
