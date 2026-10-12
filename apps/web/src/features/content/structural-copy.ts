import { createElement, type ReactNode } from "react";

import {
  inlinePlainText,
  structuralLists,
  validEditorialHref,
} from "@sam-group/types/structural-lists";

import { RichText } from "@/features/site/rich-text";
import { STRUCTURAL_DEFAULTS, structuralImageSlots } from "@sam-group/types/structural-content";
import { type ContentImage, type StructuralScope } from "@sam-group/types";
import { type StructuralFields } from "@sam-group/types";
export type { StructuralFields };
export function structuralSection(
  scope: StructuralScope,
  section: string,
  fields: StructuralFields = {},
): { text: (key: string) => string; rich: (key: string) => ReactNode } {
  const name = section.replaceAll("-", "_");
  const defaults =
    (STRUCTURAL_DEFAULTS[scope] as Record<string, Record<string, string>>)[name] ?? {};
  const value = fields[name];
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const source = (key: string): string =>
    typeof data[key] === "string" && data[key].trim() ? data[key] : (defaults[key] ?? "");
  return {
    /**
     * The slot as plain text: any inline formatting the editor added is removed. For attributes,
     * metadata, buttons and links — and the safe default wherever formatting was not designed in.
     */
    text: (key) => inlinePlainText(source(key)),
    /** The slot with its inline formatting (bold, italic, links) — for body text. */
    rich: (key) => createElement(RichText, { text: source(key) }),
  };
}

/**
 * The photograph chosen in /admin for one figure slot, or `null` to keep the built-in one.
 * Alt falls back to the layout's own alt string when the Media record has none.
 */
export function structuralImage(
  fields: StructuralFields | undefined,
  slot: string,
  fallbackAlt: string,
): { src: string; alt: string } | null {
  const images = fields?.images as Record<string, ContentImage | null> | undefined;
  const image = images?.[slot];
  return image && typeof image.url === "string" && image.url
    ? { src: image.url, alt: image.alt ?? fallbackAlt }
    : null;
}

/**
 * Merge editable rows with code-owned presentation identities. Explicit empty arrays hide rows.
 *
 * Every text field comes back as plain text (any inline formatting removed), except the fields
 * named in `options.rich` — body copy listed in `STRUCTURAL_RICH_TEXT` — which keep their markup
 * for the section to render with `RichText`.
 */
export function structuralList<T>(
  fields: StructuralFields | undefined,
  key: string,
  fallback: readonly T[],
  options: { readonly rich?: readonly string[] } = {},
): readonly T[] {
  const keep = (field: string, value: string): string =>
    options.rich?.includes(field) ? value : inlinePlainText(value);
  const lists = fields?.lists as Record<string, unknown> | undefined;
  const rows = lists?.[key];
  if (!Array.isArray(rows)) return fallback;
  return rows.flatMap((row: Record<string, string>) => {
    const original = fallback[Number(row.source)];
    if (original === undefined) return [];
    if (Array.isArray(original))
      return [
        [
          row.title === undefined ? original[0] : keep("title", row.title),
          row.description === undefined ? original[1] : keep("description", row.description),
        ] as T,
      ];
    const merged = { ...original };
    for (const [field, value] of Object.entries(row)) {
      if (
        ["source", "id", "href", "route", "icon", "key", "code", "src", "image", "kind"].includes(
          field,
        ) ||
        typeof value !== "string"
      )
        continue;
      const target = merged as Record<string, unknown>;
      if (typeof target[field] === "string") target[field] = keep(field, value);
      else if (Array.isArray(target[field]))
        target[field] = value
          .split("\n")
          .filter(Boolean)
          .map((line) => keep(field, line));
    }
    return [merged];
  });
}

/**
 * The editor-supplied links of a list that takes them (`STRUCTURAL_LIST_LINKS`), aligned index for
 * index with what `structuralList` returns for the same arguments. `structuralList` never passes a
 * `href` through; this is the only way one reaches the page, and only after
 * `validEditorialHref` accepts it a second time. Built-in rows (no saved list) have no links.
 */
export function structuralListLinks(
  fields: StructuralFields | undefined,
  key: string,
  fallbackLength: number,
): readonly (string | undefined)[] {
  const lists = fields?.lists as Record<string, unknown> | undefined;
  const rows = lists?.[key];
  if (!Array.isArray(rows)) return Array.from({ length: fallbackLength }, () => undefined);
  return rows.flatMap((row: Record<string, unknown>) => {
    const index = Number(row.source);
    if (!Number.isInteger(index) || index < 0 || index >= fallbackLength) return [];
    const href = typeof row.href === "string" ? row.href.trim() : "";
    return [href && validEditorialHref(href) ? href : undefined];
  });
}

export function structuralEditorDefaults(
  scope: StructuralScope,
  stored: StructuralFields,
  hasSavedContent = true,
): StructuralFields {
  const data = hasSavedContent ? stored : {};
  const defaults = STRUCTURAL_DEFAULTS[scope] as Record<string, Record<string, string>>;
  return {
    ...Object.fromEntries(
      Object.entries(defaults).map(([key, values]) => {
        const raw = data[key];
        return [
          key,
          {
            ...values,
            ...(raw && typeof raw === "object"
              ? Object.fromEntries(
                  Object.entries(raw).filter(
                    ([field, v]) => Object.hasOwn(values, field) && v !== null && v !== undefined,
                  ),
                )
              : {}),
          },
        ];
      }),
    ),
    lists:
      data.lists && typeof data.lists === "object"
        ? {
            ...structuralLists(scope),
            ...Object.fromEntries(Object.entries(data.lists).filter(([, value]) => value !== null)),
          }
        : structuralLists(scope),
    ...(Object.keys(structuralImageSlots(scope)).length > 0
      ? {
          // Keeps the current picks in the form; an empty slot stays empty (built-in photograph).
          images: Object.fromEntries(
            Object.keys(structuralImageSlots(scope)).map((slot) => [
              slot,
              (data.images as Record<string, unknown> | undefined)?.[slot] ?? null,
            ]),
          ),
        }
      : {}),
    ...(scope === "header" || scope === "footer"
      ? {}
      : {
          seo: {
            robotsIndex: true,
            robotsFollow: true,
            twitterCardType: "summary_large_image",
            keywords: [],
            ...(data.seo && typeof data.seo === "object"
              ? Object.fromEntries(Object.entries(data.seo).filter(([, v]) => v !== null))
              : {}),
          },
        }),
  };
}
