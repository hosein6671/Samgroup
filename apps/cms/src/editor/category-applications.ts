import type { Field } from "payload";
export const categoryApplicationsFields: Field[] = [
  {
    name: "useSharedFaq",
    label: "Use the shared FAQ library on this page",
    type: "checkbox",
    defaultValue: false,
  },
  {
    name: "useEditorialApplications",
    label: "Use the applications below instead of the current presentation",
    type: "checkbox",
    defaultValue: false,
  },
  {
    name: "applicationsHeading",
    label: "Applications heading",
    type: "text",
    localized: true,
    maxLength: 300,
  },
  {
    name: "applicationsIntro",
    label: "Applications introduction",
    type: "textarea",
    localized: true,
    maxLength: 3000,
  },
  {
    name: "applicationNotes",
    label: "Applications",
    type: "array",
    localized: true,
    maxRows: 20,
    fields: [
      { name: "title", type: "text", required: true, maxLength: 200 },
      { name: "description", type: "textarea", required: true, maxLength: 2000 },
    ],
  },
];
export function validCategoryApplications(fields: Record<string, unknown>): boolean {
  for (const key of ["useSharedFaq", "useEditorialApplications"])
    if (fields[key] !== undefined && typeof fields[key] !== "boolean") return false;
  for (const [key, limit] of [
    ["applicationsHeading", 300],
    ["applicationsIntro", 3000],
  ] as const) {
    const value = fields[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || value.length > limit)
    )
      return false;
  }
  const rows = fields.applicationNotes;
  if (rows === undefined || rows === null) return true;
  return (
    Array.isArray(rows) &&
    rows.length <= 20 &&
    rows.every((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      return (
        Object.keys(row).every((key) => ["id", "title", "description"].includes(key)) &&
        (row.id === undefined || typeof row.id === "string") &&
        typeof row.title === "string" &&
        !!row.title.trim() &&
        row.title.length <= 200 &&
        typeof row.description === "string" &&
        !!row.description.trim() &&
        row.description.length <= 2000
      );
    })
  );
}
