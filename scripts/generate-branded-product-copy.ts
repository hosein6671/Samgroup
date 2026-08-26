#!/usr/bin/env tsx
import { readFile, writeFile } from "node:fs/promises";

type ResearchProduct = {
  sourceRef: string;
  currentName: string;
  familyKey: string | null;
  productTypeKey: string | null;
  gradeLabels: string[];
  conflictCount: number;
  withheldFactCount: number;
  contentCandidate: {
    descriptor: string | null;
    api: string | null;
    sae: string | null;
    publicationBlockedUntilTechnicalApproval: boolean;
  };
  official: { feature?: string | null } | null;
};

type Register = { generatedAt: string; inputManifestHash: string; products: ResearchProduct[] };

const FAMILY: Record<string, { label: string; context: string }> = {
  "engine-oils-automotive-lubricants": {
    label: "Engine Oils & Automotive Lubricants",
    context: "automotive lubricant range",
  },
  "industrial-oils-lubricants": {
    label: "Industrial Oils & Lubricants",
    context: "industrial lubricant range",
  },
  "marine-oils-lubricants": {
    label: "Marine Oils & Lubricants",
    context: "marine lubricant range",
  },
  "lubricant-additives": {
    label: "Lubricant Additives & Components",
    context: "lubricant additive range",
  },
  "antifreeze-coolants": {
    label: "Antifreeze & Coolants",
    context: "coolant range",
  },
};

const TYPE: Record<string, string> = {
  "engine-oils": "engine oil",
  "industrial-oils": "industrial lubricant",
  "gear-oils": "gear and transmission lubricant",
  "hydraulic-oils": "hydraulic oil",
  "marine-oils": "marine lubricant",
  "lubricant-additives": "lubricant additive",
  "antifreeze-coolants": "antifreeze and coolant product",
  greases: "lubricating grease",
};

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required.`);
  return value;
}

function cleanDescriptor(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\b(premium|super|high[- ]performance)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—,:;\s]+|[-–—,:;\s]+$/g, "")
    .trim();
  return cleaned ? cleaned.toLowerCase() : null;
}

function gradeSentence(grades: string[]): string | null {
  if (grades.length === 0) return null;
  if (grades.length === 1) return `The recorded grade is ${grades[0]}.`;
  if (grades.length <= 5) return `Recorded grades: ${grades.join(", ")}.`;
  return `The recorded range contains ${String(grades.length)} grades; review the grade table for the complete list.`;
}

function summary(product: ResearchProduct): string {
  const type = TYPE[product.productTypeKey ?? ""] ?? "lubricant product";
  const descriptor = cleanDescriptor(
    product.official?.feature ?? product.contentCandidate.descriptor,
  );
  const family = FAMILY[product.familyKey ?? ""]?.context ?? "product portfolio";
  const first = descriptor
    ? `${product.currentName} is presented as ${descriptor} within the ${family}.`
    : `${product.currentName} is listed as a ${type} within the ${family}.`;
  const grade = gradeSentence(product.gradeLabels);
  return grade ? `${first} ${grade}` : first;
}

function metaDescription(product: ResearchProduct): string {
  const type = TYPE[product.productTypeKey ?? ""] ?? "lubricant product";
  const description = `Review ${product.currentName}, a ${type} in the SAM Group range. See recorded grades, available technical data, and enquiry options.`;
  if (description.length <= 160) return description;
  const shortened = `Review ${product.currentName} in the SAM Group range. See recorded grades, technical data, and enquiry options.`;
  if (shortened.length <= 160) return shortened;
  return `${shortened.slice(0, 156).trimEnd()}…`;
}

async function main(): Promise<void> {
  const input = argument("--input");
  const output = argument("--output");
  const register = JSON.parse(await readFile(input, "utf8")) as Register;
  const products = register.products.map((product) => ({
    sourceRef: product.sourceRef,
    productName: product.currentName,
    familyKey: product.familyKey,
    productTypeKey: product.productTypeKey,
    locale: "en",
    cardSummary: summary(product),
    pageIntroduction: `${summary(product)} Use the technical table and available product documents to compare the recorded information with the intended application and operating requirement.`,
    selectionNote:
      "Confirm the required grade, specification, test method, and equipment recommendation before purchase. Typical values support initial evaluation and are not contractual limits unless the applicable document states otherwise.",
    documentPrompt:
      "Name the product and grade when requesting a TDS, SDS, or other available technical document.",
    primaryCta: "Request a quote",
    secondaryCta: "Talk to technical sales",
    seo: {
      title: `${product.currentName} | SAM Group`,
      description: metaDescription(product),
    },
    review: {
      status:
        product.conflictCount > 0 || product.withheldFactCount > 0
          ? "data_review_required"
          : "technical_approval_required",
      conflictCount: product.conflictCount,
      withheldFactCount: product.withheldFactCount,
      publicationBlocked: true,
      noFormulationChange: true,
      noNewTechnicalClaim: true,
    },
  }));

  const result = {
    generatedAt: new Date().toISOString(),
    sourceRegisterGeneratedAt: register.generatedAt,
    inputManifestHash: register.inputManifestHash,
    brandSystem: "docs/content/site-copy/BRAND_VOICE_AND_MESSAGING.md",
    policy: {
      englishIsSemanticMaster: true,
      sourcesAreInternalOnly: true,
      publicationRequiresTechnicalApproval: true,
      descriptionsDoNotChangeFormulation: true,
    },
    counts: {
      products: products.length,
      dataReviewRequired: products.filter((item) => item.review.status === "data_review_required")
        .length,
      technicalApprovalRequired: products.filter(
        (item) => item.review.status === "technical_approval_required",
      ).length,
    },
    products,
  };

  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
