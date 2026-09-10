import { test } from "node:test";
import assert from "node:assert/strict";
import { FaqEntries, validFaqFields } from "./collections/faq-entries";
import { validCategoryApplications } from "./editor/category-applications";

const valid = {
  question: "Which document should I request?",
  answer: "Request the relevant technical document.",
  topic: "products",
  relatedCategoryKeys: ["base-oils", "lubricant-additives"],
  showOnContactPage: false,
  sortOrder: 0,
};
test("one FAQ may target several known families without copying the answer", () => {
  assert.equal(validFaqFields(valid), true);
  for (const patch of [
    { question: " " },
    { answer: "x".repeat(8001) },
    { relatedCategoryKeys: ["unknown"] },
    { relatedCategoryKeys: ["base-oils", "base-oils"] },
    { sortOrder: 0.5 },
    { topic: "other" },
    { showOnContactPage: "true" },
  ])
    assert.equal(validFaqFields({ ...valid, ...patch }), false);
});
test("direct FAQ mutation is denied, including deletion", () => {
  for (const operation of ["create", "update", "delete"] as const) {
    const access = FaqEntries.access?.[operation];
    assert.ok(access);
    assert.equal(access({} as never), false);
  }
});
test("applications are bounded and omission preserves old editor compatibility", () => {
  assert.equal(validCategoryApplications({}), true);
  assert.equal(
    validCategoryApplications({
      useSharedFaq: true,
      useEditorialApplications: true,
      applicationNotes: [],
    }),
    true,
  );
  assert.equal(
    validCategoryApplications({
      applicationNotes: [{ title: "Application", description: "Description" }],
    }),
    true,
  );
  for (const value of [
    { useSharedFaq: "true" },
    { applicationNotes: [[{ title: "bad" }]] },
    { applicationNotes: [{ title: "Valid", description: "Text", approved: true }] },
    { applicationNotes: Array(21).fill({ title: "A", description: "B" }) },
  ])
    assert.equal(validCategoryApplications(value), false);
});
