import { STRUCTURAL_DEFAULTS, structuralImageSlots } from "@sam-group/types/structural-content";
import { structuralLists } from "@sam-group/types/structural-lists";
import { projectStructuralLists } from "@sam-group/types/structural-lists";
import type { Field, GlobalConfig } from "payload";
import { editorOnly, publishedForService } from "../access";
import { categorySeoFields, validCategorySeo } from "../editor/category-seo";

/**
 * Absent, or only the scope's own slots, each empty or a media id (a number, or the expanded
 * record the editor read back). A scope without photographs accepts no `images` at all.
 */
export function validStructuralImages(scope: string, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const slots = structuralImageSlots(scope);
  if (typeof value !== "object" || Array.isArray(value) || Object.keys(slots).length === 0)
    return false;
  return Object.entries(value as Record<string, unknown>).every(([key, media]) => {
    if (!(key in slots)) return false;
    const id =
      media && typeof media === "object" && "id" in media ? (media as { id: unknown }).id : media;
    return id === null || id === undefined || (Number.isInteger(id) && (id as number) > 0);
  });
}

export function validStructuralContent(scope: string, value: Record<string, unknown>): boolean {
  const defaults = (STRUCTURAL_DEFAULTS as Record<string, Record<string, Record<string, string>>>)[
    scope
  ];
  if (!defaults) return false;
  return (
    Object.entries(defaults).every(([section, fields]) => {
      const group = value[section];
      if (!group || typeof group !== "object" || Array.isArray(group)) return false;
      const data = group as Record<string, unknown>;
      return (
        Object.keys(data).every((key) => key in fields) &&
        Object.keys(fields).every(
          (key) => typeof data[key] === "string" && !!data[key].trim() && data[key].length <= 4000,
        )
      );
    }) &&
    validStructuralImages(scope, value.images) &&
    projectStructuralLists(scope, value.lists) !== null &&
    validCategorySeo(value.seo)
  );
}

/**
 * The scope's optional photographs, one upload per figure slot. Not localized: a photograph is the
 * same in every language, and the only text about it, its alt, is localized on the Media record.
 * Empty keeps the layout's built-in photograph, so no slot is required.
 */
function imageGroup(slug: string): Field[] {
  const slots = Object.entries(structuralImageSlots(slug));
  if (slots.length === 0) return [];
  return [
    {
      name: "images",
      type: "group",
      label: "Photographs",
      fields: slots.map(([name, label]): Field => ({
        name,
        label,
        type: "upload",
        relationTo: "media",
        localized: false,
        admin: { description: "Optional. Empty keeps the built-in photograph." },
      })),
    },
  ];
}

export const StructuralPages: GlobalConfig[] = Object.entries(STRUCTURAL_DEFAULTS).map(
  ([slug, sections]) => ({
    slug,
    admin: { group: "Website content" },
    access: { read: publishedForService, update: () => false, readVersions: editorOnly },
    versions: { drafts: true },
    fields: [
      ...Object.entries(sections).map(([name, fields]): Field => ({
        name,
        type: "group",
        label: name.replaceAll("_", " "),
        fields: Object.entries(fields as Record<string, string>).map(([key, fallback]): Field => ({
          name: key,
          label: fallback.length <= 80 ? fallback : key.replaceAll("_", " "),
          type: "textarea",
          localized: true,
          required: true,
          maxLength: 4000,
        })),
      })),
      ...imageGroup(slug),
      {
        name: "lists",
        type: "group",
        fields: Object.entries(structuralLists(slug)).map(([name, rows]): Field => ({
          name,
          type: "array",
          maxRows: rows.length,
          fields: [
            {
              name: "source",
              label: "Item",
              type: "select",
              required: true,
              options: rows.map((row) => ({
                label: Object.values(row).slice(1)[0] ?? row.source!,
                value: row.source!,
              })),
            },
            ...Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
              .filter((key) => key !== "source")
              .map((name): Field => ({ name, type: "textarea", localized: true, maxLength: 4000 })),
          ],
        })),
      },
      ...(slug === "header" || slug === "footer" ? [] : categorySeoFields),
    ],
  }),
);
