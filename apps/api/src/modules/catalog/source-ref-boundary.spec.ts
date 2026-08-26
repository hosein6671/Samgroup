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
 * ── The frontend half of the exemption (ADMIN-REVIEW-UI-1B-H1) ─────────────
 *
 * The Architect ruled that the column is the stable internal import identity a reviewer needs to
 * tell two subjects apart and locate them in the ratified workbook, so the authenticated Technical
 * Review Admin surface may render it. It is **not** public product content, and it stays forbidden
 * in public web routes and components, in Payload, in the public shared content types, in the
 * public API DTOs, in SEO/sitemap/metadata, in analytics, in logs, in public URLs, and in browser
 * storage.
 *
 * The exemption is therefore **three exact locations**, not a folder and not an app — see
 * `REVIEW_SURFACE_ALLOWLIST`. `apps/cms` gains nothing; `packages/types/catalog.ts` gains nothing;
 * no ancestor directory of an approved path gains anything. The negative mutation test below
 * writes the column into a real public Product component and proves this file still catches it.
 *
 * ADR-015 §1's rule is unchanged and every other assertion here is untouched: the column stays
 * out of `products.service.ts`, out of every public Product DTO, and out of SEO and the sitemap.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative as relative_, sep } from "node:path";

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

/**
 * The three locations outside `apps/api` permitted to name the column — the Architect's ruling for
 * ADMIN-REVIEW-UI-1B-H1, transcribed exactly.
 *
 * Two directory prefixes and **one exact file**. Everything else in `apps/web`, everything in
 * `apps/cms`, and every other file in `packages/types` stays closed. Deliberately NOT exempted, and
 * each of these was offered and refused:
 *
 * - all of `apps/web` — the public routes and the Product components live there;
 * - all Admin routes — the lead inbox has no business knowing an import identity;
 * - all of `packages/types` — `catalog.ts` is what every public consumer imports;
 * - `apps/cms` — Payload owns editorial content, and no exemption reaches it;
 * - the public Product components, under any framing.
 *
 * Written as repository-relative POSIX strings so the ruling is legible next to the ruling, and
 * compared after normalising the candidate path. `isApprovedReviewPath` requires a directory entry
 * to match as a **path prefix ending in a separator**, so `…/catalog/review-notes.ts` and
 * `…/catalog/reviewer.tsx` are not exempt, and a file entry to match in full, so
 * `catalog-review-extra.ts` is not exempt either.
 */
const REVIEW_SURFACE_ALLOWLIST: readonly string[] = [
  "apps/web/src/app/(admin)/admin/catalog/review/",
  "apps/web/src/features/admin/catalog/review/",
  "packages/types/src/catalog-review.ts",
];

function isApprovedReviewPath(absolute: string): boolean {
  const relative = relative_(REPO_ROOT, absolute).split(sep).join("/");

  return REVIEW_SURFACE_ALLOWLIST.some((entry) =>
    entry.endsWith("/") ? relative.startsWith(entry) : relative === entry,
  );
}

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

  it("is absent from apps/web outside the three approved Review paths", () => {
    const dir = join(REPO_ROOT, "apps", "web", "src");
    const offenders = sourceFiles(dir, () => false)
      .filter((path) => !isApprovedReviewPath(path))
      .filter(mentionsSourceRef);
    expect(offenders).toEqual([]);
  });

  /** Payload owns editorial content. No import identity belongs in it, under any exemption. */
  it("is absent from the CMS entirely — no path there is exempt", () => {
    const dir = join(REPO_ROOT, "apps", "cms", "src");
    expect(sourceFiles(dir, () => false).filter(mentionsSourceRef)).toEqual([]);
  });

  it("is absent from the shared types package outside the Review wire type", () => {
    const dir = join(REPO_ROOT, "packages", "types", "src");
    const offenders = sourceFiles(dir, () => false)
      .filter((path) => !isApprovedReviewPath(path))
      .filter(mentionsSourceRef);
    expect(offenders).toEqual([]);
  });

  /**
   * The generic Product shapes, named individually.
   *
   * `catalog.ts` is what every public consumer imports, and it is the file an exemption would most
   * plausibly leak into — a `ProductListItemResponse` carrying the column would put it on the
   * public Product pages without anyone editing a Product component. Checked by name rather than
   * by folder, so a rename is a failure rather than a silent gap.
   */
  it("is absent from the generic shared Product types", () => {
    const offenders = ["catalog.ts", "content.ts", "seo.ts", "blog.ts", "api.ts"].filter((name) =>
      mentionsSourceRef(join(REPO_ROOT, "packages", "types", "src", name)),
    );

    expect(offenders).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /* The allowlist itself                                                */
  /* ------------------------------------------------------------------ */

  it("exempts exactly three locations, and no ancestor of them", () => {
    expect(REVIEW_SURFACE_ALLOWLIST).toEqual([
      "apps/web/src/app/(admin)/admin/catalog/review/",
      "apps/web/src/features/admin/catalog/review/",
      "packages/types/src/catalog-review.ts",
    ]);
  });

  it.each([
    // The three approved locations.
    ["apps/web/src/app/(admin)/admin/catalog/review/page.tsx", true],
    ["apps/web/src/features/admin/catalog/review/queue-views.tsx", true],
    ["packages/types/src/catalog-review.ts", true],
    // Ancestors of them, which the ruling explicitly refuses to exempt.
    ["apps/web/src/app/(admin)/admin/leads/inquiries/page.tsx", false],
    ["apps/web/src/app/(admin)/admin/page.tsx", false],
    ["apps/web/src/features/admin/admin-shell.tsx", false],
    ["apps/web/src/features/admin/leads/inbox-frame.tsx", false],
    ["packages/types/src/catalog.ts", false],
    ["packages/types/src/index.ts", false],
    // Public surfaces.
    ["apps/web/src/app/[locale]/products/[slug]/page.tsx", false],
    ["apps/web/src/features/products/product-card.tsx", false],
    ["apps/cms/src/collections/Media.ts", false],
    // Near-misses that must not slip through a loose prefix or a substring match.
    ["apps/web/src/features/admin/catalog/review-notes.ts", false],
    ["apps/web/src/features/admin/catalog/reviewer.tsx", false],
    ["packages/types/src/catalog-review-extra.ts", false],
    ["apps/web/src/app/(admin)/admin/catalog/review.tsx", false],
  ])("classifies %s as exempt: %s", (relative, exempt) => {
    expect(isApprovedReviewPath(join(REPO_ROOT, ...relative.split("/")))).toBe(exempt);
  });

  /**
   * Negative mutation coverage.
   *
   * An allowlist that is never exercised against a violation is a list, not a guard. This writes
   * the column into a **real, representative public Product file**, re-runs the same scan the test
   * above runs, asserts it is caught, and restores the file — so the proof is that the guard fails
   * on a public Product component, not that it would.
   *
   * The restore is in `finally` and the assertion is deferred until after it, so a failing
   * expectation cannot leave the working tree modified.
   */
  it("still fails when the column appears in a representative public Product component", () => {
    const victim = join(
      REPO_ROOT,
      "apps",
      "web",
      "src",
      "features",
      "products",
      "product-card.tsx",
    );
    const original = readFileSync(victim, "utf8");

    let caught: string[] = [];
    try {
      writeFileSync(victim, `${original}\n// sourceRef\n`, "utf8");
      caught = sourceFiles(join(REPO_ROOT, "apps", "web", "src"), () => false)
        .filter((path) => !isApprovedReviewPath(path))
        .filter(mentionsSourceRef);
    } finally {
      writeFileSync(victim, original, "utf8");
    }

    expect(caught).toEqual([victim]);
    expect(readFileSync(victim, "utf8")).toBe(original);
  });

  /** The same mutation inside an approved Review path is permitted — the exemption is real. */
  it("permits the column inside an approved Review path", () => {
    const allowed = join(
      REPO_ROOT,
      "apps",
      "web",
      "src",
      "features",
      "admin",
      "catalog",
      "review",
      "queue-views.tsx",
    );

    expect(isApprovedReviewPath(allowed)).toBe(true);
    expect(mentionsSourceRef(allowed)).toBe(true);
  });

  it("is declared on the Prisma model, so the boundary is a choice and not an accident", () => {
    const schema = readFileSync(join(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
    expect(schema).toMatch(/sourceRef\s+String\?\s+@unique\s+@map\("source_ref"\)/);
  });
});
