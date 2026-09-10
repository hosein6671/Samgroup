import { describe, expect, it } from "vitest";
import { renderHtml } from "@test/rendered-links";
import { ProductEditorialFaq, ProductEditorialPoints } from "./editorial-sections";

describe("published product sections", () => {
  it("does not render empty sections", () => {
    expect(
      renderHtml(<ProductEditorialPoints items={[]} id="applications" title="Applications" />),
    ).toBe("");
    expect(renderHtml(<ProductEditorialFaq items={[]} />)).toBe("");
  });
  it("renders supplied text as escaped content rather than executable markup", () => {
    const html = renderHtml(
      <ProductEditorialPoints
        id="features"
        title="Features"
        items={[{ title: "<script>alert(1)</script>", description: "Example & text" }]}
      />,
    );
    expect(html).toContain('id="features"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("uses native keyboard-operable disclosure controls for FAQ", () => {
    const html = renderHtml(
      <ProductEditorialFaq
        items={[{ question: "Which application?", answer: "Confirm the requirement." }]}
      />,
    );
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>Which application?</summary>");
    expect(html).toContain("Confirm the requirement.");
  });
});
