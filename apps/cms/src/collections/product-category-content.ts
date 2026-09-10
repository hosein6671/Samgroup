import type { CollectionConfig, Field } from "payload";
import { editorOnly, publishedForService } from "../access";

export const CATEGORY_KEYS = [
  "base-oils",
  "engine-oils-automotive-lubricants",
  "industrial-oils-lubricants",
  "lubricant-additives",
  "marine-oils-lubricants",
  "antifreeze-coolants",
];

// Ordinary narrative only. Taxonomy, test methods and technical approvals remain code/catalog owned.
export const categoryTextFields: Field[] = [
  ["heroTitle", "Hero title", 300],
  ["heroSupportingText", "Hero supporting text", 2000],
  ["overviewHeading", "Overview heading", 300],
  ["overviewText", "Overview paragraphs (separate with a blank line)", 10000],
  ["qualityHeading", "Quality heading", 300],
  ["qualityIntro", "Quality introduction", 5000],
  ["supplyHeading", "Packaging and supply heading", 300],
  ["packagingSupplyText", "Packaging and supply introduction", 5000],
  ["supplyTerms", "Supply terms narrative", 5000],
  ["documentationHeading", "Documentation heading", 300],
  ["documentationIntro", "Documentation introduction", 5000],
  ["documentationNote", "Documentation note", 5000],
].map(([name, label, maxLength]) => ({
  name: String(name),
  label: String(label),
  type: "textarea",
  localized: true,
  required: true,
  maxLength: Number(maxLength),
  validate: (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 ? true : "Enter non-empty text.",
}));

export const ProductCategoryContent: CollectionConfig = {
  slug: "product-category-content",
  access: {
    read: publishedForService,
    readVersions: editorOnly,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: {
    useAsTitle: "categoryKey",
    description:
      "Edit through the website Admin to preserve revision checks and activity receipts.",
  },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    {
      name: "categoryKey",
      type: "select",
      options: CATEGORY_KEYS,
      required: true,
      unique: true,
      index: true,
    },
    ...categoryTextFields,
  ],
};
