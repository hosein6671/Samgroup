import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Answers, ContactFaq, FaqSchema } from "./answers";
import { publishedFaq } from "./published-faq";
vi.mock("./published-faq", () => ({ publishedFaq: vi.fn() }));
describe("published FAQ surfaces", () => {
  it("escapes answer text and keeps paragraphs and native keyboard controls", () => {
    const html = renderToStaticMarkup(
      <Answers
        entries={[{ id: "one", question: "Question?", answer: "<script>\n\nSecond paragraph" }]}
      />,
    );
    expect(html).toContain("<summary>Question?</summary>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<p>Second paragraph</p>");
  });
  it("does not output empty structured data", () => {
    expect(renderToStaticMarkup(<FaqSchema entries={[]} />)).toBe("");
  });
  it("keeps the Contact section absent on empty results or a service outage", async () => {
    vi.mocked(publishedFaq).mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    expect(await ContactFaq({ locale: "en" })).toBeNull();
    expect(await ContactFaq({ locale: "en" })).toBeNull();
    expect(publishedFaq).toHaveBeenLastCalledWith("en", { contact: "true" });
  });
});
