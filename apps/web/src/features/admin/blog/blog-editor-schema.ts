import type { EditorField } from "../content/content-form";

type Reference = { id: string; name: string };

export function blogEditorSchema(categories: Reference[], tags: Reference[]): EditorField[] {
  return [
    { name: "title", label: "Article title", type: "text" },
    { name: "slug", label: "URL slug", type: "text" },
    { name: "content", label: "Article content", type: "textarea" },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      options: categories.map((item) => ({ label: item.name, value: item.id })),
    },
    {
      name: "tagIds",
      label: "Tags",
      type: "select",
      hasMany: true,
      options: tags.map((item) => ({ label: item.name, value: item.id })),
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
}
