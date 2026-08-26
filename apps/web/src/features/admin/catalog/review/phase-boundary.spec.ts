import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The Phase A boundary, asserted against the shipped source rather than against intent.
 *
 * ## Why a source test
 *
 * Phase A's defining property is a negative one: **there is no code here capable of changing review
 * or content state.** A behavioural test can only show that the paths it happens to exercise do not
 * write. This reads every file in the review feature and its route and fails if a writing
 * construct appears in any of them — which is the same technique ADR-016 §9b used on the API side
 * to pin `technicalReview.create` as the only write in the service.
 *
 * It is deliberately scoped to the files this gate owns. Running it over the repository would make
 * it fail on the lead workflow, which is a shipped, approved write surface and none of its
 * business.
 *
 * ## When Phase C arrives
 *
 * This file is the thing that must be deliberately amended before a decision can be built. That is
 * the point: the amendment is a visible line in a diff, reviewable on its own, rather than a
 * capability that appears by accident.
 */

const FEATURE_DIR = fileURLToPath(new URL(".", import.meta.url));
const ROUTE_DIR = fileURLToPath(
  new URL("../../../../app/(admin)/admin/catalog/review", import.meta.url),
);

/**
 * Comments stripped, so the guard reads code rather than prose.
 *
 * Not cosmetic: every module in this feature *documents* what it does not do — "there is no
 * `apiPost`", "a `<select>` would have to invent its options", "the page has no
 * `generateStaticParams`". Scanning raw text made those sentences fail their own assertions, which
 * would have left exactly two ways forward: delete the explanations, or weaken the patterns until
 * they stopped catching anything. Removing comments first is the only reading that keeps both the
 * documentation and the teeth.
 *
 * A regex, not a parser. It is imprecise about a `//` inside a string literal, and that
 * imprecision can only ever *remove* text from the scan — which cannot hide a construct, because a
 * write expressed inside a string literal is not a write.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** Every non-spec source file this gate added. Specs describe writes they forbid; sources may not. */
function sourceFiles(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];

  for (const directory of [FEATURE_DIR, ROUTE_DIR]) {
    for (const name of readdirSync(directory)) {
      if (!/\.tsx?$/.test(name) || name.includes(".spec.")) continue;
      const path = join(directory, name);
      files.push({ path, source: codeOf(readFileSync(path, "utf8")) });
    }
  }

  return files;
}

const FILES = sourceFiles();

describe("the Phase A source set", () => {
  it("is the files this gate added, and it is not empty", () => {
    const names = FILES.map(({ path }) => path.split(/[\\/]/).pop()).sort();

    expect(names).toEqual([
      "page.tsx",
      "queue-views.tsx",
      "review-api.ts",
      "review-query.ts",
      "review-routes.ts",
      "review-vocabulary.ts",
    ]);
  });
});

/* ========================================================================== */

describe("nothing here can change review state", () => {
  /** The decision sub-collection. Naming it at all in a source file would be a Phase C move. */
  it("names no decisions endpoint", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toContain("/decisions");
    }
  });

  it("issues no POST, by any spelling", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/method:\s*["'`]POST["'`]/i);
      expect(source, path).not.toMatch(/\bapiPost\b/);
      expect(source, path).not.toMatch(/\bapiPostNoContent\b/);
      expect(source, path).not.toMatch(/\bapiPatch\b/);
    }
  });

  /** A Server Action is the only way a form on this surface could reach the API. There is none. */
  it("declares no Server Action and imports none", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/^\s*["']use server["']/m);
      expect(source, path).not.toMatch(/from\s+["'][^"']*workflow-actions["']/);
    }
  });

  /**
   * The review feature renders **no form at all**.
   *
   * A write on this surface can only be expressed as a form bound to a Server Action, so the
   * simplest true statement is the strongest one: there is no form here to bind. The page's only
   * form is the shell's sign-out, which `AdminShell` owns and which this feature merely composes.
   *
   * This briefly permitted one `method="get"` form, when ADMIN-REVIEW-UI-1B-H1 asked for a labelled
   * `sourceRef` filter and the API turned out to support the match. The Architect's final ruling
   * removed it — the column may be displayed but must never enter URL state — so the rule returns
   * to its absolute form.
   */
  it("declares no form at all", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/<form\b/);
    }
  });

  /**
   * The strongest form of the same rule, and the one that does not depend on reading JSX.
   *
   * A Server Action can only be bound to a form if it is imported, and every Server Action on this
   * surface lives in `@/features/admin/actions`. The review feature imports nothing from it —
   * `signOut` reaches the page through `AdminShell`, which is chrome the feature composes rather
   * than code it owns. So no form here *can* be bound to an action, whatever its markup says.
   */
  it("imports no Server Action module at all", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/from\s+["'][^"']*features\/admin\/actions["']/);
      expect(source, path).not.toMatch(/from\s+["'][^"']*workflow-actions["']/);
      expect(source, path).not.toMatch(/\bsignOut\b/);
    }
  });

  /**
   * No field of any kind. With no form, an input has nothing to submit to; a `<select>` or
   * `<textarea>` would be a decision control (the lead workflow's status and note controls are
   * exactly that shape). Every filter on this page is a link.
   */
  it("renders no input, select, textarea or button", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/<input\b/);
      expect(source, path).not.toMatch(/<select\b/);
      expect(source, path).not.toMatch(/<textarea\b/);
      expect(source, path).not.toMatch(/<button\b/);
    }
  });

  /** Not even a disabled one — a greyed-out Approve promises a capability that does not exist. */
  it("has no disabled control standing in for a future decision", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/\bdisabled\b\s*[=}]/);
    }
  });
});

/* ========================================================================== */

/**
 * `sourceRef` may be displayed and may not travel.
 *
 * The Architect's final ruling: the column is approved for display inside the authenticated Review
 * UI, and forbidden in route segments, query strings, GET form fields, browser history,
 * reverse-proxy access logs, analytics, public routes, the CMS and the generic Product types.
 *
 * Those forbidden places have one thing in common — they are all fed by a URL. So the check that
 * matters is a source-level one: the module that builds every URL on this page must not know the
 * field exists. `review-accessibility.spec.tsx` proves the rendered side (plain text, no anchor, no
 * href), and this proves the structural side.
 */
describe("the source reference never enters URL state", () => {
  it("is unknown to the module that builds every queue URL", () => {
    const query = FILES.find(({ path }) => path.endsWith("review-query.ts"));

    expect(query).toBeDefined();
    expect(query?.source).not.toContain("sourceRef");
  });

  it("is not a route segment", () => {
    const routes = FILES.find(({ path }) => path.endsWith("review-routes.ts"));

    expect(routes).toBeDefined();
    expect(routes?.source).not.toContain("sourceRef");
    // The route is built from `ADMIN_PATH` and two fixed segments, and takes no dynamic part.
    expect(routes?.source).toContain("/catalog/review");
    expect(routes?.source).not.toMatch(/\[[^\]]+\]/);
  });

  /**
   * The one place it may appear is the row that renders it. Asserted as an exact set rather than
   * "not in the URL builders", so a later gate cannot quietly add a third reader.
   */
  it("appears in exactly one source file, and that file only renders it", () => {
    const readers = FILES.filter(({ source }) => source.includes("sourceRef")).map(({ path }) =>
      path.split(/[\\/]/).pop(),
    );

    expect(readers).toEqual(["queue-views.tsx"]);
  });

  it("is never put into an href, an action, or a URLSearchParams", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/href=\{[^}]*sourceRef/);
      expect(source, path).not.toMatch(/action=\{?[^}\n]*sourceRef/);
      expect(source, path).not.toMatch(/(searchParams|params)\.(set|append)\(\s*["'`]sourceRef/);
    }
  });

  it("is never a form field name, because there is no form", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/name=["']sourceRef["']/);
    }
  });

  /**
   * Phase A must not advertise a filter it does not offer. The API has the capability; this page
   * does not expose it, and no label, chip or hint may suggest otherwise.
   */
  it("advertises no source reference filter", () => {
    const views = FILES.find(({ path }) => path.endsWith("queue-views.tsx"));

    expect(views?.source).not.toMatch(/SourceRefFilter/);
    expect(views?.source).not.toMatch(/htmlFor=["']ad-filter-source-ref["']/);
  });
});

/* ========================================================================== */

describe("no token or credential can reach the browser", () => {
  it("uses no browser storage of any kind", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toContain("localStorage");
      expect(source, path).not.toContain("sessionStorage");
      expect(source, path).not.toContain("document.cookie");
      expect(source, path).not.toContain("indexedDB");
    }
  });

  /**
   * The one module that holds an access token is `review-api.ts`, and it is `server-only`. A client
   * component importing it would fail the build; this makes the intent explicit rather than relying
   * on that.
   */
  it("marks the module that touches the token as server-only", () => {
    const api = FILES.find(({ path }) => path.endsWith("review-api.ts"));

    expect(api).toBeDefined();
    expect(api?.source).toMatch(/^import ["']server-only["'];/m);
    expect(api?.source).toContain("getAdminAccessToken");
  });

  it("declares no client component in the review feature", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/^\s*["']use client["']/m);
    }
  });

  it("never calls the NestJS API from anywhere but the shared server-side client", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/\bfetch\s*\(/);
      expect(source, path).not.toContain("XMLHttpRequest");
      expect(source, path).not.toContain("API_INTERNAL_URL");
    }
  });

  it("passes no token, cookie or header into a component", () => {
    for (const { path, source } of FILES) {
      if (path.endsWith("review-api.ts")) continue;
      expect(source, path).not.toContain("accessToken");
      expect(source, path).not.toContain("refreshToken");
    }
  });
});

/* ========================================================================== */

describe("the caching boundary is stated where it has to be", () => {
  it("makes the route dynamic and uncached", () => {
    const page = FILES.find(({ path }) => path.endsWith("page.tsx"));

    expect(page?.source).toMatch(/export const dynamic = ["']force-dynamic["'];/);
    expect(page?.source).toMatch(/export const revalidate = 0;/);
  });

  /**
   * No dynamic segment and no `generateStaticParams`, so `next build` cannot resolve this route
   * and cannot call a protected endpoint without a session.
   */
  it("gives the build nothing to prerender", () => {
    const page = FILES.find(({ path }) => path.endsWith("page.tsx"));

    expect(page?.source).not.toContain("generateStaticParams");
    expect(page?.source).not.toContain("generateMetadata");
  });
});

/* ========================================================================== */

describe("nothing public imports the review feature", () => {
  const WEB_SRC = fileURLToPath(new URL("../../../../", import.meta.url));

  function walk(directory: string, found: string[] = []): string[] {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path, found);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".spec.")) {
        found.push(path);
      }
    }
    return found;
  }

  /**
   * The review queue renders unapproved technical data and internal provenance. Nothing under a
   * public route may reach the feature that fetches it.
   *
   * The Product's internal supplier reference — the column ADR-015 §1 makes categorically
   * non-public — is not asserted here, and deliberately not: `apps/api`'s own
   * `source-ref-boundary.spec.ts` already proves the column is named nowhere in this app, nowhere
   * in `apps/cms` and nowhere in `packages/types`. Restating it in this file would require writing
   * the identifier, which is the one thing that test forbids.
   */
  it("keeps the review feature out of every public route and public feature", () => {
    const publicFiles = walk(join(WEB_SRC, "app", "[locale]")).concat(
      walk(join(WEB_SRC, "features")).filter((path) => !path.includes(`features${sep()}admin`)),
    );

    expect(publicFiles.length).toBeGreaterThan(0);

    for (const path of publicFiles) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source, path).not.toContain("catalog/review");
      expect(source, path).not.toContain("ReviewQueueItemResponse");
    }
  });
});

function sep(): string {
  return join("a", "b").includes("\\") ? "\\" : "/";
}
