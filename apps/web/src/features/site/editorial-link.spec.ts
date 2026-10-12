import { describe, expect, it } from "vitest";

import {
  editorialHrefKind,
  projectStructuralLists,
  STRUCTURAL_LISTS,
} from "@sam-group/types/structural-lists";

import { structuralListLinks } from "../content/structural-copy";

/** The one rule for an address typed in /admin, and where it is (and is not) allowed through. */

describe("editorialHrefKind", () => {
  it("accepts a page on this site, an anchor, https, mailto and tel", () => {
    expect(editorialHrefKind("/en/products/engine-oils")).toBe("internal");
    expect(editorialHrefKind("/en/products/finder?segment=marine#top")).toBe("internal");
    expect(editorialHrefKind("/")).toBe("internal");
    expect(editorialHrefKind("#contact")).toBe("anchor");
    expect(editorialHrefKind("https://example.com/page?x=1")).toBe("external");
    expect(editorialHrefKind("mailto:sales@samgp.com")).toBe("mailto");
    expect(editorialHrefKind("tel:+982112345678")).toBe("tel");
  });

  it("refuses everything that could run code, leave HTTPS or smuggle a host", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>",
      "vbscript:x",
      "http://example.com",
      "//evil.example",
      "/\\evil.example",
      "https://user:pass@example.com",
      "https://localhost",
      "/en/products engine",
      "/en/\u0000x",
      "mailto:not-an-address",
      "tel:abc",
      "#bad anchor",
      "products/engine-oils",
      "",
      "/" + "a".repeat(2000),
    ]) {
      expect(editorialHrefKind(bad), bad).toBeNull();
    }
  });
});

const ROWS = STRUCTURAL_LISTS.home.industries.map((row) => ({ ...row }));
const homeLists = (industries: Record<string, unknown>[]): Record<string, unknown> => ({
  ...Object.fromEntries(
    Object.entries(STRUCTURAL_LISTS.home).map(([key, rows]) => [key, rows.map((r) => ({ ...r }))]),
  ),
  industries,
});

describe("projectStructuralLists and the optional href", () => {
  it("passes a valid link through on a list that takes one, and drops an empty one", () => {
    const lists = projectStructuralLists(
      "home",
      homeLists([
        { ...ROWS[0], href: "/en/products/engine-oils" },
        { ...ROWS[1], href: "" },
        { ...ROWS[2], href: null },
        ...ROWS.slice(3),
      ]),
    );
    expect(lists?.industries?.[0]?.href).toBe("/en/products/engine-oils");
    expect(lists?.industries?.[1]).not.toHaveProperty("href");
    expect(lists?.industries?.[2]).not.toHaveProperty("href");
  });

  it("refuses the whole document for an unsafe link", () => {
    expect(
      projectStructuralLists(
        "home",
        homeLists([{ ...ROWS[0], href: "javascript:alert(1)" }, ...ROWS.slice(1)]),
      ),
    ).toBeNull();
  });

  it("still refuses an href on a list that does not take links", () => {
    const lists = homeLists(ROWS);
    const [other] = Object.keys(STRUCTURAL_LISTS.home).filter((key) => key !== "industries");
    const rows = (lists[other as string] as Record<string, unknown>[]).map((row, i) =>
      i === 0 ? { ...row, href: "/en" } : row,
    );
    expect(projectStructuralLists("home", { ...lists, [other as string]: rows })).toBeNull();
  });
});

describe("structuralListLinks", () => {
  it("lines links up with the rows structuralList keeps, and re-checks every value", () => {
    const fields = {
      lists: {
        industries: [
          { source: "2", name: "x", body: "y", href: "/en/a" },
          { source: "9", name: "dropped", body: "unknown source" },
          { source: "0", name: "x", body: "y", href: "javascript:alert(1)" },
          { source: "1", name: "x", body: "y" },
        ],
      },
    };
    expect(structuralListLinks(fields, "industries", 5)).toEqual(["/en/a", undefined, undefined]);
  });

  it("gives built-in rows no links", () => {
    expect(structuralListLinks(undefined, "industries", 3)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});
