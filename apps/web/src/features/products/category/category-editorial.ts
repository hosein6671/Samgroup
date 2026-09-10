import type { ProductCategoryContent } from "./category-contract";

/** Same projection initializes the editor and overlays published narrative. */
export function categoryEditorDefaults(content: ProductCategoryContent): Record<string, string> {
  return {
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
