import { describe, expect, it } from "vitest";

import { markdownToPayload, payloadRichTextEditable, payloadToMarkdown } from "./payload-rich-text";

/** Payload rich text in and out of the visual editor, with Payload's own link shape kept. */

type Json = Record<string, unknown>;

const text = (t: string, format = 0): Json => ({
  type: "text",
  text: t,
  format,
  mode: "normal",
  style: "",
  detail: 0,
  version: 1,
});
const paragraph = (...children: unknown[]): Json => ({
  type: "paragraph",
  format: "",
  indent: 0,
  version: 1,
  direction: "ltr",
  textFormat: 0,
  textStyle: "",
  children,
});
const payloadLink = (url: string, newTab: boolean, ...children: unknown[]): Json => ({
  type: "link",
  version: 3,
  id: "65f0c0ffee0000000000abcd",
  fields: { linkType: "custom", url, newTab },
  format: "",
  indent: 0,
  direction: "ltr",
  children,
});
const doc = (...children: unknown[]): Json => ({
  root: { type: "root", format: "", indent: 0, version: 1, direction: "ltr", children },
});

describe("payload rich text", () => {
  // The shape stored for About → Who we are today: plain paragraphs.
  const stored = doc(
    paragraph(text("SAM Group is a petroleum products manufacturer.")),
    paragraph(text("Dealing directly with the producer.")),
  );

  it("reads a stored body as Markdown", () => {
    expect(payloadToMarkdown(stored)).toBe(
      "SAM Group is a petroleum products manufacturer.\n\nDealing directly with the producer.",
    );
  });

  it("reads bold, italic and Payload links", () => {
    const value = doc(
      paragraph(
        text("We "),
        text("produce", 1),
        text(" and "),
        text("blend", 2),
        text(" — see "),
        payloadLink("/en/products", false, text("products")),
        text("."),
      ),
    );
    expect(payloadRichTextEditable(value)).toBe(true);
    expect(payloadToMarkdown(value)).toBe(
      "We **produce** and *blend* — see [products](/en/products).",
    );
  });

  it("writes Markdown back in Payload's own link shape", () => {
    const out = markdownToPayload("See [our lab](/en/about-us) and [a site](https://example.com).");
    const children = (out.root.children[0] as unknown as { children: Record<string, unknown>[] })
      .children;
    const links = children.filter((node) => node.type === "link");
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      type: "link",
      version: 3,
      fields: { linkType: "custom", url: "/en/about-us", newTab: false },
    });
    expect(links[1]).toMatchObject({ fields: { url: "https://example.com", newTab: true } });
    expect(String(links[0]?.id)).toMatch(/^[0-9a-f]{24}$/);
    expect(links[0]).not.toHaveProperty("url");
  });

  it("survives a full round trip unchanged in meaning", () => {
    const md = "## Heading\n\nA **bold** [link](/en/x).\n\n- one\n- two\n\n> quote";
    expect(payloadToMarkdown(markdownToPayload(md))).toBe(md);
  });

  it("keeps anything it cannot represent out of the visual editor", () => {
    expect(payloadRichTextEditable(doc(paragraph(text("underlined", 8))))).toBe(false);
    expect(payloadRichTextEditable(doc({ type: "upload", version: 1, value: 3 }))).toBe(false);
    expect(payloadRichTextEditable(doc({ ...paragraph(text("x")), format: "center" }))).toBe(false);
    expect(
      payloadRichTextEditable(
        doc(paragraph(payloadLink("http://insecure.example", false, text("x")))),
      ),
    ).toBe(false);
    expect(payloadRichTextEditable(stored)).toBe(true);
    expect(payloadRichTextEditable(null)).toBe(true);
  });
});
