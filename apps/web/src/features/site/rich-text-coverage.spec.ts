import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { STRUCTURAL_RICH_TEXT } from "@sam-group/types/structural-lists";

/**
 * /admin offers the formatting toolbar on exactly the fields `STRUCTURAL_RICH_TEXT` names. This
 * holds the site to the same list, by reading the section sources: every listed text slot is
 * rendered with `copy.rich(...)` and every listed list field is requested with `rich: [...]` —
 * so an editor never formats text the page then flattens — and nothing outside the list asks for
 * formatting the editor cannot give it.
 */

const ROOT = resolve(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
  });
}

const code = sources(ROOT)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

describe("rich-text coverage", () => {
  const slots = Object.values(STRUCTURAL_RICH_TEXT).flatMap((entry) =>
    entry.slots.map((slot) => slot.split(".")[1] as string),
  );
  const listFields = Object.values(STRUCTURAL_RICH_TEXT).flatMap((entry) =>
    Object.entries(entry.lists).flatMap(([list, fields]) =>
      fields.map((field) => [list, field] as const),
    ),
  );

  it.each(slots)("renders the rich slot %s with copy.rich", (key) => {
    expect(code).toContain(`.rich("${key}")`);
    expect(code).not.toContain(`.text("${key}")`);
  });

  it.each(listFields)("requests list %s field %s with rich: [...]", (list, field) => {
    const call = new RegExp(
      `structuralList\\([^;]*?"${list}"[^;]*?rich:\\s*\\[[^\\]]*"${field}"`,
      "s",
    );
    expect(code).toMatch(call);
  });

  it("asks for formatting only on listed slots", () => {
    const used = [...code.matchAll(/\.rich\("([a-z0-9_]+)"\)/g)].map((m) => m[1]);
    for (const key of used) expect(slots, key).toContain(key);
  });
});
