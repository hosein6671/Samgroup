import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES, ACTIVE_LOCALE_CODES } from "@test/active-locales";

import {
  FOOTER_COLUMNS,
  PRIMARY_NAV,
  PRODUCT_CATEGORIES,
  ROUTES,
  contentRouteHref,
  footerColumnsFor,
  isNavHrefActive,
  localeChoices,
  localeHref,
  primaryNavLinks,
  productFamilyLinks,
  structuralPathOf,
  switchLocaleHref,
} from "./site-routes";

/**
 * NAV-1 — the routing half, exhaustively.
 *
 * ## Why the header's own markup is not rendered here
 *
 * `apps/web`'s runner is `environment: "node"` with no jsdom and no React Testing Library, and this
 * gate may not add a dependency. `SiteNav` is a Client Component built on `useState`, `useEffect`,
 * `useId`, `usePathname` and `useSearchParams`; calling it outside a renderer throws, and
 * `@test/element-tree` drops a component that throws — so a spec that "rendered" it would pass
 * while asserting nothing at all. That is the trap this file is written to avoid.
 *
 * So the header's addresses are tested where they are actually decided: `primaryNavLinks`,
 * `productFamilyLinks`, `localeHref` and `localeChoices` are the model the component maps over, and
 * they are covered here for all three locales. What the component could still get wrong — using a
 * raw `ROUTES` constant instead of the model — is a narrow architectural invariant that cannot be
 * observed through rendering in this runner, and is asserted against the source at the end.
 *
 * `SiteFooter` is a Server Component with no hooks and is genuinely rendered, in
 * `site-footer.spec.tsx`.
 */

const OTHER_LOCALES = ["fa", "ar"] as const;

/* ====================================================== the resolver itself */

describe("localeHref", () => {
  it("prefixes an internal structural path, once, in every active locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(localeHref(code, ROUTES.aboutUs)).toBe(`/${code}/about-us`);
      expect(localeHref(code, ROUTES.products)).toBe(`/${code}/products`);
      expect(localeHref(code, ROUTES.contactUs)).toBe(`/${code}/contact-us`);
    }
  });

  it("turns the home route into `/{locale}`, never `/{locale}/`", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(localeHref(code, ROUTES.home)).toBe(`/${code}`);
    }
  });

  it("is idempotent — a path already in this locale is returned untouched", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const once = localeHref(code, ROUTES.products);

      expect(localeHref(code, once)).toBe(once);
      expect(localeHref(code, localeHref(code, localeHref(code, ROUTES.home)))).toBe(`/${code}`);
    }
  });

  it("keeps a query string and a fragment", () => {
    expect(localeHref("fa", "/products#documentation")).toBe("/fa/products#documentation");
    expect(localeHref("ar", "/products/finder?segment=marine")).toBe(
      "/ar/products/finder?segment=marine",
    );
    expect(localeHref("fa", "/products/finder?segment=marine#results")).toBe(
      "/fa/products/finder?segment=marine#results",
    );
  });

  it("does not mistake a fragment or a query for the locale segment", () => {
    // `/en?x=1` and `/en#a` are already the English home; prefixing again would double it.
    expect(localeHref("en", "/en?x=1")).toBe("/en?x=1");
    expect(localeHref("en", "/en#a")).toBe("/en#a");
  });

  it("leaves external and non-path addresses alone", () => {
    for (const address of [
      "https://example.com/x",
      "http://example.com",
      "//cdn.example.com/a.png",
      "mailto:someone@example.com",
      "tel:+100",
      "#custom-request",
    ]) {
      expect(localeHref("fa", address)).toBe(address);
    }
  });

  it("never produces a design-proof or cms-proof URL", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      for (const item of [...PRIMARY_NAV, ...PRODUCT_CATEGORIES]) {
        expect(localeHref(code, item.href)).not.toContain("design-proof");
        expect(localeHref(code, item.href)).not.toContain("cms-proof");
      }
    }
  });
});

/* =============================================== 1 · every header link, prefixed */

describe("header addresses", () => {
  it("locale-prefixes every primary navigation destination, in every locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const links = primaryNavLinks(code, "/");

      expect(links).toHaveLength(PRIMARY_NAV.length);

      for (const link of links) {
        expect(link.href.startsWith(`/${code}`)).toBe(true);
        expect(link.href.startsWith(`/${code}/${code}`)).toBe(false);
      }
    }
  });

  it("locale-prefixes every Product Family destination, in every locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const families = productFamilyLinks(code);

      expect(families).toHaveLength(6);

      for (const family of families) {
        expect(family.href).toBe(`/${code}/products/${family.key}`);
      }
    }
  });

  it("keeps the family labels and keys exactly as the canonical table publishes them", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(productFamilyLinks(code).map((f) => [f.key, f.label])).toEqual(
        PRODUCT_CATEGORIES.map((f) => [f.key, f.label]),
      );
    }
  });

  it("preserves the locale on the logo, the Finder, Products and Request a Quote", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(localeHref(code, ROUTES.home)).toBe(`/${code}`);
      expect(localeHref(code, ROUTES.productFinder)).toBe(`/${code}/products/finder`);
      expect(localeHref(code, ROUTES.products)).toBe(`/${code}/products`);
      expect(localeHref(code, ROUTES.requestQuote)).toBe(`/${code}/contact-us/request-a-quote`);
    }
  });

  it("points the documentation target at the locale's Products page plus the real fragment", () => {
    // `id="documentation"` exists on the Products landing page — this is a page plus a fragment,
    // never a bare `#documentation` and never a route of its own.
    expect(ROUTES.documentation).toBe("/products#documentation");

    for (const code of ACTIVE_LOCALE_CODES) {
      expect(localeHref(code, ROUTES.documentation)).toBe(`/${code}/products#documentation`);
    }
  });

  it("points a custom-request target at the locale's Customized Solutions page plus #custom-request", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(localeHref(code, `${ROUTES.customizedSolutions}#custom-request`)).toBe(
        `/${code}/customized-solutions#custom-request`,
      );
    }
  });
});

/* ================================================ 2 · every footer link, prefixed */

describe("footer addresses", () => {
  it("locale-prefixes every column link, in every locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      for (const column of footerColumnsFor(code)) {
        for (const link of column.links) {
          expect(link.href.startsWith(`/${code}/`)).toBe(true);
          expect(link.href.startsWith(`/${code}/${code}/`)).toBe(false);
        }
      }
    }
  });

  it("carries no dead `#products` anchor — the Products column is the six canonical families", () => {
    const products = FOOTER_COLUMNS.find((column) => column.heading === "Products");

    expect(products).toBeDefined();
    expect(products?.links.map((link) => link.href)).toEqual(
      PRODUCT_CATEGORIES.map((family) => family.href),
    );

    for (const column of FOOTER_COLUMNS) {
      for (const link of column.links) {
        expect(link.href.startsWith("#")).toBe(false);
      }
    }
  });
});

/* ===================================================== 3 · the language switcher */

describe("switchLocaleHref", () => {
  it("replaces only the leading locale segment and keeps the structural path", () => {
    for (const target of OTHER_LOCALES) {
      expect(switchLocaleHref("/en/quality-certifications", "", target, ACTIVE_LOCALE_CODES)).toBe(
        `/${target}/quality-certifications`,
      );
      expect(switchLocaleHref("/en/products/base-oils", "", target, ACTIVE_LOCALE_CODES)).toBe(
        `/${target}/products/base-oils`,
      );
      expect(
        switchLocaleHref("/en/contact-us/request-a-quote", "", target, ACTIVE_LOCALE_CODES),
      ).toBe(`/${target}/contact-us/request-a-quote`);
    }
  });

  it("does not touch a later segment that happens to be a locale code", () => {
    expect(switchLocaleHref("/en/products/ar", "", "fa", ACTIVE_LOCALE_CODES)).toBe(
      "/fa/products/ar",
    );
  });

  it("maps a locale home to the target's home", () => {
    expect(switchLocaleHref("/en", "", "ar", ACTIVE_LOCALE_CODES)).toBe("/ar");
  });

  it("preserves query parameters, with or without a leading `?`", () => {
    expect(
      switchLocaleHref("/en/products/finder", "segment=marine&page=2", "fa", ACTIVE_LOCALE_CODES),
    ).toBe("/fa/products/finder?segment=marine&page=2");
    expect(
      switchLocaleHref("/en/products/finder", "?segment=marine", "fa", ACTIVE_LOCALE_CODES),
    ).toBe("/fa/products/finder?segment=marine");
    expect(switchLocaleHref("/en/products/finder", "", "fa", ACTIVE_LOCALE_CODES)).toBe(
      "/fa/products/finder",
    );
  });

  it("preserves a fragment, and orders query before fragment", () => {
    expect(switchLocaleHref("/en/products#documentation", "", "ar", ACTIVE_LOCALE_CODES)).toBe(
      "/ar/products#documentation",
    );
    expect(switchLocaleHref("/en/products#documentation", "a=1", "ar", ACTIVE_LOCALE_CODES)).toBe(
      "/ar/products?a=1#documentation",
    );
  });

  it("falls back to the locale home — and to nothing route-specific — off the locale tree", () => {
    // The proof tree has no locale-addressed equivalent; inventing one would invent a route.
    expect(switchLocaleHref("/design-proof/products", "", "fa", ACTIVE_LOCALE_CODES)).toBe("/fa");
    expect(switchLocaleHref("/design-proof/products", "x=1", "fa", ACTIVE_LOCALE_CODES)).toBe(
      "/fa",
    );
  });
});

describe("localeChoices", () => {
  const PATH = "/en/products/finder";
  const SEARCH = "segment=marine";

  it("offers exactly the active locales, in the order the endpoint served them", () => {
    expect(localeChoices(ACTIVE_LOCALES, "en", PATH, SEARCH).map((c) => c.code)).toEqual([
      "en",
      "fa",
      "ar",
    ]);
  });

  it("offers nothing the active set does not contain", () => {
    const single = localeChoices([ACTIVE_LOCALES[0]!], "en", PATH, "");

    expect(single).toHaveLength(1);
    expect(single[0]?.code).toBe("en");
  });

  it("takes its labels and direction from the endpoint record, not from a code", () => {
    const choices = localeChoices(ACTIVE_LOCALES, "en", PATH, SEARCH);

    expect(choices.map((c) => c.nativeName)).toEqual(ACTIVE_LOCALES.map((l) => l.nativeName));
    expect(choices.map((c) => c.direction)).toEqual(ACTIVE_LOCALES.map((l) => l.direction));
  });

  it("marks the current locale, and only the current locale", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      const current = localeChoices(ACTIVE_LOCALES, code, PATH, SEARCH).filter((c) => c.current);

      expect(current).toHaveLength(1);
      expect(current[0]?.code).toBe(code);
    }
  });

  it("keeps the path and the query on every entry", () => {
    for (const choice of localeChoices(ACTIVE_LOCALES, "en", PATH, SEARCH)) {
      expect(choice.href).toBe(`/${choice.code}/products/finder?segment=marine`);
    }
  });
});

describe("localeChoices — fragment preservation", () => {
  /**
   * The hash is the one part of the address the framework cannot supply: it is never sent to the
   * server, so `usePathname()` and `useSearchParams()` both omit it. `LanguageMenu` reads it from
   * `window.location.hash` after hydration and passes it here; these cover what it does with it.
   */
  const hrefFor = (
    target: string,
    pathname: string,
    search: string,
    hash?: string,
  ): string | undefined =>
    localeChoices(ACTIVE_LOCALES, "fa", pathname, search, hash).find((c) => c.code === target)
      ?.href;

  it("carries a fragment across a locale switch", () => {
    expect(hrefFor("ar", "/fa/products", "", "#documentation")).toBe("/ar/products#documentation");
    expect(hrefFor("en", "/fa/products", "", "#documentation")).toBe("/en/products#documentation");
  });

  it("carries a query and a fragment together, query first", () => {
    expect(hrefFor("ar", "/fa/products/finder", "segment=marine", "#results")).toBe(
      "/ar/products/finder?segment=marine#results",
    );
    expect(hrefFor("en", "/fa/products/finder", "?segment=marine", "#results")).toBe(
      "/en/products/finder?segment=marine#results",
    );
  });

  it("keeps the fragment on every entry, including the current locale", () => {
    for (const choice of localeChoices(
      ACTIVE_LOCALES,
      "fa",
      "/fa/products",
      "",
      "#documentation",
    )) {
      expect(choice.href).toBe(`/${choice.code}/products#documentation`);
    }
  });

  it("emits no fragment when there is none — the server render and the first client render", () => {
    // The default is what runs before the effect has read `window`. It must not invent a fragment.
    expect(hrefFor("ar", "/fa/products", "")).toBe("/ar/products");
    expect(hrefFor("ar", "/fa/products", "", "")).toBe("/ar/products");
    // A bare `#` is what a browser reports for `…/products#` — an empty fragment, not a target.
    expect(hrefFor("ar", "/fa/products", "", "#")).toBe("/ar/products");
  });

  it("accepts a fragment given without its leading `#`", () => {
    expect(hrefFor("ar", "/fa/products", "", "documentation")).toBe("/ar/products#documentation");
  });

  it("does not let a fragment survive off the locale tree", () => {
    // No locale-addressed equivalent of a proof URL exists, so the target is the locale home and
    // carrying a fragment from a different document onto it would be meaningless.
    expect(hrefFor("ar", "/design-proof/products", "", "#documentation")).toBe("/ar");
  });
});

/* ========================================================= 4 · the active route */

describe("structuralPathOf", () => {
  it("strips a leading active locale segment", () => {
    expect(structuralPathOf("/fa/products/base-oils", ACTIVE_LOCALE_CODES)).toBe(
      "/products/base-oils",
    );
    expect(structuralPathOf("/ar", ACTIVE_LOCALE_CODES)).toBe("/");
  });

  it("leaves a pathname whose first segment is not an active locale exactly as it is", () => {
    expect(structuralPathOf("/design-proof/products", ACTIVE_LOCALE_CODES)).toBe(
      "/design-proof/products",
    );
    expect(structuralPathOf("/xx/products", ACTIVE_LOCALE_CODES)).toBe("/xx/products");
    expect(structuralPathOf("/", ACTIVE_LOCALE_CODES)).toBe("/");
  });
});

describe("isNavHrefActive", () => {
  const activeLabels = (structuralPath: string): string[] =>
    primaryNavLinks("fa", structuralPath)
      .filter((link) => link.current)
      .map((link) => link.label);

  it("marks the home item on the locale home, and nothing else", () => {
    expect(activeLabels("/")).toEqual(["Home Page"]);
  });

  it("marks exactly one item on each primary destination", () => {
    expect(activeLabels(ROUTES.aboutUs)).toEqual(["About Us"]);
    expect(activeLabels(ROUTES.products)).toEqual(["Products"]);
    expect(activeLabels(ROUTES.customizedSolutions)).toEqual(["Customized Solutions"]);
    expect(activeLabels(ROUTES.exportLogistics)).toEqual(["Export & Logistics"]);
    expect(activeLabels(ROUTES.contactUs)).toEqual(["Contact Us"]);
  });

  it("activates the Products parent for Family, Product Detail and Finder routes", () => {
    expect(activeLabels("/products/base-oils")).toEqual(["Products"]);
    expect(activeLabels("/products/some-published-grade")).toEqual(["Products"]);
    expect(activeLabels("/products/finder")).toEqual(["Products"]);
  });

  it("marks nothing on a route no primary item owns", () => {
    expect(activeLabels("/quality-certifications")).toEqual([]);
    expect(activeLabels("/insights")).toEqual([]);
    expect(activeLabels("/privacy-policy")).toEqual([]);
    expect(activeLabels("/design-proof/products")).toEqual([]);
  });

  it("does not let one item's path prefix another's — only Products descends", () => {
    // `/contact-us/request-a-quote` is its own destination, not "inside" Contact Us.
    expect(activeLabels("/contact-us/request-a-quote")).toEqual([]);
    // `/` is a prefix of everything and must never match by prefix.
    expect(isNavHrefActive("/products", ROUTES.home)).toBe(false);
    expect(isNavHrefActive("/products-elsewhere", ROUTES.products)).toBe(false);
  });
});

/* ==================================== 5 · the one prefix rule, and only one copy */

const sourceOf = (file: string): string =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

describe("architectural invariants", () => {
  it("routes CMS route keys through the same resolver rather than a second prefix rule", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(contentRouteHref(code, "products")).toBe(localeHref(code, ROUTES.products));
      expect(contentRouteHref(code, "contact-us")).toBe(localeHref(code, ROUTES.contactUs));
    }
  });

  it("no longer exports a static locale fixture from the routing module", async () => {
    const routes: Record<string, unknown> = await import("./site-routes");

    expect(Object.keys(routes)).not.toContain("LOCALES");

    // No locale code and no language name may be a literal in the routing module. `localeHref`
    // takes a code; it must never be able to source one.
    const source = sourceOf("./site-routes.ts");

    expect(source).not.toMatch(/["']فارسی["']|["']العربية["']/u);
    expect(source).not.toMatch(/code:\s*["'](?:en|fa|ar)["']/u);
  });

  it("keeps the switcher's routing authority off any static fixture", () => {
    const nav = sourceOf("./site-nav.tsx");

    // The only locale list the header may read is the `locales` prop, which the page supplies from
    // `GET /locales`. A re-introduced fixture would have to be imported or dereferenced — and the
    // hardcoded `useState("en")` that used to stand in for the current locale is gone.
    expect(nav).not.toMatch(/import \{[^}]*\bLOCALES\b/u);
    expect(nav).not.toMatch(/\bLOCALES\s*[.[]/u);
    expect(nav).not.toMatch(/const \[[^\]]+\] = useState\(\s*["']en["']\s*\)/u);
    expect(nav).not.toMatch(/["'](?:فارسی|العربية)["']/u);
  });

  it("emits no unprefixed route constant and no bare fragment from either chrome component", () => {
    for (const file of ["./site-nav.tsx", "./site-footer.tsx"]) {
      const source = sourceOf(file);

      // `href={ROUTES.x}` is the defect this gate removed: a locale-less structural path handed
      // straight to the browser for middleware to renegotiate.
      expect(source).not.toMatch(/href=\{ROUTES\./u);
      // `href="#top"` / `href="#products"` — fragments that resolve on one route and nowhere else.
      expect(source).not.toMatch(/href="#/u);
    }
  });

  it("writes the locale preference from the switcher's click handler and nowhere else", () => {
    const nav = sourceOf("./site-nav.tsx");
    const footer = sourceOf("./site-footer.tsx");

    // Ordinary navigation is `next/link` and touches no cookie. The only write is inside the
    // language links' `onClick`, so browsing the site can never persist a locale preference.
    expect(nav.match(/rememberLocale\(/gu)).toHaveLength(1);
    expect(nav).toMatch(/onClick=\{\(\) => \{[\s\S]{0,900}rememberLocale\(/u);
    expect(nav).not.toMatch(/document\.cookie/u);
    expect(footer).not.toMatch(/rememberLocale|document\.cookie|NEXT_LOCALE/u);

    // And nothing in the chrome goes near the Admin session cookies.
    for (const source of [nav, footer]) {
      expect(source).not.toMatch(/sam_admin_(?:access|refresh)/u);
    }
  });

  it("reads the fragment from the client, after hydration, and never during render", () => {
    const nav = sourceOf("./site-nav.tsx");

    // `window.location.hash` is browser state; reading it while rendering would make the first
    // client pass disagree with the server's. It is read inside an effect, held as React state, and
    // kept current by `hashchange` — and the initial value is the empty string the server rendered.
    expect(nav).toMatch(/const \[hash, setHash\] = useState\(""\)/u);
    expect(nav).toMatch(/useEffect\(\(\) => \{[\s\S]{0,400}window\.location\.hash/u);
    expect(nav).toMatch(/addEventListener\("hashchange", read\)/u);
    expect(nav).toMatch(/removeEventListener\("hashchange", read\)/u);
    expect(nav).toMatch(/localeChoices\(locales, locale, pathname, search, hash\)/u);

    // The only `window.location.hash` in the file is the one inside that effect.
    expect(nav.match(/window\.location\.hash/gu)).toHaveLength(1);
  });

  it("wires the drawer's dismissal paths to the focus-restoring close", () => {
    const nav = sourceOf("./site-nav.tsx");

    // Behaviour that needs a DOM to observe; its pieces are unit-tested in `nav-behaviour.spec.ts`
    // and this asserts the component actually calls them. Escape and the burger restore focus;
    // a route change closes without stealing it.
    expect(nav).toMatch(/if \(drawer\) closeDrawer\(\);/u);
    expect(nav).toMatch(/drawer \? closeDrawer\(\) : setDrawer\(true\)/u);
    expect(nav).toMatch(/burgerRef\.current\?\.focus\(\)/u);
    expect(nav).toMatch(/setDrawer\(false\);[\s\S]{0,200}\}, \[pathname\]\);/u);
    expect(nav).toMatch(/lockBackground\(header, document\.body\)/u);
    expect(nav).toMatch(/lockScroll\(document\.documentElement\)/u);
  });
});
