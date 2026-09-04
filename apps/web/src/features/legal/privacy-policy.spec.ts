import { describe, expect, it, vi } from "vitest";

import { ACTIVE_LOCALE_CODES } from "@test/active-locales";

import { ROUTES } from "@/features/site/site-routes";

import type { ContentPageResult } from "@/lib/content";
import type { SeoFields } from "@sam-group/types";

/**
 * Whether the platform may link its Privacy Policy — the one rule four surfaces depend on.
 *
 * The footer, both consent labels and the policy route itself all read this module, so the mapping
 * from "what the Content API said" to "an address, or nothing" is asserted here once rather than
 * four times. `privacyPolicyHrefFrom` is pure and takes an already-resolved lookup, which is why it
 * exists as a separate export: the memoized fetch is not the part with a decision in it.
 */

const { getContentPage } = vi.hoisted(() => ({ getContentPage: vi.fn() }));

vi.mock("@/lib/content", () => ({ getContentPage }));

const { getPrivacyPolicyHref, privacyPolicyHrefFrom, PRIVACY_POLICY_SLUG } =
  await import("./privacy-policy");

/** The SEO record the API always serves, with every value at its documented empty state. */
const EMPTY_SEO: SeoFields = {
  locale: "en",
  metaTitle: null,
  metaDescription: null,
  canonicalUrl: null,
  ogTitle: null,
  ogDescription: null,
  socialImage: null,
  twitterCardType: "summary_large_image",
  twitterTitle: null,
  twitterDescription: null,
  twitterImage: null,
  robotsIndex: true,
  robotsFollow: true,
  keywords: [],
  structuredDataOverride: null,
  alternates: [],
};

const PUBLISHED: ContentPageResult = {
  ok: true,
  localeFallback: false,
  page: {
    slug: "privacy-policy",
    title: "Privacy Policy",
    bodyHtml: "<p>The reviewed policy text.</p>",
    lastUpdatedDate: null,
    seo: EMPTY_SEO,
  },
};

describe("the Privacy Policy link rule", () => {
  it("uses the canonical slug, which is a constant rather than a URL segment", () => {
    expect(PRIVACY_POLICY_SLUG).toBe("privacy-policy");
    expect(ROUTES.privacyPolicy).toBe(`/${PRIVACY_POLICY_SLUG}`);
  });

  it("returns the locale's own address when a published policy exists", () => {
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(privacyPolicyHrefFrom(code, PUBLISHED)).toBe(`/${code}${ROUTES.privacyPolicy}`);
    }
  });

  /**
   * Four outcomes, one answer. A definitive 404 and a draft-only page both mean no public policy
   * exists; an unreachable API and a 503 mean nobody knows. None of the four is "a policy exists",
   * so none of them may produce a link — a link to a 404 beside a consent checkbox, or in the
   * footer of every page, is worse than the plain wording those surfaces already carry.
   */
  it.each([
    { label: "the CMS holds no published page", result: { ok: false, reason: "not-found" } },
    { label: "the API did not answer", result: { ok: false, reason: "unreachable" } },
    {
      label: "the CMS did not answer the API",
      result: { ok: false, reason: "api-error", status: 503 },
    },
    {
      label: "the API answered with something else",
      result: { ok: false, reason: "api-error", status: 200 },
    },
  ])("returns null when $label", ({ result }) => {
    expect(privacyPolicyHrefFrom("en", result as ContentPageResult)).toBeNull();
  });

  it("never invents an address for a locale — the route segment is fixed English", () => {
    // Structural page URLs stay fixed English across locales (PROJECT_HANDOFF §6.12), so only the
    // prefix differs. A localized `privacy-policy` segment would be a different route.
    for (const code of ACTIVE_LOCALE_CODES) {
      expect(privacyPolicyHrefFrom(code, PUBLISHED)).toContain("/privacy-policy");
    }
  });
});

describe("getPrivacyPolicyHref", () => {
  it("asks the Content API for the canonical slug in the requested locale", async () => {
    getContentPage.mockResolvedValue({ ok: false, reason: "not-found" });

    await getPrivacyPolicyHref("ar");

    expect(getContentPage).toHaveBeenCalledWith("privacy-policy", "ar");
  });

  it("resolves to the address only when the lookup succeeded", async () => {
    getContentPage.mockResolvedValue(PUBLISHED);
    expect(await getPrivacyPolicyHref("fa")).toBe("/fa/privacy-policy");

    getContentPage.mockResolvedValue({ ok: false, reason: "unreachable" });
    expect(await getPrivacyPolicyHref("en")).toBeNull();
  });
});
