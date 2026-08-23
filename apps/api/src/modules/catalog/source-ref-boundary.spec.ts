/**
 * `Product.sourceRef` is INTERNAL, and this file is what keeps it that way.
 *
 * The column names which workbook row a Product came from. It is operational provenance, not
 * catalogue content: publishing it would put an internal identifier into a public URL,
 * response body or sitemap, where it would be indexed, quoted back, and eventually depended
 * on by something outside this repository.
 *
 * Nothing stops a future `select: { ...PRODUCT_SELECT, sourceRef: true }` except a test that
 * fails when someone writes it — so the checks below read the actual source and the actual
 * response types rather than trusting the convention.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CATALOG_DIR = __dirname;
const API_SRC = join(__dirname, "..", "..");
const REPO_ROOT = join(API_SRC, "..", "..", "..");

/** Every .ts file under a directory, excluding the importer, which OWNS the column. */
function sourceFiles(root: string, skip: (path: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      if (skip(path)) continue;
      if (statSync(path).isDirectory()) {
        if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
        walk(path);
        continue;
      }
      if (/\.tsx?$/.test(entry)) out.push(path);
    }
  };
  walk(root);
  return out;
}

const mentionsSourceRef = (path: string): boolean =>
  /\bsourceRef\b|\bsource_ref\b/.test(readFileSync(path, "utf8"));

describe("Product.sourceRef stays internal", () => {
  it("is not named anywhere in the public catalog module outside the importer", () => {
    const offenders = sourceFiles(CATALOG_DIR, (path) =>
      path.includes(`${"import"}${require("node:path").sep}`),
    )
      .filter((path) => !path.endsWith("source-ref-boundary.spec.ts"))
      .filter(mentionsSourceRef);
    expect(offenders).toEqual([]);
  });

  it("is absent from every Product response type", () => {
    const dto = readFileSync(join(CATALOG_DIR, "dto", "product.response.ts"), "utf8");
    expect(dto).not.toMatch(/sourceRef|source_ref/);
    // The detail response is the widest public shape; enumerate it so a new field is noticed.
    expect(dto).toMatch(/ProductDetailResponse/);
  });

  it("is absent from the service's Prisma select allow-lists", () => {
    const service = readFileSync(join(CATALOG_DIR, "products.service.ts"), "utf8");
    expect(service).not.toMatch(/sourceRef|source_ref/);
    // The select is an allow-list rather than an omit, which is what makes absence the default.
    expect(service).toMatch(/select:/);
  });

  it("is absent from the SEO and sitemap surfaces", () => {
    const seo = sourceFiles(join(API_SRC, "modules"), (path) => path.includes("catalog"))
      .filter((path) => /seo|sitemap/i.test(path))
      .filter(mentionsSourceRef);
    expect(seo).toEqual([]);
  });

  it("is absent from web and the CMS entirely", () => {
    for (const app of ["web", "cms"]) {
      const dir = join(REPO_ROOT, "apps", app, "src");
      const offenders = sourceFiles(dir, () => false).filter(mentionsSourceRef);
      expect(offenders).toEqual([]);
    }
  });

  it("is absent from the shared types package, which both apps consume", () => {
    const dir = join(REPO_ROOT, "packages", "types", "src");
    expect(sourceFiles(dir, () => false).filter(mentionsSourceRef)).toEqual([]);
  });

  it("is declared on the Prisma model, so the boundary is a choice and not an accident", () => {
    const schema = readFileSync(join(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
    expect(schema).toMatch(/sourceRef\s+String\?\s+@unique\s+@map\("source_ref"\)/);
  });
});
