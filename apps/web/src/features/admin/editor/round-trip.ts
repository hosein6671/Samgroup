import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { createEditor } from "lexical";
import { Lexer, type Token } from "marked";

import { parseInline } from "@sam-group/types/structural-lists";

import {
  cleanMarkdown,
  NODES,
  PRESERVE_NEWLINES,
  TRANSFORMERS,
  type EditorMode,
} from "./markdown-nodes";

/**
 * Whether the visual editor can open this text without changing what it means.
 *
 * The visual editor holds its own document model and writes Markdown back on every change, so
 * opening text it cannot represent — a table, raw HTML, a code block — would silently drop that
 * part on the first keystroke. Instead, the text is taken through the editor once, off screen, and
 * the result is compared with the original *by meaning*, using the parser the site itself renders
 * with: `parseInline` for a page field, `marked`'s token tree for an article. Spelling differences
 * that mean the same (`_a_` and `*a*`, `* item` and `- item`) pass; anything that would show
 * differently fails, and the field opens in its Markdown source instead.
 */
export function roundTrip(markdown: string, mode: EditorMode): string {
  const editor = createEditor({
    namespace: "round-trip",
    nodes: NODES[mode],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(
    () => {
      $convertFromMarkdownString(markdown, TRANSFORMERS[mode], undefined, PRESERVE_NEWLINES[mode]);
    },
    { discrete: true },
  );
  return cleanMarkdown(
    editor
      .getEditorState()
      .read(() => $convertToMarkdownString(TRANSFORMERS[mode], undefined, PRESERVE_NEWLINES[mode])),
  );
}

/** True when `markdown` survives the visual editor unchanged in meaning. */
export function visualEditorSafe(markdown: string, mode: EditorMode): boolean {
  try {
    if (mode === "document" && hasUnsupportedBlock(markdown)) return false;
    return sameMeaning(markdown, roundTrip(markdown, mode), mode);
  } catch {
    return false;
  }
}

export function sameMeaning(a: string, b: string, mode: EditorMode): boolean {
  if (mode === "inline") return inlineKey(a) === inlineKey(b);
  return JSON.stringify(documentKey(a)) === JSON.stringify(documentKey(b));
}

function inlineKey(text: string): string {
  // Line breaks inside a field are kept, but trailing ones mean nothing on the page.
  return JSON.stringify(parseInline(text.replace(/\r\n?/g, "\n").replace(/\s+$/, "")));
}

/** Block kinds the document editor has a node for; any other kind keeps the Markdown source. */
const SUPPORTED_BLOCKS = new Set(["space", "paragraph", "heading", "blockquote", "list", "text"]);

/**
 * A table, code block, raw HTML or rule survives the round trip only as literal characters in a
 * paragraph — kept, but shown as raw syntax and easy to break while typing — so text with one is
 * edited in its source.
 */
function hasUnsupportedBlock(markdown: string): boolean {
  const visit = (tokens: readonly Token[]): boolean =>
    tokens.some(
      (token) =>
        !SUPPORTED_BLOCKS.has(token.type) ||
        (token.type === "blockquote" && visit(token.tokens ?? [])) ||
        (token.type === "list" &&
          token.items.some((item: { tokens: Token[] }) =>
            visit(item.tokens.filter((t) => t.type !== "text")),
          )),
    );
  return visit(new Lexer({ gfm: true }).lex(markdown.replace(/\r\n?/g, "\n")));
}

type Shape = string | { readonly [key: string]: Shape | readonly Shape[] };

/** A token tree reduced to what changes the page: kinds, levels, addresses and the words. */
function documentKey(markdown: string): Shape[] {
  return shape(new Lexer({ gfm: true }).lex(markdown.replace(/\r\n?/g, "\n")));
}

function shape(tokens: readonly Token[]): Shape[] {
  const out: Shape[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "space":
        break;
      case "text": {
        const inner = (token as { tokens?: Token[] }).tokens;
        if (inner?.length) out.push(...shape(inner));
        else if (token.text.trim()) out.push(token.text.replace(/\s+/g, " "));
        break;
      }
      case "heading":
        out.push({ h: String(token.depth), c: shape(token.tokens ?? []) });
        break;
      case "paragraph":
        out.push({ p: shape(token.tokens ?? []) });
        break;
      case "blockquote":
        out.push({ q: shape(token.tokens ?? []) });
        break;
      case "list":
        out.push({
          list: token.ordered ? "ol" : "ul",
          items: token.items.map((item: { tokens: Token[] }) => ({ li: shape(item.tokens) })),
        });
        break;
      case "strong":
      case "em":
        out.push({ [token.type]: shape(token.tokens ?? []) });
        break;
      case "link":
        out.push({ a: token.href, c: shape(token.tokens ?? []) });
        break;
      case "image":
        out.push({ img: token.href, alt: token.text });
        break;
      case "br":
        out.push("\n");
        break;
      case "escape":
        out.push(token.text);
        break;
      default:
        // Anything the editor has no node for (tables, code, HTML, rules…) is kept as its raw
        // source, so the comparison fails if the round trip lost or rewrote it.
        out.push({ raw: token.type, v: token.raw });
    }
  }
  return merge(out);
}

/** Adjacent words join, so a token boundary that moved does not count as a change. */
function merge(parts: Shape[]): Shape[] {
  const out: Shape[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (typeof part === "string" && typeof last === "string") out[out.length - 1] = last + part;
    else out.push(part);
  }
  return out.map((part) => (typeof part === "string" ? part.replace(/\s+/g, " ") : part));
}
