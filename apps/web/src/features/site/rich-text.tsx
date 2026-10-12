import { Fragment, type ReactNode } from "react";

import { parseInline, type InlineNode } from "@sam-group/types/structural-lists";

import { EditorialLink } from "./editorial-link";

/**
 * Editorial text with its inline formatting — **bold**, *italic* and links — as an editor set it
 * in /admin. The text is parsed by the shared rule (`parseInline`, structural-lists.ts), never
 * injected as HTML: the only elements it can produce are `<strong>`, `<em>` and a link that has
 * already passed `validEditorialHref`, rendered by `EditorialLink`.
 *
 * `links={false}` keeps a link's words and drops the link, for text that sits inside something
 * already interactive (a button, a card that is itself a link) — a link inside a link is invalid.
 */
export function RichText({
  text,
  links = true,
}: {
  readonly text: string;
  readonly links?: boolean;
}): ReactNode {
  return renderNodes(parseInline(text), links, "r");
}

function renderNodes(nodes: readonly InlineNode[], links: boolean, key: string): ReactNode {
  return nodes.map((node, i) => {
    const k = `${key}-${i}`;
    if (node.type === "text") return <Fragment key={k}>{node.text}</Fragment>;
    const children = renderNodes(node.children, links, k);
    if (node.type !== "link")
      return node.type === "strong" ? (
        <strong key={k}>{children}</strong>
      ) : (
        <em key={k}>{children}</em>
      );
    if (!links) return <Fragment key={k}>{children}</Fragment>;
    return (
      <EditorialLink key={k} href={node.href} className="rt-link">
        {children}
      </EditorialLink>
    );
  });
}
