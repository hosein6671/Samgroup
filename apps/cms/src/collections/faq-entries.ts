import type { CollectionConfig, Field } from "payload";
import { editorOnly, publishedForService } from "../access";
import { CATEGORY_KEYS } from "./product-category-content";

export const FAQ_TOPICS = [
  { value: "company", label: "About the Company" },
  { value: "products", label: "Products & Specifications" },
  { value: "ordering", label: "Ordering & Samples" },
  { value: "export", label: "Export & Logistics" },
  { value: "customization", label: "Customization & Private Label" },
];
export const faqFields: Field[] = [
  { name: "question", type: "text", required: true, localized: true, maxLength: 300 },
  {
    name: "answer",
    label: "Answer (plain paragraphs)",
    type: "textarea",
    required: true,
    localized: true,
    maxLength: 8000,
  },
  { name: "topic", type: "select", required: true, options: FAQ_TOPICS, defaultValue: "products" },
  {
    name: "relatedCategoryKeys",
    label: "Show in these product categories",
    type: "select",
    hasMany: true,
    options: CATEGORY_KEYS.map((value) => ({ value, label: value.replaceAll("-", " ") })),
  },
  {
    name: "showOnContactPage",
    label: "Available for the Contact FAQ",
    type: "checkbox",
    defaultValue: false,
  },
  {
    name: "sortOrder",
    label: "Display order (lower numbers first)",
    type: "number",
    min: 0,
    max: 10000,
    defaultValue: 0,
    required: true,
  },
];

export function validFaqFields(fields: Record<string, unknown>): boolean {
  return (
    typeof fields.question === "string" &&
    !!fields.question.trim() &&
    fields.question.length <= 300 &&
    typeof fields.answer === "string" &&
    !!fields.answer.trim() &&
    fields.answer.length <= 8000 &&
    FAQ_TOPICS.some((topic) => topic.value === fields.topic) &&
    Array.isArray(fields.relatedCategoryKeys) &&
    fields.relatedCategoryKeys.length <= 6 &&
    new Set(fields.relatedCategoryKeys).size === fields.relatedCategoryKeys.length &&
    fields.relatedCategoryKeys.every(
      (key) => typeof key === "string" && CATEGORY_KEYS.includes(key),
    ) &&
    typeof fields.showOnContactPage === "boolean" &&
    Number.isInteger(fields.sortOrder) &&
    Number(fields.sortOrder) >= 0 &&
    Number(fields.sortOrder) <= 10000
  );
}

export const FaqEntries: CollectionConfig = {
  slug: "faq-entries",
  access: {
    read: publishedForService,
    readVersions: editorOnly,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: { useAsTitle: "question", description: "Edit shared answers through the website Admin." },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    { name: "entryKey", type: "text", required: true, unique: true, index: true },
    ...faqFields,
  ],
};
