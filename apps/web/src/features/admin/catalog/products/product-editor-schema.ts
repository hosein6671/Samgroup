import type { EditorField } from "../../content/content-form";

export const PRODUCT_EDITOR_SCHEMA: EditorField[] = [
  { name: "name", label: "Product name", type: "text" },
  { name: "description", label: "Product description", type: "textarea" },
  {
    name: "applications",
    label: "Applications",
    type: "array",
    fields: [
      { name: "title", label: "Application title", type: "text" },
      { name: "description", label: "Application description", type: "textarea" },
    ],
  },
  {
    name: "features",
    label: "Features",
    type: "array",
    fields: [
      { name: "title", label: "Feature title", type: "text" },
      { name: "description", label: "Feature description", type: "textarea" },
    ],
  },
  {
    name: "faq",
    label: "Frequently asked questions",
    type: "array",
    fields: [
      { name: "question", label: "Question", type: "text" },
      { name: "answer", label: "Answer", type: "textarea" },
    ],
  },
  {
    name: "seo",
    label: "Search and social appearance",
    type: "group",
    fields: [
      { name: "metaTitle", label: "Search title", type: "text" },
      { name: "metaDescription", label: "Search description", type: "textarea" },
      { name: "canonicalUrl", label: "Canonical URL (optional HTTPS address)", type: "text" },
      { name: "ogTitle", label: "Social sharing title", type: "text" },
      { name: "ogDescription", label: "Social sharing description", type: "textarea" },
      { name: "twitterTitle", label: "Twitter title", type: "text" },
      { name: "twitterDescription", label: "Twitter description", type: "textarea" },
      {
        name: "twitterCardType",
        label: "Twitter card",
        type: "select",
        options: [
          { label: "Summary", value: "summary" },
          { label: "Large image", value: "summary_large_image" },
        ],
      },
      { name: "robotsIndex", label: "Allow search indexing", type: "checkbox" },
      { name: "robotsFollow", label: "Allow following links", type: "checkbox" },
      { name: "keywords", label: "Keywords (one per line)", type: "stringArray" },
    ],
  },
];
