import { test } from "node:test";
import assert from "node:assert/strict";
import { STRUCTURAL_RICH_TEXT } from "@sam-group/types/structural-lists";
import { editorFields } from "./editor/company-editor";
import { richTextLinksValid, richTextarea, RICH_TEXT_LINK_ERROR } from "./editor/rich-text-field";
import { StructuralPages } from "./globals/structural-pages";
import { AboutUs } from "./globals/about-us";

type Described = { name: string; rich?: boolean; fields?: Described[] };

function richPaths(fields: Described[], prefix = ""): string[] {
  return fields.flatMap((field) => [
    ...(field.rich ? [prefix + field.name] : []),
    ...richPaths(field.fields ?? [], prefix + field.name + "."),
  ]);
}

test("/admin is told exactly which structural fields are body copy", () => {
  for (const [scope, entry] of Object.entries(STRUCTURAL_RICH_TEXT)) {
    const page = StructuralPages.find((p) => p.slug === scope)!;
    const paths = richPaths(editorFields(page.fields) as Described[]).sort();
    const expected = [
      ...entry.slots,
      ...Object.entries(entry.lists).flatMap(([list, fields]) =>
        fields.map((field) => `lists.${list}.${field}`),
      ),
    ].sort();
    assert.deepEqual(paths, expected, scope);
  }
});

test("other pages mark their body-copy fields too", () => {
  const paths = richPaths(editorFields(AboutUs.fields) as Described[]);
  assert.ok(paths.includes("hero.supportingText"), paths.join(", "));
  assert.ok(paths.includes("closing.lead"));
  assert.ok(!paths.some((p) => p.endsWith(".heading") || p.endsWith(".eyebrow")));
});

test("a body-copy textarea refuses an unsafe link and keeps Payload's own checks", async () => {
  const validate = richTextarea.validate!;
  const options = {
    required: true,
    maxLength: 20,
    req: { payload: { config: {} }, t: (key: string) => key },
  } as never;
  assert.equal(await validate("ok [a](/en)", options), true);
  assert.equal(await validate("bad [a](javascript:alert)", options), RICH_TEXT_LINK_ERROR);
  assert.notEqual(await validate("x".repeat(25), options), true);
  assert.notEqual(await validate("", options), true);
});

test("rich-text bodies refuse an unsafe link in Payload's link shape", () => {
  const body = (url: string, linkType = "custom"): Record<string, unknown> => ({
    root: {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "link", fields: { url, linkType }, children: [] }],
        },
      ],
    },
  });
  assert.equal(richTextLinksValid(body("/en/products")), true);
  assert.equal(richTextLinksValid(body("https://example.com")), true);
  assert.equal(richTextLinksValid(body("javascript:alert(1)")), false);
  assert.equal(richTextLinksValid(body("http://example.com")), false);
  assert.equal(richTextLinksValid(body("", "internal")), true);
  assert.equal(richTextLinksValid(null), true);
});
