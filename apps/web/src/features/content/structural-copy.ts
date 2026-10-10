import { structuralLists } from "@sam-group/types/structural-lists";
import { STRUCTURAL_DEFAULTS, structuralImageSlots } from "@sam-group/types/structural-content";
import { type ContentImage, type StructuralScope } from "@sam-group/types";
import { type StructuralFields } from "@sam-group/types";
export type { StructuralFields };
export function structuralSection(
  scope: StructuralScope,
  section: string,
  fields: StructuralFields = {},
): { text: (key: string) => string } {
  const name = section.replaceAll("-", "_");
  const defaults =
    (STRUCTURAL_DEFAULTS[scope] as Record<string, Record<string, string>>)[name] ?? {};
  const value = fields[name];
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    text: (key) =>
      typeof data[key] === "string" && data[key].trim() ? data[key] : (defaults[key] ?? ""),
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

/** Merge editable rows with code-owned presentation identities. Explicit empty arrays hide rows. */
export function structuralList<T>(
  fields: StructuralFields | undefined,
  key: string,
  fallback: readonly T[],
): readonly T[] {
  const lists = fields?.lists as Record<string, unknown> | undefined;
  const rows = lists?.[key];
  if (!Array.isArray(rows)) return fallback;
  return rows.flatMap((row: Record<string, string>) => {
    const original = fallback[Number(row.source)];
    if (original === undefined) return [];
    if (Array.isArray(original))
      return [[row.title ?? original[0], row.description ?? original[1]] as T];
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
      if (typeof target[field] === "string") target[field] = value;
      else if (Array.isArray(target[field])) target[field] = value.split("\n").filter(Boolean);
    }
    return [merged];
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
