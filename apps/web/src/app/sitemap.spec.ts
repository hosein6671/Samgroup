import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/sitemap.xml`.
 *
 * A sitemap is a set of assertions to a search engine, so these assertions are mostly about the
 * four ways it could lie: a URL that 404s, a URL that is unpublished, a URL carrying placeholder
 * content, and a locale that claims a translation nobody wrote. Each of those has a test below, and
 * each is a rule the file enforces rather than a convention it follows.
 */

const { getActiveLocales } = vi.hoisted(() => ({ getActiveLocales: vi.fn() }));
const { getSitemapEntries } = vi.hoisted(() => ({ getSitemapEntries: vi.fn() }));
const { getBlogPosts } = vi.hoisted(() => ({ getBlogPosts: vi.fn() }));
const { resolvePrivacyPolicy } = vi.hoisted(() => ({ resolvePrivacyPolicy: vi.fn() }));

vi.mock("@/lib/locales", () => ({ getActiveLocales }));
vi.mock("@/lib/seo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo")>()),
  getSitemapEntries,
}));
vi.mock("@/lib/blog", () => ({ getBlogPosts }));
vi.mock("@/features/legal/privacy-policy", () => ({
  PRIVACY_POLICY_SLUG: "privacy-policy",
  resolvePrivacyPolicy,
}));

const sitemap = (await import("./sitemap")).default;

const LOCALES = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", isDefault: true },
  { code: "fa", name: "Persian", nativeName: "Farsi", direction: "rtl", isDefault: false },
  { code: "ar", name: "Arabic", nativeName: "Arabic", direction: "rtl", isDefault: false },
];

const ORIGINAL_ORIGIN = process.env.SITE_PUBLIC_URL;

beforeEach(() => {
  delete process.env.SITE_PUBLIC_URL;
  getActiveLocales.mockReset().mockResolvedValue(LOCALES);
  getSitemapEntries.mockReset().mockResolvedValue([]);
  getBlogPosts.mockReset().mockResolvedValue({ ok: false, reason: "unreachable" });
  resolvePrivacyPolicy.mockReset().mockResolvedValue({ ok: false, reason: "not-found" });
});

afterEach(() => {
  if (ORIGINAL_ORIGIN === undefined) delete process.env.SITE_PUBLIC_URL;
  else process.env.SITE_PUBLIC_URL = ORIGINAL_ORIGIN;
});

const urls = async (): Promise<string[]> => (await sitemap()).map((entry) => entry.url);

describe("structural routes", () => {
  it("lists the nine indexable structural pages in the default locale", async () => {
    expect(await urls()).toEqual([
      "https://samgp.com/en",
      "https://samgp.com/en/about-us",
      "https://samgp.com/en/products",
      "https://samgp.com/en/customized-solutions",
      "https://samgp.com/en/export-logistics",
      "https://samgp.com/en/quality-certifications",
      "https://samgp.com/en/insights",
      "https://samgp.com/en/contact-us",
      "https://samgp.com/en/contact-us/request-a-quote",
    ]);
  });

  /**
   * `/fa/export-logistics` returns 200 and serves English copy. Submitting it would submit a
   * near-duplicate English page under a Persian URL — a duplicate-content signal, not an
   * international one. The same reasoning withholds `hreflang`.
   */
  it("does not submit non-default locales of untranslated structural pages", async () => {
    const listed = await urls();

    expect(listed.some((url) => url.includes("/fa/"))).toBe(false);
    expect(listed.some((url) => url.includes("/ar/"))).toBe(false);
  });

  it("omits the Product Finder, the documentation fragment and every filtered view", async () => {
    const listed = await urls();

    expect(listed).not.toContain("https://samgp.com/en/products/finder");
    expect(listed.some((url) => url.includes("#"))).toBe(false);
    expect(listed.some((url) => url.includes("?"))).toBe(false);
  });

  it("omits the proof trees and the admin surface", async () => {
    const listed = await urls();

    for (const forbidden of ["design-proof", "cms-proof", "/admin"]) {
      expect(listed.some((url) => url.includes(forbidden))).toBe(false);
    }
  });
});

describe("the Privacy Policy is listed only when one is published", () => {
  it("is absent when the CMS holds no published policy — the platform's state today", async () => {
    resolvePrivacyPolicy.mockResolvedValue({ ok: false, reason: "not-found" });

    expect(await urls()).not.toContain("https://samgp.com/en/privacy-policy");
  });

  /**
   * A draft-only document, an unreachable API and a CMS that did not answer are three different
   * facts, and not one of them is "a published policy exists at this URL".
   */
  it.each([
    { label: "draft only, so the API answers 404", result: { ok: false, reason: "not-found" } },
    { label: "the API is unreachable", result: { ok: false, reason: "unreachable" } },
    { label: "the CMS did not answer", result: { ok: false, reason: "api-error", status: 503 } },
  ])("is absent when $label", async ({ result }) => {
    resolvePrivacyPolicy.mockResolvedValue(result);

    expect(await urls()).not.toContain("https://samgp.com/en/privacy-policy");
  });

  it("is listed once a published policy is served", async () => {
    resolvePrivacyPolicy.mockResolvedValue({
      ok: true,
      localeFallback: false,
      page: {
        slug: "privacy-policy",
        title: "Privacy Policy",
        bodyHtml: "",
        lastUpdatedDate: null,
      },
    });

    expect(await urls()).toContain("https://samgp.com/en/privacy-policy");
  });
});

describe("Product Family pages come from the API, per translated locale", () => {
  it("lists a family in every locale the API says it is translated into", async () => {
    getSitemapEntries.mockResolvedValue([
      { entityType: "Category", entityId: "1", locale: "en", slug: "base-oils" },
      { entityType: "Category", entityId: "1", locale: "fa", slug: "روغن-پایه" },
    ]);

    const listed = await urls();

    expect(listed).toContain("https://samgp.com/en/products/base-oils");
    expect(listed).toContain(
      `https://samgp.com/fa/products/${encodeURIComponent("روغن-پایه")}`.replace(/%2F/gu, "/"),
    );
  });

  it("drops a locale the `Locale` table does not have — that URL would 404 at the router", async () => {
    getSitemapEntries.mockResolvedValue([
      { entityType: "Category", entityId: "1", locale: "de", slug: "basisole" },
    ]);

    expect(await urls()).not.toContain("https://samgp.com/de/products/basisole");
  });

  it("ignores an entity type this build has no route for, rather than guessing one", async () => {
    getSitemapEntries.mockResolvedValue([
      { entityType: "SomethingNew", entityId: "1", locale: "en", slug: "whatever" },
    ]);

    expect(await urls()).not.toContain("https://samgp.com/en/products/whatever");
  });

  it("still serves the structural routes when the API did not answer", async () => {
    getSitemapEntries.mockResolvedValue(null);

    expect(await urls()).toContain("https://samgp.com/en/about-us");
  });
});

describe("published articles", () => {
  it("lists each post with its own publication date", async () => {
    getBlogPosts.mockResolvedValue({
      ok: true,
      posts: [{ slug: "first-post", publishedAt: "2026-08-01T00:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await sitemap();
    const article = result.find((entry) => entry.url.endsWith("/en/insights/first-post"));

    expect(article).toBeDefined();
    expect(article?.lastModified).toEqual(new Date("2026-08-01T00:00:00.000Z"));
  });

  it("walks pages until the reported total is covered", async () => {
    getBlogPosts
      .mockResolvedValueOnce({
        ok: true,
        posts: [{ slug: "a", publishedAt: "2026-08-01T00:00:00.000Z" }],
        total: 2,
        page: 1,
        limit: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        posts: [{ slug: "b", publishedAt: "2026-08-02T00:00:00.000Z" }],
        total: 2,
        page: 2,
        limit: 1,
      });

    const listed = await urls();

    expect(listed).toContain("https://samgp.com/en/insights/a");
    expect(listed).toContain("https://samgp.com/en/insights/b");
    expect(getBlogPosts).toHaveBeenCalledTimes(2);
  });

  it("stops rather than looping when the API stops answering mid-walk", async () => {
    getBlogPosts
      .mockResolvedValueOnce({
        ok: true,
        posts: [{ slug: "a", publishedAt: "2026-08-01T00:00:00.000Z" }],
        total: 500,
        page: 1,
        limit: 1,
      })
      .mockResolvedValue({ ok: false, reason: "unreachable" });

    expect(await urls()).toContain("https://samgp.com/en/insights/a");
    expect(getBlogPosts).toHaveBeenCalledTimes(2);
  });
});

describe("when the platform cannot say what exists", () => {
  /**
   * `getActiveLocales` throws by design — it is the routing bootstrap. A sitemap that answers 500
   * while the site itself serves fine is worse than an empty one, which a crawler reads as
   * "nothing new" — exactly true when the locale set is unknown.
   */
  it("serves an empty sitemap instead of throwing when the locale set cannot be resolved", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    getActiveLocales.mockRejectedValue(new Error("locale endpoint unreachable"));

    await expect(sitemap()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it("never emits a development origin", async () => {
    const listed = await urls();

    for (const url of listed) {
      expect(url.startsWith("https://samgp.com/")).toBe(true);
    }
  });

  it("follows the configured base URL", async () => {
    process.env.SITE_PUBLIC_URL = "https://staging.example.test";

    expect(await urls()).toContain("https://staging.example.test/en/about-us");
  });
});

describe("the document itself", () => {
  it("contains no duplicate URL — a repeated <url> is a sitemap error", async () => {
    getSitemapEntries.mockResolvedValue([
      { entityType: "Category", entityId: "1", locale: "en", slug: "base-oils" },
      { entityType: "Category", entityId: "1", locale: "en", slug: "base-oils" },
    ]);

    const listed = await urls();

    expect(new Set(listed).size).toBe(listed.length);
  });
});
