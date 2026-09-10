import { test } from "node:test";
import assert from "node:assert/strict";
import { FaqPage, faqPageTextLimits, validFaqPage } from "./globals/faq-page";
test("FAQ page requires complete bounded text and safe SEO", () => {
  const fields = Object.fromEntries(
    Object.keys(faqPageTextLimits).map((key) => [key, "Reviewed copy"]),
  );
  assert.equal(validFaqPage(fields), true);
  assert.equal(validFaqPage({ ...fields, title: " " }), false);
  assert.equal(validFaqPage({ ...fields, contactLabel: "x".repeat(151) }), false);
  assert.equal(validFaqPage({ ...fields, seo: { canonicalUrl: "javascript:alert(1)" } }), false);
  assert.equal(validFaqPage({ ...fields, seo: { canonicalUrl: "", robotsIndex: false } }), true);
});
test("FAQ page mutations must use the audited editor", async () => {
  assert.equal(await FaqPage.access!.update!({} as never), false);
  assert.ok(FaqPage.versions);
});
