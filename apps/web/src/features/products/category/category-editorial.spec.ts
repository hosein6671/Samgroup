import { describe, expect, it } from "vitest";
import { getCategoryContent } from "./data";
import { categoryEditorDefaults, overlayCategoryEditorial } from "./category-editorial";

describe("category narrative boundary", () => {
  const content = getCategoryContent("base-oils")!;
  it("round trips current copy while retaining taxonomy and technical content", () => {
    expect(overlayCategoryEditorial(content, categoryEditorDefaults(content))).toEqual(content);
  });
  it("changes ordinary text only and preserves structural references", () => {
    const changed = overlayCategoryEditorial(content, {
      heroTitle: "New title",
      overviewText: "First\n\nSecond",
      range: {},
      familyId: "other",
      meta: {},
    });
    expect(changed.hero.headline).toBe("New title");
    expect(changed.overview.body).toEqual(["First", "Second"]);
    for (const key of ["range", "properties", "faq", "meta", "familyId"] as const)
      expect(changed[key]).toBe(content[key]);
  });
  it("keeps existing text on null, malformed or blank fields", () => {
    expect(
      overlayCategoryEditorial(content, { heroTitle: null, overviewText: [], supplyTerms: " " }),
    ).toEqual(content);
  });
  it("requires explicit opt-in before replacing applications and permits hiding the section", () => {
    const fields = {
      applicationNotes: [{ title: "Blending", description: "Discuss your requirements." }],
    };
    expect(overlayCategoryEditorial(content, fields).applications).toBe(content.applications);
    expect(
      overlayCategoryEditorial(content, { ...fields, useEditorialApplications: true }).applications,
    ).toMatchObject({ mode: "editorial", notes: fields.applicationNotes });
    expect(
      overlayCategoryEditorial(content, { useEditorialApplications: true, applicationNotes: [] })
        .applications,
    ).toBeUndefined();
  });
});
