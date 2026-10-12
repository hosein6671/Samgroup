import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  HEADING,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  UNORDERED_LIST,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type Klass,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ReactNode } from "react";

/**
 * What the /admin editor understands, in two sizes, and nothing more — every node and transformer
 * here has a Markdown spelling the site already renders, so the editor can only ever save text the
 * page knows how to show.
 *
 * - **inline** (a page's body-copy field): bold, italic and links. The site renders it with
 *   `RichText` (`parseInline`, structural-lists.ts).
 * - **document** (a blog article): inline, plus headings (H2/H3), quotes, bulleted and numbered
 *   lists and images. The site renders it with `render-markdown.ts`.
 */

/* ── Images (document mode) ─────────────────────────────────────────────────────────────── */

type SerializedImageNode = Spread<{ src: string; alt: string }, SerializedLexicalNode>;

/** An inline image, saved as `![alt](src)` — the form `render-markdown.ts` already renders. */
export class ImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  __alt: string;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__key);
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode(json.src, json.alt);
  }

  constructor(src: string, alt: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
  }

  exportJSON(): SerializedImageNode {
    return { ...super.exportJSON(), type: "image", version: 1, src: this.__src, alt: this.__alt };
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.src = this.__src;
    img.alt = this.__alt;
    return { element: img };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "ad-rich-image";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAlt(): string {
    return this.__alt;
  }

  decorate(): ReactNode {
    // A preview of whatever address the editor typed, so a plain img rather than next/image.
    return <img src={this.__src} alt={this.__alt} />;
  }
}

export function $createImageNode(src: string, alt: string): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, alt));
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => ($isImageNode(node) ? `![${node.getAlt()}](${node.getSrc()})` : null),
  importRegExp: /!\[([^[\]]*)\]\(([^()\s]+)\)/,
  regExp: /!\[([^[\]]*)\]\(([^()\s]+)\)$/,
  replace: (textNode, match) => {
    textNode.replace($createImageNode(match[2] ?? "", match[1] ?? ""));
  },
  trigger: ")",
  type: "text-match",
};

/* ── The two sets ───────────────────────────────────────────────────────────────────────── */

/** Bold and italic export as `**` and `*`; `_italic_` is still read, as older text used it. */
const TEXT: Transformer[] = [BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR, ITALIC_UNDERSCORE];

export type EditorMode = "inline" | "document";

export const TRANSFORMERS: Record<EditorMode, Transformer[]> = {
  inline: [...TEXT, LINK],
  document: [HEADING, QUOTE, UNORDERED_LIST, ORDERED_LIST, IMAGE, ...TEXT, LINK],
};

export const NODES: Record<EditorMode, Klass<LexicalNode>[]> = {
  inline: [LinkNode],
  document: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, ImageNode],
};

/**
 * Inline fields keep a single line break as a line break (`shouldPreserveNewLines`), as the plain
 * textarea did; a document separates blocks the usual Markdown way, with a blank line.
 */
export const PRESERVE_NEWLINES: Record<EditorMode, boolean> = { inline: true, document: false };

/**
 * Lexical writes a space at the edge of a formatted run as the entity `&#32;` (`**&#32;more**`), so
 * the run does not open or close on whitespace. Neither renderer on the site decodes entities in
 * that position, and the reader would see `&#32;`. The space is moved outside the markers instead —
 * `**&#32;more**` becomes ` **more**` — which means the same and is what a person would type.
 */
export function cleanMarkdown(markdown: string): string {
  const spaces = (run: string): string => " ".repeat(run.length / 5);
  return markdown
    .replace(
      /(\*{1,3}|_{1,3})((?:&#32;)+)(?=\S)/g,
      (_m, marker: string, run: string) => spaces(run) + marker,
    )
    .replace(
      /(?<=\S)((?:&#32;)+)(\*{1,3}|_{1,3})/g,
      (_m, run: string, marker: string) => marker + spaces(run),
    )
    .replaceAll("&#32;", " ");
}
