import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { inlineLinksValid, inlinePlainText, parseInline } from "@sam-group/types/structural-lists";

import { RichText } from "./rich-text";

/** The inline subset an editor can use in /admin, and what the site does with it. */

const html = (text: string, links = true): string =>
  renderToStaticMarkup(<RichText text={text} links={links} />);

describe("RichText", () => {
  it("renders bold, italic, both, and links by kind", () => {
    expect(html("We **produce** and *formulate*.")).toBe(
      "We <strong>produce</strong> and <em>formulate</em>.",
    );
    expect(html("_italic_ and ***both***")).toBe(
      "<em>italic</em> and <strong><em>both</em></strong>",
    );
    expect(html("See [our lab](/en/about-us).")).toBe(
      'See <a class="rt-link" href="/en/about-us">our lab</a>.',
    );
    expect(html("[site](https://example.com/x)")).toBe(
      '<a href="https://example.com/x" class="rt-link" target="_blank" rel="noopener noreferrer">site</a>',
    );
    expect(html("[**bold link**](mailto:sales@samgp.com)")).toBe(
      '<a href="mailto:sales@samgp.com" class="rt-link"><strong>bold link</strong></a>',
    );
  });

  it("never produces HTML from the text itself", () => {
    expect(html('<img src=x onerror="alert(1)"> **x**')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <strong>x</strong>",
    );
  });

  it("drops an unsafe link and keeps its words", () => {
    expect(html("[click](javascript:alert)")).toBe("click");
    expect(html("[old](http://example.com)")).toBe("old");
  });

  it("keeps words but no link inside something already interactive", () => {
    expect(html("Go to [products](/en/products)", false)).toBe("Go to products");
  });

  it("leaves ordinary punctuation alone", () => {
    for (const text of [
      "snake_case_words",
      "2 * 3 * 4",
      "BASE OILS · ADDITIVES · AUTOMOTIVE",
      "Rates [estimate]",
      "Price (FOB) and *",
      "50% *off",
    ])
      expect(html(text), text).toBe(
        text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      );
  });

  it("honours backslash escapes", () => {
    expect(html("\\*not italic\\* and \\[not a link\\](/en)")).toBe(
      "*not italic* and [not a link](/en)",
    );
  });
});

describe("inlinePlainText and inlineLinksValid", () => {
  it("strips the markup for plain contexts", () => {
    expect(inlinePlainText("We **produce** [lab](/en/x) and *more*.")).toBe(
      "We produce lab and more.",
    );
    expect(inlinePlainText("No formatting here")).toBe("No formatting here");
  });

  it("refuses text with an unsafe link, accepts everything else", () => {
    expect(inlineLinksValid("ok [a](/en) and [b](https://x.com)")).toBe(true);
    expect(inlineLinksValid("plain")).toBe(true);
    expect(inlineLinksValid("bad [a](javascript:alert)")).toBe(false);
    expect(inlineLinksValid("bad [a](http://x.com)")).toBe(false);
    expect(inlineLinksValid("escaped \\[a](javascript:x)")).toBe(true);
  });

  it("never throws on odd input", () => {
    for (const text of ["[", "](", "**", "***", "[a](", "\\", "_a", "*a **b* c**", "[[a](/en)]"])
      expect(() => parseInline(text)).not.toThrow();
  });
});
