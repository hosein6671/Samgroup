import { describe, expect, it } from "vitest";

import { STRUCTURAL_DEFAULTS } from "@sam-group/types/structural-content";

import { roundTrip, visualEditorSafe } from "./round-trip";

/**
 * The visual editor only opens text it can save back unchanged in meaning; everything else opens
 * in its Markdown source. These are the cases that decide which.
 */

describe("inline fields", () => {
  it("round-trips formatting and links exactly", () => {
    for (const text of [
      "We **produce** and *formulate* with [our lab](/en/about-us).",
      "Plain text only.",
      "***both*** and [**bold link**](https://example.com/x)",
      "Two lines\nkept apart",
    ]) {
      expect(visualEditorSafe(text, "inline"), text).toBe(true);
    }
  });

  it("writes italic as *x* and reads the older _x_", () => {
    expect(roundTrip("an _old_ italic", "inline")).toBe("an *old* italic");
    expect(visualEditorSafe("an _old_ italic", "inline")).toBe(true);
  });

  it("opens every built-in page text in the visual editor", () => {
    const unsafe: string[] = [];
    for (const [scope, sections] of Object.entries(STRUCTURAL_DEFAULTS))
      for (const [section, fields] of Object.entries(sections))
        for (const [key, text] of Object.entries(fields as Record<string, string>))
          if (!visualEditorSafe(text, "inline")) unsafe.push(`${scope}.${section}.${key}: ${text}`);
    expect(unsafe).toEqual([]);
  });
});

describe("document fields (blog)", () => {
  it("round-trips the blocks the editor supports", () => {
    const article = [
      "## A heading",
      "",
      "A paragraph with **bold**, _italic_ and a [link](https://example.com).",
      "",
      "### A subheading",
      "",
      "> A quote",
      "",
      "- one",
      "- two",
      "",
      "1. first",
      "2. second",
      "",
      "![A drum](https://cdn.example.com/drum.webp)",
    ].join("\n");
    expect(visualEditorSafe(article, "document")).toBe(true);
  });

  it("sends anything it cannot represent to the Markdown source", () => {
    expect(visualEditorSafe("| a | b |\n|---|---|\n| 1 | 2 |", "document")).toBe(false);
    expect(visualEditorSafe("Text\n\n```\ncode\n```", "document")).toBe(false);
    expect(visualEditorSafe("Before\n\n<div>html</div>", "document")).toBe(false);
    expect(visualEditorSafe("Before\n\n---\n\nAfter", "document")).toBe(false);
  });
});
