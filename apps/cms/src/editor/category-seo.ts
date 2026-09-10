import type { Field } from "payload";
import { seoFields } from "../fields/seo";

const textLimits: Record<string, number> = {
  metaTitle: 200,
  metaDescription: 1000,
  ogTitle: 200,
  ogDescription: 1000,
  twitterTitle: 200,
  twitterDescription: 1000,
  canonicalUrl: 2048,
};
const names = new Set([
  ...Object.keys(textLimits),
  "twitterCardType",
  "robotsIndex",
  "robotsFollow",
  "keywords",
]);

export const categorySeoFields: Field[] = seoFields().map((group) =>
  group.type === "group"
    ? { ...group, fields: group.fields.filter((field) => "name" in field && names.has(field.name)) }
    : group,
);

export function validCategorySeo(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (!names.has(key)) return false;
    if (key in textLimits) {
      if (entry === null || entry === "") return true;
      if (typeof entry !== "string" || entry.length > textLimits[key]!) return false;
      if (key !== "canonicalUrl") return true;
      try {
        const url = new URL(entry);
        return url.protocol === "https:" && !url.username && !url.password && !url.hash;
      } catch {
        return false;
      }
    }
    if (key === "robotsIndex" || key === "robotsFollow") return typeof entry === "boolean";
    if (key === "keywords" && entry === null) return true;
    if (key === "twitterCardType") return entry === "summary" || entry === "summary_large_image";
    return (
      Array.isArray(entry) &&
      entry.length <= 30 &&
      entry.every((word) => typeof word === "string" && !!word.trim() && word.length <= 100)
    );
  });
}
