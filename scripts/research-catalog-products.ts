#!/usr/bin/env tsx
import { readFile, writeFile } from "node:fs/promises";

type ManifestRow = {
  sourceRef: string;
  rowNumber: number;
  publicProductName: string;
  proposedProductFamilyKey: string | null;
  proposedProductTypeKey: string | null;
  sourceType: string;
  sourceLocator: string;
  gradeCandidates: Array<{ label: string }>;
  specificationCandidates: unknown[];
  withheldSourceFacts: unknown[];
  claimCandidates: unknown[];
  conflictsByCategory: Record<string, number>;
  reviewStatus: string;
};

type Manifest = { manifestHash: string; rows: ManifestRow[] };

const ALLOWED_HOSTS = new Set(["kingpowerlub.com", "addilex.com"]);

const FAMILY_LABELS: Record<string, string> = {
  "engine-oils-automotive-lubricants": "automotive lubricants",
  "industrial-oils-lubricants": "industrial lubricants",
  "marine-oils-lubricants": "marine lubricants",
  "lubricant-additives": "lubricant additives",
  "antifreeze-coolants": "antifreeze and coolants",
};

const TYPE_LABELS: Record<string, string> = {
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

function decodeText(value: string): string {
  return value
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/Â»/g, "»")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAddilexTitle(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s*»\s*ADDILEX\s*$/i, "").trim() || null;
}

function sentenceCase(value: string): string {
  const normalized = value.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return normalized ? normalized[0]!.toUpperCase() + normalized.slice(1) : normalized;
}

function copyDraft(
  row: ManifestRow,
  official: Record<string, string | null> | null,
  draftingStatus: "needs_data_review_before_copy" | "ready_for_copy_draft",
): Record<string, unknown> | null {
  if (draftingStatus !== "ready_for_copy_draft") return null;
  const family = FAMILY_LABELS[row.proposedProductFamilyKey ?? ""] ?? "lubricants";
  const type = TYPE_LABELS[row.proposedProductTypeKey ?? ""] ?? "lubricant product";
  const descriptor = official?.feature ? sentenceCase(official.feature) : null;
  const gradeLabels = row.gradeCandidates.map((grade) => grade.label);
  const gradeClause =
    gradeLabels.length === 0
      ? ""
      : gradeLabels.length === 1
        ? ` The recorded grade is ${gradeLabels[0]}.`
        : ` The range includes ${String(gradeLabels.length)} recorded grades.`;
  const summary = descriptor
    ? `Official product metadata describes ${row.publicProductName} as “${descriptor}”. It is listed in the ${family} portfolio.${gradeClause}`
    : `${row.publicProductName} is catalogued as a ${type} in the ${family} portfolio.${gradeClause}`;

  return {
    locale: "en",
    summary,
    selectionNote:
      "Review the approved technical table and available grades to confirm suitability for the intended equipment and operating conditions.",
    primaryCta: "Request product information",
    secondaryCta: "Discuss supply requirements",
    prohibitedClaimsAdded: false,
    translationStatus: { fa: "not_started", ar: "not_started" },
  };
}

function embedded(html: string, key: string): string | null {
  const normalized = html.replace(/\\"/g, '"');
  const match = normalized.match(new RegExp(`"${key}":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`));
  return match?.[1] ? decodeText(match[1]) : null;
}

function meta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
  );
  const second = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  );
  return decodeText(first?.[1] ?? second?.[1] ?? "") || null;
}

async function officialMetadata(locator: string): Promise<Record<string, string | null>> {
  const url = new URL(locator);
  if (!ALLOWED_HOSTS.has(url.hostname))
    throw new Error(`Refusing non-official host: ${url.hostname}`);
  const response = await fetch(url, {
    headers: { "user-agent": "SAM-Platform-catalog-research/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Official page answered HTTP ${response.status}`);
  const html = await response.text();

  if (url.hostname === "kingpowerlub.com") {
    const api = embedded(html, "api");
    const sae = embedded(html, "sae");
    const feature = embedded(html, "productFeature");
    const line = embedded(html, "tech");
    return {
      officialName: [line, api, sae].filter(Boolean).join(" ") || null,
      api,
      sae,
      feature,
      line,
      pageTitle: meta(html, "og:title") ?? meta(html, "title"),
    };
  }

  return {
    officialName: cleanAddilexTitle(meta(html, "og:title") ?? meta(html, "twitter:title")),
    api: null,
    sae: null,
    feature: meta(html, "og:description") ?? meta(html, "description"),
    line: null,
    pageTitle: meta(html, "og:title"),
  };
}

async function main(): Promise<void> {
  const input = argument("--manifest");
  const output = argument("--output");
  const manifest = JSON.parse(await readFile(input, "utf8")) as Manifest;
  const records = [];

  for (const [index, row] of manifest.rows.entries()) {
    const isOfficialWeb = row.sourceLocator.startsWith("https://");
    let official: Record<string, string | null> | null = null;
    let researchStatus = isOfficialWeb ? "official_web_pending" : "supplied_catalogue";
    let researchError: string | null = null;

    if (isOfficialWeb) {
      try {
        official = await officialMetadata(row.sourceLocator);
        researchStatus = "official_web_verified";
      } catch (error: unknown) {
        researchStatus = "official_web_unavailable";
        researchError = error instanceof Error ? error.message : String(error);
      }
    }

    const draftingStatus =
      Object.values(row.conflictsByCategory).some((value) => value > 0) ||
      row.withheldSourceFacts.length > 0
        ? "needs_data_review_before_copy"
        : "ready_for_copy_draft";

    records.push({
      sourceRef: row.sourceRef,
      workbookRow: row.rowNumber,
      currentName: row.publicProductName,
      familyKey: row.proposedProductFamilyKey,
      productTypeKey: row.proposedProductTypeKey,
      gradeLabels: row.gradeCandidates.map((grade) => grade.label),
      specificationCount: row.specificationCandidates.length,
      withheldFactCount: row.withheldSourceFacts.length,
      claimCount: row.claimCandidates.length,
      conflictCount: Object.values(row.conflictsByCategory).reduce((sum, value) => sum + value, 0),
      reviewStatus: row.reviewStatus,
      contentCandidate: {
        title: row.publicProductName,
        descriptor: official?.feature ?? null,
        api: official?.api ?? null,
        sae: official?.sae ?? null,
        officialSeriesLabel: official?.line ?? null,
        draftingStatus,
        publicationBlockedUntilTechnicalApproval: true,
      },
      copyDraft: copyDraft(row, official, draftingStatus),
      researchStatus,
      official,
      researchError,
    });
    process.stderr.write(`\rresearched ${String(index + 1)}/${String(manifest.rows.length)}`);
  }

  const register = {
    generatedAt: new Date().toISOString(),
    inputManifestHash: manifest.manifestHash,
    policy: {
      officialWebHosts: [...ALLOWED_HOSTS],
      hsbBasis: "supplied printed catalogue already transcribed in the repository",
      sourceDisplay: "internal research only; never a public-site field",
      formulationChanges: false,
      uncertainFacts: "remain withheld",
    },
    counts: {
      products: records.length,
      officialWebVerified: records.filter(
        (record) => record.researchStatus === "official_web_verified",
      ).length,
      officialWebUnavailable: records.filter(
        (record) => record.researchStatus === "official_web_unavailable",
      ).length,
      suppliedCatalogue: records.filter((record) => record.researchStatus === "supplied_catalogue")
        .length,
    },
    products: records,
  };
  await writeFile(output, `${JSON.stringify(register, null, 2)}\n`, "utf8");
  process.stderr.write("\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
