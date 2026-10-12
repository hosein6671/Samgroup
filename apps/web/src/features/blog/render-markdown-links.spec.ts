import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render-markdown";

/** Article links follow the shared rule: in place on this site, a new tab elsewhere, never unsafe. */
describe("renderMarkdown links", () => {
  const html = (md: string): string => renderMarkdown(md).html.trim();

  it("opens a page on this site in place", () => {
    expect(html("[products](/en/products)")).toBe('<p><a href="/en/products">products</a></p>');
  });

  it("opens an https page elsewhere in a new tab without window.opener", () => {
    expect(html("[site](https://example.com/x)")).toBe(
      '<p><a href="https://example.com/x" target="_blank" rel="noopener noreferrer">site</a></p>',
    );
  });

  it("keeps mailto and tel", () => {
    expect(html("[mail](mailto:sales@samgp.com) [call](tel:+982112345678)")).toBe(
      '<p><a href="mailto:sales@samgp.com">mail</a> <a href="tel:+982112345678">call</a></p>',
    );
  });

  it("drops the address of anything the rule refuses", () => {
    for (const md of ["[x](javascript:alert(1))", "[x](http://example.com)", "[x](//evil.example)"])
      expect(html(md), md).not.toMatch(/href=/);
  });

  it("never takes target or rel from the Markdown itself", () => {
    expect(html('<a href="/en" target="_top" rel="opener">x</a>')).not.toMatch(/_top|opener"/);
  });
});
