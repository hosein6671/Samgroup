import { describe, expect, it } from "vitest";

import { hrefsIn, renderHtml } from "@test/rendered-links";

import { ProductTechnicalDocuments } from "./technical-documents";

/**
 * The technical-documents request CTA — locale-safe routing and honest semantics.
 *
 * ## What this pins
 *
 * The CTA is modelled on `ClosingCta`'s own "Request Sample" branch: a locale-prefixed link to
 * the shared Contact Us Inquiry form, carrying `?product={slug}` so the destination resolves the
 * same server-side context (`resolveProductContext`) every other product CTA on this page does.
 * `?type=product_inquiry` preselects the closest-fitting entry in the seven-value inquiry
 * vocabulary — never a new one — because this CTA is a question about a specific product, not a
 * document-delivery request the platform has no endpoint for.
 */

function detail(locale: string, productSlug?: string): string {
  return renderHtml(<ProductTechnicalDocuments locale={locale} productSlug={productSlug} />);
}

describe("the technical-documents request CTA", () => {
  it("addresses the shared Contact Us route in the reader's locale", () => {
    const hrefs = hrefsIn(detail("fa", "turbine-oil"));

    expect(hrefs).toHaveLength(1);
    expect(hrefs[0]).toBe("/fa/contact-us?type=product_inquiry&product=turbine-oil");
  });

  it("carries no product query when the page has none", () => {
    const hrefs = hrefsIn(detail("en"));

    expect(hrefs).toEqual(["/en/contact-us?type=product_inquiry"]);
  });

  it("preselects the existing product_inquiry type — never an invented eighth value", () => {
    expect(hrefsIn(detail("en", "sn-500"))[0]).toContain("type=product_inquiry");
  });

  it("encodes a slug that needs encoding", () => {
    expect(hrefsIn(detail("ar", "group iii/+"))[0]).toBe(
      "/ar/contact-us?type=product_inquiry&product=group%20iii%2F%2B",
    );
  });

  it("never doubles the locale prefix", () => {
    expect(hrefsIn(detail("en", "sn-500"))[0]?.startsWith("/en/en")).toBe(false);
  });

  it("promises a conversation, never a file", () => {
    const html = detail("en", "sn-500").toLowerCase();

    // The same forbidden set `specifications.spec.tsx` already checks Product Detail against —
    // this CTA must not become the place a PDF/download claim slips back onto the page.
    for (const forbidden of [".pdf", "download", "signedurl", "downloadurl"]) {
      expect(html).not.toContain(forbidden);
    }

    expect(html).toContain("request technical documents");
  });
});
