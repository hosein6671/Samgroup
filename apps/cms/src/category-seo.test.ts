import { test } from "node:test";
import assert from "node:assert/strict";
import { validCategorySeo, categorySeoFields } from "./editor/category-seo";

test("SEO permits omission and explicit clearing without allowing unsafe URLs", () => {
  for (const value of [
    undefined,
    {},
    { keywords: null },
    { canonicalUrl: "" },
    { canonicalUrl: null },
    { canonicalUrl: "https://samgp.com/en/products/base-oils" },
  ])
    assert.equal(validCategorySeo(value), true);
  for (const url of [
    "javascript:alert(1)",
    "//example.com",
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/#fragment",
  ])
    assert.equal(validCategorySeo({ canonicalUrl: url }), false);
});
test("SEO rejects unknown keys, malformed collections and excessive text", () => {
  for (const value of [
    null,
    [],
    { metaTitle: 3 },
    { robotsIndex: "false" },
    { structuredDataOverride: {} },
    { socialImage: 1 },
    { keywords: [" "] },
    { keywords: Array(31).fill("word") },
    { metaTitle: "x".repeat(201) },
    { twitterCardType: "other" },
  ])
    assert.equal(validCategorySeo(value), false);
  assert.equal(
    validCategorySeo({
      robotsIndex: false,
      robotsFollow: true,
      keywords: ["base oils"],
      twitterCardType: "summary",
    }),
    true,
  );
});
test("the form reuses ordinary SEO fields, excluding media and free structured data", () => {
  const group = categorySeoFields[0];
  assert.ok(group?.type === "group");
  const names = group.fields.flatMap((field) => ("name" in field ? [field.name] : []));
  assert.ok(names.includes("canonicalUrl"));
  assert.ok(names.includes("robotsIndex"));
  assert.equal(names.includes("structuredDataOverride"), false);
  assert.equal(names.includes("socialImage"), false);
});
