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
 *
 * ── The boundary is "non-public", not "unreadable" ──────────────────────────
 *
 * PRODUCT-REVIEW-1A adds the one surface with a real need for it: a reviewer reconciling a
 * technical value against the ratified workbook has to be able to see which workbook row the
 * Product is. So `review/` may name the column, and the exemption is NARROWED rather than
 * granted — `admits the review module only behind an Admin guard` below re-reads those files and
 * fails if any of them serves the column without `@Roles(UserRole.ADMIN)` and both guards.
 *
 * ADR-015 §1's rule is unchanged and every other assertion here is untouched: the column stays
 * out of `products.service.ts`, out of every public Product DTO, out of SEO and the sitemap, out
 * of `apps/web`, out of `apps/cms` and out of `packages/types`.
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

/**
 * The only files permitted to name the column: the ones whose job is proving it never reaches
 * a response. A list, not a rule about file extensions, so adding a third requires saying so.
 */
const ASSERTS_ABSENCE: readonly string[] = [
  "source-ref-boundary.spec.ts",
  "public-specification-security.spec.ts",
];

/** The Admin review surface, which serves the column deliberately — see the module note above. */
const REVIEW_DIR_SEGMENT = `${require("node:path").sep}review${require("node:path").sep}`;

describe("Product.sourceRef stays internal", () => {
  it("is not named anywhere in the public catalog module outside the importer", () => {
    const offenders = sourceFiles(
      CATALOG_DIR,
      (path) =>
        path.includes(`${"import"}${require("node:path").sep}`) ||
        path.includes(REVIEW_DIR_SEGMENT),
    )
      // Exempt by NAME, never by "it is a test": the two files below exist to assert that the
      // column stays out of a response, and they cannot do that without naming it. Every other
      // file in this module — production or test — is still caught, which is the point.
      .filter((path) => !ASSERTS_ABSENCE.some((name) => path.endsWith(name)))
      .filter(mentionsSourceRef);
    expect(offenders).toEqual([]);
  });

  /**
   * The review module's exemption, made conditional on the thing that justifies it.
   *
   * A file under `review/` may name `sourceRef` only if the surface it belongs to is Admin-only.
   * The controller is checked for both guards and for `@Roles(UserRole.ADMIN)`; the service and
   * the DTOs are checked for the absence of any public entry point. If someone later adds an
   * unguarded route to that folder and serves the column from it, this fails.
   */
  it("admits the review module only behind an Admin guard", () => {
    const reviewFiles = sourceFiles(join(CATALOG_DIR, "review"), () => false).filter(
      mentionsSourceRef,
    );

    // The exemption is worth nothing if the folder is empty — that would pass by having no files.
    expect(reviewFiles.length).toBeGreaterThan(0);

    const controller = readFileSync(
      join(CATALOG_DIR, "review", "catalog-review.controller.ts"),
      "utf8",
    );
    expect(controller).toMatch(/@UseGuards\(JwtAuthGuard,\s*RolesGuard\)/);
    expect(controller).toMatch(/@Roles\(UserRole\.ADMIN\)/);
    // Every `@Controller` in the folder is under the admin namespace, so no route escapes §2.10.
    for (const [, path] of controller.matchAll(/@Controller\("([^"]+)"\)/g)) {
      expect(path).toMatch(/^admin\//);
    }

    // And nothing in the folder declares a route outside that controller file.
    for (const file of sourceFiles(join(CATALOG_DIR, "review"), () => false)) {
      if (file.endsWith("catalog-review.controller.ts")) continue;
      expect(readFileSync(file, "utf8")).not.toMatch(/@Controller\(/);
    }
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
