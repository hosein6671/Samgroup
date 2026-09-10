import type { ProductEditorialSections } from "@sam-group/types";

/** Project explicit public fields; never spread stored draft/receipt metadata. */
export function productEditorialSections(value: unknown): ProductEditorialSections {
  const fields =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const points = (input: unknown): ProductEditorialSections["applications"] =>
    Array.isArray(input)
      ? input.slice(0, 20).flatMap((item: unknown) => {
          if (
            !item ||
            typeof item !== "object" ||
            !("title" in item) ||
            !("description" in item) ||
            typeof item.title !== "string" ||
            typeof item.description !== "string" ||
            !item.title.trim() ||
            !item.description.trim()
          )
            return [];
          return [{ title: item.title, description: item.description }];
        })
      : [];
  const faq = Array.isArray(fields.faq)
    ? fields.faq.slice(0, 20).flatMap((item: unknown) => {
        if (
          !item ||
          typeof item !== "object" ||
          !("question" in item) ||
          !("answer" in item) ||
          typeof item.question !== "string" ||
          typeof item.answer !== "string" ||
          !item.question.trim() ||
          !item.answer.trim()
        )
          return [];
        return [{ question: item.question, answer: item.answer }];
      })
    : [];
  return { applications: points(fields.applications), features: points(fields.features), faq };
}
