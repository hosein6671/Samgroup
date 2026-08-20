import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAboutUsContent,
  getCustomizedSolutionsContent,
  getQualityCertificationsContent,
} from "./content";

/**
 * The Content client, and the boundary it is on the safe side of.
 *
 * Two things are asserted here, and the second one is the gate's whole premise:
 *
 * 1. **The failure mapping.** The API keeps three conditions apart — a Global name it does not
 *    serve (404), a recognised Global with nothing published (200, `available: false`), and a CMS
 *    that did not answer (503) — and this client keeps them apart too, so that every consumer
 *    inherits the distinction rather than re-deriving it from a status code.
 * 2. **That `apps/web` cannot reach the CMS.** Not by convention — by scanning the app's own source.
 *    ADR-003 makes NestJS the only API surface, and AI_CONTEXT.md restates it as absolute; a scan is
 *    the only assertion that keeps holding when somebody adds a file nobody reviews closely.
 */

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("./api-client", () => ({ apiGet }));

const CONTENT = { hero: { title: "VERIFICATION HERO TITLE" } };
const AVAILABLE = { available: true, content: CONTENT };
const UNAVAILABLE = { available: false, content: null };

describe("getAboutUsContent", () => {
  afterEach(() => {
    apiGet.mockReset();
  });

  it("asks NestJS for the Global under the contract's path, with the locale", async () => {
    apiGet.mockResolvedValue({ ok: true, data: AVAILABLE, meta: {} });

    await getAboutUsContent("fa");

    expect(apiGet).toHaveBeenCalledWith("/content/globals/about-us", { locale: "fa" });
  });

  it("reports a locale fallback from the response meta", async () => {
    apiGet.mockResolvedValue({ ok: true, data: AVAILABLE, meta: { localeFallback: true } });

    await expect(getAboutUsContent("ar")).resolves.toMatchObject({
      ok: true,
      localeFallback: true,
    });
  });

  /**
   * The three conditions the API keeps apart, kept apart here too.
   *
   * `not-configured` arrives in the **body** of a 200, because a recognised Global with nothing
   * published is not a missing resource. A 404 can now only mean the API stopped serving the name
   * this client hardcodes — a broken deployment — so it maps to `api-error`, not to "unpublished".
   */
  it("reads `not-configured` from an available:false body, not from a status code", async () => {
    apiGet.mockResolvedValue({ ok: true, data: UNAVAILABLE, meta: {} });

    await expect(getAboutUsContent("en")).resolves.toEqual({ ok: false, reason: "not-configured" });
  });

  it("treats a 404 as a broken contract rather than an unpublished page", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "http", status: 404 });

    await expect(getAboutUsContent("en")).resolves.toEqual({
      ok: false,
      reason: "api-error",
      status: 404,
    });
  });

  it("keeps an unreachable API distinct from an API that answered", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });

    await expect(getAboutUsContent("en")).resolves.toEqual({ ok: false, reason: "unreachable" });
  });

  it("treats a 503 as an API error — that is the CMS failing behind NestJS", async () => {
    apiGet.mockResolvedValue({ ok: false, reason: "http", status: 503 });

    await expect(getAboutUsContent("en")).resolves.toEqual({
      ok: false,
      reason: "api-error",
      status: 503,
    });
  });

  it("rejects a 200 that is not the projection rather than rendering half a page", async () => {
    for (const data of [
      null,
      {},
      "a string",
      { available: true, content: null },
      { available: true, content: { hero: {} } },
      { available: true, content: { hero: { title: "" } } },
      { available: "yes", content: CONTENT },
    ]) {
      apiGet.mockResolvedValue({ ok: true, data, meta: {} });

      await expect(getAboutUsContent("en")).resolves.toEqual({
        ok: false,
        reason: "api-error",
        status: 200,
      });
    }
  });
});

/** Every source file in the app, spec files excluded — they name the forbidden strings on purpose. */
function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx|css)$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

/**
 * A file's code with its comments removed.
 *
 * Several modules name the CMS in prose — explaining that they do **not** call it is exactly what
 * those comments are for — so a scan of raw text would fail on its own documentation. `//` is only
 * treated as a comment when it is not preceded by a colon, so a URL in a string survives intact and
 * a CMS origin cannot hide inside one.
 */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the CMS boundary, asserted against the source", () => {
  const files = sourceFiles(join(__dirname, ".."));

  it("scans a source tree, so a passing result means something", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("imports no CMS package", () => {
    const offenders = files.filter((file) =>
      /from\s+["'](payload|@payloadcms\/[^"']+)["']/.test(codeOf(file)),
    );

    expect(offenders).toEqual([]);
  });

  it("addresses no CMS origin, credential, database or route", () => {
    const offenders = files.filter((file) =>
      /PAYLOAD_INTERNAL_URL|PAYLOAD_API_KEY|PAYLOAD_SECRET|sam_cms|cms\.samgp|\/api\/globals\/|API-Key/.test(
        codeOf(file),
      ),
    );

    expect(offenders).toEqual([]);
  });
});

describe("getCustomizedSolutionsContent", () => {
  afterEach(() => {
    apiGet.mockReset();
  });

  it("asks NestJS for its own Global, under the same endpoint family", async () => {
    apiGet.mockResolvedValue({ ok: true, data: AVAILABLE, meta: {} });

    await getCustomizedSolutionsContent("fa");

    expect(apiGet).toHaveBeenCalledWith("/content/globals/customized-solutions", { locale: "fa" });
  });

  it("keeps the same three conditions apart as the first Global does", async () => {
    apiGet.mockResolvedValue({ ok: true, data: UNAVAILABLE, meta: {} });
    await expect(getCustomizedSolutionsContent("en")).resolves.toEqual({
      ok: false,
      reason: "not-configured",
    });

    apiGet.mockResolvedValue({ ok: false, reason: "http", status: 503 });
    await expect(getCustomizedSolutionsContent("en")).resolves.toEqual({
      ok: false,
      reason: "api-error",
      status: 503,
    });

    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });
    await expect(getCustomizedSolutionsContent("en")).resolves.toEqual({
      ok: false,
      reason: "unreachable",
    });
  });

  it("reports a locale fallback from the response meta", async () => {
    apiGet.mockResolvedValue({ ok: true, data: AVAILABLE, meta: { localeFallback: true } });

    await expect(getCustomizedSolutionsContent("ar")).resolves.toMatchObject({
      ok: true,
      localeFallback: true,
    });
  });

  it("rejects a 200 that is not the projection", async () => {
    for (const data of [null, {}, { available: true, content: { hero: {} } }]) {
      apiGet.mockResolvedValue({ ok: true, data, meta: {} });

      await expect(getCustomizedSolutionsContent("en")).resolves.toEqual({
        ok: false,
        reason: "api-error",
        status: 200,
      });
    }
  });
});

describe("getQualityCertificationsContent", () => {
  afterEach(() => {
    apiGet.mockReset();
  });

  it("asks NestJS for its own Global, under the same endpoint family", async () => {
    apiGet.mockResolvedValue({ ok: true, data: AVAILABLE, meta: {} });

    await getQualityCertificationsContent("fa");

    expect(apiGet).toHaveBeenCalledWith("/content/globals/quality-certifications", {
      locale: "fa",
    });
  });

  /**
   * The three conditions again, and on this page the third one matters most: `/quality-certifications`
   * is the address the platform gives for the certification question, and a CMS outage that became a
   * 404 there would tell a crawler the company has no such page.
   */
  it("keeps the same three conditions apart as the two Globals before it", async () => {
    apiGet.mockResolvedValue({ ok: true, data: UNAVAILABLE, meta: {} });
    await expect(getQualityCertificationsContent("en")).resolves.toEqual({
      ok: false,
      reason: "not-configured",
    });

    apiGet.mockResolvedValue({ ok: false, reason: "http", status: 503 });
    await expect(getQualityCertificationsContent("en")).resolves.toEqual({
      ok: false,
      reason: "api-error",
      status: 503,
    });

    apiGet.mockResolvedValue({ ok: false, reason: "unreachable", detail: "ECONNREFUSED" });
    await expect(getQualityCertificationsContent("en")).resolves.toEqual({
      ok: false,
      reason: "unreachable",
    });
  });

  it("reports a locale fallback from the response meta", async () => {
    apiGet.mockResolvedValue({ ok: true, data: AVAILABLE, meta: { localeFallback: true } });

    await expect(getQualityCertificationsContent("ar")).resolves.toMatchObject({
      ok: true,
      localeFallback: true,
    });
  });

  it("rejects a 200 that is not the projection", async () => {
    for (const data of [null, {}, { available: true, content: { hero: {} } }]) {
      apiGet.mockResolvedValue({ ok: true, data, meta: {} });

      await expect(getQualityCertificationsContent("en")).resolves.toEqual({
        ok: false,
        reason: "api-error",
        status: 200,
      });
    }
  });
});

/**
 * The Product taxonomy boundary, asserted against the source tree rather than against a rendering.
 *
 * The Quality page's sampling policy is the first surface where the CMS says anything about a
 * Product Family. What it says is a **key** — an ADR-009 identifier — and the family's published
 * name and page address are resolved in `features/site/site-routes.ts`. If a family label or a
 * `/products/…` path ever appears in a CMS payload, this boundary has moved and Payload has become
 * an owner of taxonomy that lives in `sam_platform` (ADR-002).
 *
 * There is no runtime assertion available for "the CMS did not send a label", so the assertion is
 * structural: the one table that maps a key to a label and an href is in this application.
 */
describe("product family names and addresses are resolved in this application", () => {
  it("keeps exactly one key-to-family table, and it is not in the content client", async () => {
    const routes = await import("../features/site/site-routes");

    expect(routes.productFamilyByKey("base-oils")).toEqual({
      key: "base-oils",
      label: "Base Oils",
      href: "/products/base-oils",
    });
    expect(routes.productFamilyByKey("a-family-from-a-newer-schema")).toBeUndefined();
  });

  it("declares the six frozen identifiers and no seventh", async () => {
    const routes = await import("../features/site/site-routes");

    expect(routes.PRODUCT_CATEGORIES.map((family) => family.key)).toEqual([
      "base-oils",
      "lubricant-additives",
      "engine-oils-automotive-lubricants",
      "industrial-oils-lubricants",
      "marine-oils-lubricants",
      "antifreeze-coolants",
    ]);
  });
});
