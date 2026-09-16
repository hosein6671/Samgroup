import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

import type { Tokens } from "marked";

/**
 * The blog body's rendering pipeline — `BlogPost.content` (Markdown source, plain `text` in
 * `sam_platform`) to safe, displayable HTML, plus the table-of-contents SITE_STRUCTURE.md §8's
 * article template calls for.
 *
 * ── Why this exists here, and not on the API ─────────────────────────────────
 *
 * `blog-post.response.ts` states the boundary directly: the wire carries the editor's Markdown
 * source unchanged, "never trusted as raw HTML". Rendering — and therefore sanitizing — happens
 * once, at the one place a reader's browser receives the result, which is this module.
 *
 * ── Sanitization is not optional formatting ──────────────────────────────────
 *
 * `marked` turns Markdown into HTML; it does not know or care whether that HTML is safe to send
 * to a browser. `sanitize-html` is the actual security boundary — an explicit allow-list of tags
 * and attributes, everything else (a raw `<script>`, an `onerror` handler someone typed into the
 * "content" textarea, a `javascript:` link) is dropped rather than escaped-and-shown.
 *
 * ── Heading ids are assigned here, not left to a `marked` extension ──────────
 *
 * Recent `marked` ships no built-in slugger (the old `headerIds` option was removed as a
 * security-relevant default years ago), so this renderer overrides `heading` itself: every H2/H3
 * gets a deterministic, collision-safe `id` and a matching `{ id, text, depth }` entry is
 * collected for the table of contents — the same ids, so a TOC link and its target can never
 * drift apart.
 */

export type TocEntry = { readonly id: string; readonly text: string; readonly depth: 2 | 3 };

export type RenderedMarkdown = { readonly html: string; readonly toc: TocEntry[] };

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "a",
  "img",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
];

/**
 * ASCII-folded, hyphenated, never empty. Two headings that fold to the same text get `-2`, `-3`,
 * … appended — `seen` is one call's worth of state, so two renders of the same article start
 * fresh and produce the same ids both times.
 */
function slugify(text: string, seen: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  const count = seen.get(base) ?? 0;

  seen.set(base, count + 1);

  return count === 0 ? base : `${base}-${count}`;
}

export function renderMarkdown(source: string): RenderedMarkdown {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  const renderer = new marked.Renderer();

  renderer.heading = (token: Tokens.Heading): string => {
    if (token.depth !== 2 && token.depth !== 3) {
      // H1 belongs to the page's own title (post-template.tsx already renders it once); a
      // Markdown H1 or H4+ is demoted to a plain paragraph-weight line rather than silently
      // dropped, so the editor's structure is not lost, only its outline level.
      return `<p>${renderer.parser.parseInline(token.tokens)}</p>\n`;
    }

    const id = slugify(token.text, seen);

    toc.push({ id, text: token.text, depth: token.depth });

    return `<h${token.depth} id="${id}">${renderer.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };

  const rawHtml = marked.parse(source, { renderer, gfm: true, breaks: false }) as string;

  const html = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title"],
      h2: ["id"],
      h3: ["id"],
    },
    allowedSchemes: ["https", "mailto"],
    // No relative link ever needs http:// or a bare path treated as unsafe, and this is a
    // company blog, not a user-generated one — but the scheme allow-list above is the actual
    // guard; this only affects href/src values sanitize-html could not classify.
    allowProtocolRelative: false,
    transformTags: {
      // Every outbound link opens in a new tab without handing the destination a `window.opener`
      // it could use to navigate this tab (the classic reverse-tabnabbing vector).
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });

  return { html, toc };
}
