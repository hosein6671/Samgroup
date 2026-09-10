import type { GlobalConfig } from "payload";
import { editorOnly, publishedForService } from "../access";
import { categorySeoFields, validCategorySeo } from "../editor/category-seo";

export const faqPageTextLimits: Record<string, number> = {
  eyebrow: 150,
  title: 300,
  introduction: 3000,
  questionsHeading: 300,
  contactHeading: 300,
  contactText: 3000,
  contactLabel: 150,
};
export function validFaqPage(fields: Record<string, unknown>): boolean {
  return (
    Object.entries(faqPageTextLimits).every(
      ([key, max]) =>
        typeof fields[key] === "string" && !!fields[key].trim() && fields[key].length <= max,
    ) && validCategorySeo(fields.seo)
  );
}
export const FaqPage: GlobalConfig = {
  slug: "faq-page",
  access: { read: publishedForService, update: () => false, readVersions: editorOnly },
  versions: { drafts: true },
  fields: [
    ...Object.entries(faqPageTextLimits).map(([name, maxLength]) => ({
      name,
      type: "textarea" as const,
      required: true,
      localized: true,
      maxLength,
    })),
    ...categorySeoFields,
  ],
};
