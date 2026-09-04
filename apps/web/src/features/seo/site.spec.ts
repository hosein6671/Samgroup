import { afterEach, describe, expect, it } from "vitest";

import {
  ORGANIZATION_NAME,
  absoluteUrl,
  organizationId,
  siteOrigin,
  siteUrl,
  webSiteId,
} from "./site";

/**
 * The public origin — the value eleven files used to each hold a copy of.
 *
 * These assertions are about one property above all: every absolute URL the platform emits — the
 * canonical tag, the sitemap entry, the JSON-LD `@id`, the Open Graph `url` — is derived from this
 * one function, so they cannot disagree with each other. A test that a canonical is correct is not
 * worth much; a test that the canonical and the `@id` are built from the same origin is.
 */

const ORIGINAL = process.env.SITE_PUBLIC_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SITE_PUBLIC_URL;
  else process.env.SITE_PUBLIC_URL = ORIGINAL;
});

describe("the public origin", () => {
  it("is the frozen public domain when nothing is configured", () => {
    delete process.env.SITE_PUBLIC_URL;

    expect(siteOrigin()).toBe("https://samgp.com");
  });

  it("takes a configured origin, normalised and without a trailing slash", () => {
    process.env.SITE_PUBLIC_URL = "https://staging.example.test/";

    expect(siteOrigin()).toBe("https://staging.example.test");
  });

  /**
   * A malformed value must not fail a build or emit a broken canonical. The frozen domain is the
   * value the platform is going to use anyway, so it is the safe answer to every bad input.
   */
  it.each(["", "   ", "not a url", "ftp://samgp.com", "samgp.com"])(
    "falls back to the frozen domain for %j",
    (value) => {
      process.env.SITE_PUBLIC_URL = value;

      expect(siteOrigin()).toBe("https://samgp.com");
    },
  );

  it("is read per call, so a value set after import is honoured", () => {
    delete process.env.SITE_PUBLIC_URL;
    expect(siteOrigin()).toBe("https://samgp.com");

    process.env.SITE_PUBLIC_URL = "https://other.example.test";
    expect(siteOrigin()).toBe("https://other.example.test");
  });

  it("is a URL for `metadataBase`", () => {
    delete process.env.SITE_PUBLIC_URL;

    expect(siteUrl()).toBeInstanceOf(URL);
    expect(siteUrl().href).toBe("https://samgp.com/");
  });
});

describe("absoluteUrl", () => {
  it("resolves a site-relative path against the origin", () => {
    delete process.env.SITE_PUBLIC_URL;

    expect(absoluteUrl("/en/products")).toBe("https://samgp.com/en/products");
    expect(absoluteUrl("/")).toBe("https://samgp.com/");
  });

  it("passes an already-absolute URL through — an editor override is one form of canonical", () => {
    delete process.env.SITE_PUBLIC_URL;

    expect(absoluteUrl("https://samgp.com/en/privacy-policy")).toBe(
      "https://samgp.com/en/privacy-policy",
    );
  });

  it("follows the configured origin, so nothing can emit a stale host", () => {
    process.env.SITE_PUBLIC_URL = "https://staging.example.test";

    expect(absoluteUrl("/en/about-us")).toBe("https://staging.example.test/en/about-us");
  });
});

describe("structured-data identity", () => {
  it("derives both site-wide @ids from the same origin", () => {
    process.env.SITE_PUBLIC_URL = "https://staging.example.test";

    expect(organizationId()).toBe("https://staging.example.test/#organization");
    expect(webSiteId()).toBe("https://staging.example.test/#website");
  });

  it("publishes the short form CLAUDE.md fixes, and no legal entity name", () => {
    expect(ORGANIZATION_NAME).toBe("SAM Group");
  });
});
