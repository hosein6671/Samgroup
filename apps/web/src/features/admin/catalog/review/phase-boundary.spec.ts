import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** Phase C permits one decision path while retaining every provenance and browser boundary. */
const FEATURE_DIR = fileURLToPath(new URL(".", import.meta.url));
const ROUTE_DIR = fileURLToPath(
  new URL("../../../../app/(admin)/admin/catalog/review", import.meta.url),
);

function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function walk(
  directory: string,
  found: { path: string; source: string }[] = [],
): { path: string; source: string }[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".spec.")) {
      found.push({ path, source: codeOf(readFileSync(path, "utf8")) });
    }
  }
  return found;
}

const FILES = walk(FEATURE_DIR).concat(walk(ROUTE_DIR));
const file = (name: string): { path: string; source: string } | undefined =>
  FILES.find(({ path }) => path.endsWith(name));

describe("Phase C has exactly one narrow decision path", () => {
  it("keeps the POST in the server-only API module", () => {
    const api = file("review-api.ts");
    expect(api?.source).toMatch(/^import ["']server-only["'];/m);
    expect(api?.source).toContain("apiPost");
    expect(api?.source).toContain("/decisions");

    for (const { path, source } of FILES) {
      if (path.endsWith("review-api.ts")) continue;
      expect(source, path).not.toMatch(/\bapiPost\b|\bapiPatch\b|\bapiPut\b|\bapiDelete\b/);
      expect(source, path).not.toContain("/decisions");
    }
  });

  it("has one Server Action and one decision form", () => {
    const action = file("decision-actions.ts");
    const control = file("decision-control.tsx");
    expect(action?.source).toMatch(/^\s*["']use server["']/m);
    expect(control?.source).toMatch(/^\s*["']use client["']/m);
    expect(control?.source.match(/<form\b/g)).toHaveLength(1);
    expect(control?.source).toContain("submitReviewDecision");

    for (const { path, source } of FILES) {
      if (path.endsWith("decision-actions.ts") || path.endsWith("decision-control.tsx")) continue;
      expect(source, path).not.toMatch(/^\s*["']use server["']/m);
      expect(source, path).not.toMatch(/<form\b/);
    }
  });

  it("submits comparison values and exposes no generic status write", () => {
    const control = file("decision-control.tsx");
    const action = file("decision-actions.ts");
    expect(control?.source).toContain('name="expectedEvidenceSetHash"');
    expect(control?.source).toContain('name="expectedReviewStatus"');
    expect(action?.source).toContain("expectedEvidenceSetHash");
    expect(action?.source).toContain("expectedReviewStatus");

    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/name=["']reviewStatus["']/);
      expect(source, path).not.toMatch(/\bapiPatch\b|\bapiPut\b|\bapiDelete\b/);
    }
  });

  it("offers no bulk decision and no supersede decision", () => {
    expect(file("decision-actions.ts")?.source).not.toMatch(
      /DECISIONS[^;]*["']supersede(?:d)?["']/s,
    );
    expect(file("decision-control.tsx")?.source).not.toMatch(/TARGET_STATUS[^;]*supersede/s);
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/bulk.*decision|decision.*bulk/i);
    }
  });
});

describe("provenance remains display-only", () => {
  it("creates no document link, proxy, embed or preview", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/<a\b|<iframe\b|<embed\b|<object\b|window\.open/);
      expect(source, path).not.toMatch(/href=\{[^}]*(locator|document|asset|sha256)/i);
      expect(source, path).not.toMatch(/["'`]https?:\/\//);
    }
  });

  it("keeps sourceRef out of URL and form state", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/href=\{[^}]*sourceRef/);
      expect(source, path).not.toMatch(/name=["']sourceRef["']/);
      expect(source, path).not.toMatch(/URLSearchParams[^\n]*sourceRef/);
    }
  });
});

describe("credentials and protected data stay server-side", () => {
  it("uses no browser storage, cookie or direct fetch", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
      expect(source, path).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|API_INTERNAL_URL/);
    }
  });

  it("keeps tokens out of every client and route component", () => {
    for (const { path, source } of FILES) {
      if (path.endsWith("review-api.ts")) continue;
      expect(source, path).not.toMatch(/accessToken|refreshToken/);
    }
  });
});

describe("review routes remain dynamic and non-prerendered", () => {
  it("marks all three pages dynamic with no static params", () => {
    const pages = FILES.filter(({ path }) => path.endsWith("page.tsx"));
    expect(pages).toHaveLength(3);
    for (const { path, source } of pages) {
      expect(source, path).toMatch(/export const dynamic = ["']force-dynamic["'];/);
      expect(source, path).toMatch(/export const revalidate = 0;/);
      expect(source, path).not.toContain("generateStaticParams");
    }
  });
});
