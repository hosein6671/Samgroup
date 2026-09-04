import { afterEach, describe, expect, it } from "vitest";

import robots from "./robots";

/**
 * `/robots.txt`, in both of its states.
 *
 * The property worth protecting is not the file's contents but its agreement with the pages:
 * `robots.ts` and the locale layout read one switch, so a `robots.txt` that invites a crawl while
 * every page answers `noindex` is unreachable by construction. `indexing.spec.ts` asserts the
 * switch; this asserts what this file does with it.
 */

const ORIGINAL_INDEXING = process.env.SITE_SEO_INDEXING;
const ORIGINAL_ORIGIN = process.env.SITE_PUBLIC_URL;

afterEach(() => {
  if (ORIGINAL_INDEXING === undefined) delete process.env.SITE_SEO_INDEXING;
  else process.env.SITE_SEO_INDEXING = ORIGINAL_INDEXING;

  if (ORIGINAL_ORIGIN === undefined) delete process.env.SITE_PUBLIC_URL;
  else process.env.SITE_PUBLIC_URL = ORIGINAL_ORIGIN;
});

/** The rules array, normalised to one entry — this file emits exactly one rule in each state. */
function onlyRule(): { userAgent?: unknown; allow?: unknown; disallow?: unknown } {
  const { rules } = robots();
  const list = Array.isArray(rules) ? rules : [rules];

  expect(list).toHaveLength(1);

  return list[0] as { userAgent?: unknown; allow?: unknown; disallow?: unknown };
}

describe("with the launch gate closed — every environment today", () => {
  it("disallows the whole site", () => {
    delete process.env.SITE_SEO_INDEXING;

    const rule = onlyRule();

    expect(rule.userAgent).toBe("*");
    expect(rule.disallow).toBe("/");
    // No `allow` beside a blanket disallow: it would imply the rest of the site is permitted.
    expect(rule.allow).toBeUndefined();
  });

  it("still names the sitemap, so the URL is correct on the day the gate opens", () => {
    delete process.env.SITE_SEO_INDEXING;

    expect(robots().sitemap).toBe("https://samgp.com/sitemap.xml");
  });
});

describe("with the launch gate open", () => {
  it("allows the site and keeps the non-public surfaces out", () => {
    process.env.SITE_SEO_INDEXING = "true";

    const rule = onlyRule();

    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/admin/", "/api/", "/design-proof/", "/*/cms-proof/"]);
  });

  /**
   * Each of the four is a surface that must never be indexed for its own reason: an authenticated
   * staff area, a server API, a proof tree scheduled for removal, and a route that renders content
   * the repository itself labels NON-AUTHORITATIVE.
   */
  it.each(["/admin/", "/api/", "/design-proof/", "/*/cms-proof/"])(
    "keeps %s disallowed",
    (path) => {
      process.env.SITE_SEO_INDEXING = "true";

      expect(onlyRule().disallow).toContain(path);
    },
  );
});

describe("the origin", () => {
  it("comes from the configured base URL in both the sitemap line and the host line", () => {
    process.env.SITE_PUBLIC_URL = "https://staging.example.test";

    const result = robots();

    expect(result.sitemap).toBe("https://staging.example.test/sitemap.xml");
    expect(result.host).toBe("https://staging.example.test");
  });

  it("never emits a development origin", () => {
    delete process.env.SITE_PUBLIC_URL;

    const serialised = JSON.stringify(robots());

    expect(serialised).not.toContain("localhost");
    expect(serialised).not.toContain("127.0.0.1");
  });
});
