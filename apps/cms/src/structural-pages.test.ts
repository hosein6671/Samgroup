import { test } from "node:test";
import assert from "node:assert/strict";
import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";
import { structuralLists } from "@sam-group/types/structural-lists";
import { StructuralPages, validStructuralContent } from "./globals/structural-pages";
for (const [scope, defaults] of Object.entries(STRUCTURAL_DEFAULTS)) {
  test(scope + " validates complete copy and bounded editorial lists", () => {
    const fields = { ...defaults, lists: structuralLists(scope) };
    assert.equal(validStructuralContent(scope, fields), true);
    assert.equal(validStructuralContent(scope, { ...fields, lists: { injected: [] } }), false);
    assert.equal(
      validStructuralContent(scope, { ...fields, seo: { canonicalUrl: "javascript:alert(1)" } }),
      false,
    );
    const key = Object.keys(defaults)[0]!;
    assert.equal(validStructuralContent(scope, { ...fields, [key]: {} }), false);
  });
  test(scope + " requires audited editor writes and keeps draft versions", async () => {
    const config = StructuralPages.find((page) => page.slug === scope)!;
    assert.equal(await config.access!.update!({} as never), false);
    assert.ok(config.versions);
  });
}
test("navigation rejects duplicate identities and arbitrary destinations", () => {
  const fields = {
    ...STRUCTURAL_DEFAULTS.header,
    lists: {
      navigation: [
        { source: "0", label: "Welcome" },
        { source: "0", label: "Duplicate" },
      ],
    },
  };
  assert.equal(validStructuralContent("header", fields), false);
  fields.lists.navigation = [
    { source: "0", label: "Welcome", href: "javascript:alert(1)" } as never,
  ];
  assert.equal(validStructuralContent("header", fields), false);
  fields.lists.navigation = [];
  assert.equal(validStructuralContent("header", fields), true);
});
test("industry cards take an optional, validated link and nothing else does", () => {
  const lists = structuralLists("home") as Record<string, readonly Record<string, string>[]>;
  const withIndustry = (href: unknown): Record<string, unknown> => ({
    ...STRUCTURAL_DEFAULTS.home,
    lists: {
      ...lists,
      industries: lists.industries!.map((row, i) => (i === 0 ? { ...row, href } : row)),
    },
  });
  for (const ok of ["/en/products/engine-oils", "https://example.com/x", "", null, "tel:+98123"])
    assert.equal(validStructuralContent("home", withIndustry(ok)), true, String(ok));
  for (const bad of ["javascript:alert(1)", "http://example.com", "//evil.example", 42])
    assert.equal(validStructuralContent("home", withIndustry(bad)), false, String(bad));
  const field = StructuralPages.find((page) => page.slug === "home")!.fields.find(
    (f) => "name" in f && f.name === "lists",
  ) as { fields: { name: string; fields: { name: string }[] }[] };
  const industries = field.fields.find((f) => f.name === "industries")!;
  assert.ok(industries.fields.some((f) => f.name === "href"));
  for (const other of field.fields.filter((f) => f.name !== "industries"))
    assert.ok(!other.fields.some((f) => f.name === "href"), other.name);
});
