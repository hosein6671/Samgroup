import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import {
  createEditor,
  type LexicalEditor,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from "lexical";

import { editorialHrefKind, validEditorialHref } from "@sam-group/types/structural-lists";

import { cleanMarkdown, NODES, TRANSFORMERS } from "./markdown-nodes";

/**
 * Payload's rich-text fields (About → Who we are, Customized Solutions → Introduction) through the
 * same visual editor as every other field.
 *
 * Payload stores a field as a Lexical editor state — the same JSON the visual editor uses — with
 * one difference: its link node keeps the address in `fields` (`{ type: "link", version: 3,
 * fields: { linkType, url, newTab }, id }`), where standard Lexical keeps `url` and `target` on the
 * node. So a field is read by turning Payload links into standard ones, written by turning them
 * back, and in between it travels as the editor's Markdown, which is what the editor edits.
 *
 * Only what the editor can represent goes this way (`payloadRichTextEditable`): paragraphs,
 * headings, quotes, lists, links, bold and italic. A field holding anything else — an upload, a
 * block, a rule, underline or code — stays in the plain view, so none of it is lost.
 */

type Node = SerializedLexicalNode & {
  children?: Node[];
  format?: number | string;
  url?: string;
  target?: string | null;
  fields?: { url?: string; newTab?: boolean; linkType?: string };
  id?: string;
  tag?: string;
  listType?: string;
  indent?: number;
};

const BLOCKS = new Set(["root", "paragraph", "heading", "quote", "list", "listitem", "linebreak"]);
const LINKS = new Set(["link", "autolink"]);
/** Lexical text format bits: bold = 1, italic = 2. Any other bit is formatting this editor drops. */
const KEPT_TEXT_FORMATS = 1 | 2;

/** Whether this Payload value can be edited visually without losing anything. */
export function payloadRichTextEditable(value: unknown): boolean {
  const root = (value as SerializedEditorState | null | undefined)?.root as Node | undefined;
  if (!root) return value === null || value === undefined;
  const ok = (node: Node): boolean => {
    if (node.type === "text") return ((node.format as number) & ~KEPT_TEXT_FORMATS) === 0;
    if (LINKS.has(node.type)) {
      const url = node.fields?.url ?? node.url ?? "";
      if (node.fields?.linkType === "internal" || !validEditorialHref(url)) return false;
    } else if (!BLOCKS.has(node.type)) return false;
    if (node.type === "list" && node.listType === "check") return false;
    if ((node.indent ?? 0) > 0 && node.type !== "listitem") return false;
    if (typeof node.format === "string" && node.format !== "" && node.format !== "start")
      return false; // alignment
    return (node.children ?? []).every(ok);
  };
  return ok(root);
}

/** Payload's value as the editor's Markdown. */
export function payloadToMarkdown(value: unknown): string {
  const root = (value as SerializedEditorState | null | undefined)?.root;
  if (!root) return "";
  const editor = headless();
  const state = { root: mapNodes(root as Node, toStandardLink) } as SerializedEditorState;
  editor.setEditorState(editor.parseEditorState(state));
  return cleanMarkdown(
    editor.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS.document)),
  );
}

/** The editor's Markdown as a value Payload stores and renders. */
export function markdownToPayload(markdown: string): SerializedEditorState {
  const editor = headless();
  editor.update(() => $convertFromMarkdownString(markdown, TRANSFORMERS.document), {
    discrete: true,
  });
  const json = editor.getEditorState().toJSON();
  return { root: mapNodes(json.root as Node, toPayloadLink) } as SerializedEditorState;
}

function headless(): LexicalEditor {
  return createEditor({
    namespace: "payload-rich-text",
    nodes: NODES.document,
    onError: (error) => {
      throw error;
    },
  });
}

function mapNodes(node: Node, link: (node: Node) => Node): Node {
  const mapped = LINKS.has(node.type) ? link(node) : node;
  return mapped.children
    ? { ...mapped, children: mapped.children.map((child) => mapNodes(child, link)) }
    : mapped;
}

function toStandardLink(node: Node): Node {
  const url = node.fields?.url ?? node.url ?? "";
  const { fields: _fields, id: _id, ...rest } = node;
  return {
    ...rest,
    type: "link",
    version: 1,
    url,
    target: node.fields?.newTab ? "_blank" : null,
    rel: null,
    title: null,
  } as Node;
}

function toPayloadLink(node: Node): Node {
  const url = node.url ?? "";
  const {
    url: _url,
    target: _target,
    rel: _rel,
    title: _title,
    ...rest
  } = node as Node & {
    rel?: unknown;
    title?: unknown;
  };
  return {
    ...rest,
    type: "link",
    version: 3,
    id: objectId(),
    fields: { linkType: "custom", url, newTab: editorialHrefKind(url) === "external" },
  } as Node;
}

/** A 24-character hex id, the form Payload gives its link nodes. */
function objectId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
