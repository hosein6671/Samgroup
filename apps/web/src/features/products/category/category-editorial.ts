import type { ProductCategoryContent } from "./category-contract";

/** Same projection initializes the editor and overlays published narrative. */
export function categoryEditorDefaults(content: ProductCategoryContent): Record<string, unknown> {
  return {
    useSharedFaq: false,
    useEditorialApplications: false,
    applicationsHeading: content.applications?.heading ?? "Applications",
    applicationsIntro: content.applications?.intro ?? "",
    applicationNotes: [],
    heroTitle: content.hero.headline,
    heroSupportingText: content.hero.lead,
    overviewHeading: content.overview.heading,
    overviewText: content.overview.body.join("\n\n"),
    qualityHeading: content.quality.heading,
    qualityIntro: content.quality.intro,
    supplyHeading: content.supply.heading,
    packagingSupplyText: content.supply.intro,
    supplyTerms: content.supply.terms,
    documentationHeading: content.documentation.heading,
    documentationIntro: content.documentation.intro,
    documentationNote: content.documentation.note,
  };
}

export function overlayCategoryEditorial(
  content: ProductCategoryContent,
  value: Record<string, unknown>,
): ProductCategoryContent {
  const text = (key: string, fallback: string): string =>
    typeof value[key] === "string" && value[key].trim() ? value[key] : fallback;
  return {
    ...content,
    ...(value.useEditorialApplications === true
      ? {
          applications:
            Array.isArray(value.applicationNotes) && value.applicationNotes.length > 0
              ? {
                  mode: "editorial" as const,
                  eyebrow: "Applications",
                  heading: text("applicationsHeading", "Applications"),
                  intro: text("applicationsIntro", ""),
                  notes: value.applicationNotes.filter(
                    (row): row is { title: string; description: string } =>
                      !!row &&
                      typeof row === "object" &&
                      typeof row.title === "string" &&
                      typeof row.description === "string",
                  ),
                }
              : undefined,
        }
      : {}),
    hero: {
      ...content.hero,
      headline: text("heroTitle", content.hero.headline),
      lead: text("heroSupportingText", content.hero.lead),
    },
    overview: {
      ...content.overview,
      heading: text("overviewHeading", content.overview.heading),
      body: text("overviewText", content.overview.body.join("\n\n"))
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean),
    },
    quality: {
      ...content.quality,
      heading: text("qualityHeading", content.quality.heading),
      intro: text("qualityIntro", content.quality.intro),
    },
    supply: {
      ...content.supply,
      heading: text("supplyHeading", content.supply.heading),
      intro: text("packagingSupplyText", content.supply.intro),
      terms: text("supplyTerms", content.supply.terms),
    },
    documentation: {
      ...content.documentation,
      heading: text("documentationHeading", content.documentation.heading),
      intro: text("documentationIntro", content.documentation.intro),
      note: text("documentationNote", content.documentation.note),
    },
  };
}
