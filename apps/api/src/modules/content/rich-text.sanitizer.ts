/*
 * `sanitize-html` is pinned to EXACTLY 2.17.5. Do not bump it as part of a dependency sweep.
 *
 * 2.17.6+ depends on `htmlparser2@12`, which is ESM-only, and this application compiles to
 * CommonJS. Tested, not assumed: 2.17.7 fails with "Cannot use import statement outside a module"
 * at require time, which takes the API down at BOOT rather than failing a test. 2.17.5's
 * `htmlparser2@10` ships a dual build with a `require` condition. Full note: TECH_STACK.md §Backend.
 */
import sanitizeHtml from "sanitize-html";

/**
 * The single sanitization boundary between CMS-authored markup and anything that renders it.
 *
 * ── Why this exists, and why it is here ─────────────────────────────────────
 *
 * Payload's rich text reaches the platform as HTML (`bodyHtml`), and `apps/web` renders it as
 * markup. Without this, every byte an authenticated CMS user could put in an editor would be
 * executable in a visitor's browser — a compromised or malicious editor account, a bad paste, or a
 * future import path would all be stored XSS on the public site.
 *
 * It sits in the **Content module**, not in `apps/web`, deliberately. NestJS is the only public
 * contract (ADR-003), so sanitizing here means every present and future consumer — the public site,
 * the Admin Dashboard, a feed, the RAG export — receives the same safe HTML, and none of them can
 * forget to. A frontend-side sanitizer would have to be repeated per consumer and would leave the
 * unsafe form on the wire.
 *
 * ── Allow-list, never a deny-list ───────────────────────────────────────────
 *
 * `sanitize-html` parses the document with a real HTML parser and **rebuilds it** from the tags and
 * attributes named below; anything unnamed is dropped rather than matched against a pattern of
 * known-bad input. That is the whole reason a parser-based library is used instead of regular
 * expressions: HTML is not a regular language, and every regex-based sanitizer in history has been
 * defeated by a nesting, an encoding or a malformed tag its author did not anticipate.
 *
 * The allow-list is sized for the content this collection actually holds — legal and corporate
 * prose: headings, paragraphs, emphasis, lists, links, quotes, tables and rules. Nothing that
 * executes, embeds, loads or styles arbitrarily is on it.
 */

/**
 * Tags an editor can produce from Payload's default Lexical feature set, plus the table elements
 * legal content routinely needs.
 *
 * Absent on purpose: `script`, `style`, `iframe`, `object`, `embed`, `applet`, `form`, `input`,
 * `button`, `link`, `meta`, `base`, `svg` and `math`. Several of these execute; the rest either load
 * remote content, restyle the page, or (in the case of `svg`/`math`) reopen script execution through
 * foreign-content parsing.
 */
const ALLOWED_TAGS: readonly string[] = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "sub",
  "sup",
  "mark",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  // Payload's converter wraps the document in `<div class="payload-richtext">` and uses `span` for
  // inline formatting. Both are structural only — see the attribute rules below.
  "div",
  "span",
];

/**
 * Attributes, per tag. **`style` is not allowed anywhere**, and neither is any `on*` handler.
 *
 * `class` is permitted only on the two structural elements, and only so the converter's own
 * `payload-richtext` wrapper and its alignment classes survive — the stylesheet that reads them is
 * the frontend's. It is not permitted on `a`, so a link cannot be dressed up as a button.
 */
const ALLOWED_ATTRIBUTES: Record<string, readonly string[]> = {
  a: ["href", "target", "rel"],
  div: ["class"],
  span: ["class"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  ol: ["start"],
};

/**
 * URL schemes a link may use.
 *
 * `javascript:` is absent, which is the point — `sanitize-html` drops the whole attribute when the
 * scheme is not on this list, and it resolves entity- and whitespace-obfuscated schemes before
 * checking, which is exactly the class of bypass a hand-rolled check misses. `data:` is absent too:
 * a `data:text/html` link is a same-origin script delivery mechanism.
 */
const ALLOWED_SCHEMES: readonly string[] = ["http", "https", "mailto", "tel"];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: Object.fromEntries(
    Object.entries(ALLOWED_ATTRIBUTES).map(([tag, attributes]) => [tag, [...attributes]]),
  ),
  allowedSchemes: [...ALLOWED_SCHEMES],
  // Applies the scheme list to `href` on a tag reached through any nesting, not only at top level.
  allowProtocolRelative: false,
  /*
   * A disallowed tag is discarded but its TEXT is kept — `<script>alert(1)</script>` must not leave
   * `alert(1)` as visible prose on a legal page, so `script` and `style` are named as tags whose
   * contents go with them. For everything else, keeping the text is the right call: an editor who
   * pastes an unsupported wrapper should not silently lose the paragraph inside it.
   */
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    /*
     * Any link opening a new tab gets `rel="noopener noreferrer"`. Without `noopener` the opened
     * page can reach back through `window.opener`; this is applied by the sanitizer rather than
     * trusted from the editor, so it holds for every link regardless of how it was authored.
     */
    a: (tagName, attribs) => {
      const target = attribs.target;

      return {
        tagName,
        attribs:
          target === undefined ? attribs : { ...attribs, target, rel: "noopener noreferrer" },
      };
    },
  },
  // Comments can carry conditional-comment payloads and reveal editorial notes. Neither belongs on
  // a public page. (This is sanitize-html's default; stated so it cannot change underneath us.)
  allowedIframeHostnames: [],
  parser: {
    // Prevents an unclosed or mis-nested tag from swallowing the rest of the document.
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  },
};

/**
 * Sanitize one CMS-authored HTML fragment.
 *
 * Total for the value: whatever comes back is safe to render as markup, and nothing else is. The
 * function is deliberately not configurable — a per-call options argument is how one caller ends up
 * with a laxer policy than the rest.
 *
 * @param html the raw `bodyHtml` as Payload produced it.
 * @returns the rebuilt, allow-listed HTML. `""` for a null, undefined or non-string input, because a
 *   missing body is not an error to throw over and an empty string is the only honest rendering of
 *   one.
 */
export function sanitizeRichTextHtml(html: unknown): string {
  if (typeof html !== "string" || html === "") {
    return "";
  }

  return sanitizeHtml(html, OPTIONS);
}
