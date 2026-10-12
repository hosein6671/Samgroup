import {
  EDITORIAL_HREF_HINT,
  inlineLinksValid,
  validEditorialHref,
} from "@sam-group/types/structural-lists";
import { richText, textarea } from "payload/shared";
import type { RichTextField, TextareaField } from "payload";

/** What an editor reads when a link in body text uses an address the site will not serve. */
export const RICH_TEXT_LINK_ERROR = `A link in this text uses an address that is not allowed. ${EDITORIAL_HREF_HINT}`;

/**
 * Spread into a `textarea` field that is body copy: /admin then edits it with the formatting
 * toolbar (`custom.rich`), and it may hold **bold**, *italic* and [links](/en/…) in the inline
 * subset `parseInline` reads (structural-lists.ts). Saving checks every link address against the
 * shared rule first, then runs Payload's own textarea validation, so `required`, `minLength` and
 * `maxLength` still apply exactly as before.
 */
export const richTextarea: Pick<TextareaField, "custom" | "validate"> = {
  custom: { rich: true },
  validate: (value, options) =>
    typeof value === "string" && !inlineLinksValid(value)
      ? RICH_TEXT_LINK_ERROR
      : textarea(value, options),
};

/**
 * Every link address in a Payload rich-text value — Payload's link nodes keep it in `fields.url`,
 * standard Lexical ones in `url` — passes the shared rule. Internal (document) links have no URL
 * and are left to Payload.
 */
export function richTextLinksValid(value: unknown): boolean {
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return true;
    const n = node as {
      type?: unknown;
      url?: unknown;
      fields?: { url?: unknown; linkType?: unknown };
      children?: unknown;
    };
    if (n.type === "link" || n.type === "autolink") {
      if (n.fields?.linkType !== "internal") {
        const url = n.fields?.url ?? n.url;
        if (typeof url !== "string" || !validEditorialHref(url)) return false;
      }
    }
    return Array.isArray(n.children) ? n.children.every(visit) : true;
  };
  return visit((value as { root?: unknown } | null | undefined)?.root);
}

/**
 * Spread into a `richText` field: links must pass the shared rule before Payload's own rich-text
 * validation runs, on every save path — /admin and Payload's admin alike.
 */
export const safeLinksRichText: Pick<RichTextField, "validate"> = {
  validate: (value, options) =>
    richTextLinksValid(value) ? richText(value, options) : RICH_TEXT_LINK_ERROR,
};
