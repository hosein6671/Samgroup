import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The read-only boundary, asserted against the shipped source rather than against intent.
 *
 * ## Why a source test
 *
 * The defining property of Phases A and B is a negative one: **there is no code here capable of
 * changing review or content state.** A behavioural test can only show that the paths it happens to
 * exercise do not write. This reads every file in the review feature and both of its route
 * directories and fails if a writing construct appears in any of them — the same technique
 * ADR-016 §9b used on the API side to pin `technicalReview.create` as the only write in the service.
 *
 * It is deliberately scoped to the files this surface owns. Running it over the repository would
 * make it fail on the lead workflow, which is a shipped, approved write surface and none of its
 * business.
 *
 * ## Phase B extended it rather than exempting itself
 *
 * Phase B added two detail routes, a shared detail shell and two subject modules. Every one of them
 * is in the scanned set — the route walk is recursive precisely so a nested `[id]` directory cannot
 * sit outside the guard — and every rule below applies to all of them unchanged. Three rules were
 * **added** by Phase B and are new teeth, not new exemptions: no document link, no
 * `Specification`/`ProductClaim` decision vocabulary, and no browser navigation API.
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
 * `apiPost`", "no download, no preview", "the page has no `generateStaticParams`". Scanning raw
 * text made those sentences fail their own assertions, which would have left exactly two ways
 * forward: delete the explanations, or weaken the patterns until they stopped catching anything.
 * Removing comments first is the only reading that keeps both the documentation and the teeth.
 *
 * A regex, not a parser. It is imprecise about a `//` inside a string literal, and that
 * imprecision can only ever *remove* text from the scan — which cannot hide a construct, because a
 * write expressed inside a string literal is not a write.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/**
 * Every non-spec source file this surface owns, walking route sub-directories.
 *
 * The recursion is load-bearing. Phase A's route directory was flat, so a flat `readdirSync` saw
 * everything; Phase B's detail routes live at `specifications/[id]/page.tsx` and
 * `product-claims/[id]/page.tsx`, and a flat read would have silently excluded the two newest
 * files in the surface from every rule below.
 */
function walkSources(
  directory: string,
  found: { path: string; source: string }[] = [],
): {
  path: string;
  source: string;
}[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      walkSources(path, found);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".spec.")) {
      found.push({ path, source: codeOf(readFileSync(path, "utf8")) });
    }
  }

  return found;
}

/** Specs describe writes they forbid; sources may not. Only sources are scanned. */
function sourceFiles(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];

  for (const directory of [FEATURE_DIR, ROUTE_DIR]) walkSources(directory, files);

  return files;
}

const FILES = sourceFiles();

function file(name: string): { path: string; source: string } | undefined {
  return FILES.find(({ path }) => path.endsWith(name));
}

/** The two Phase B route files, addressed by their containing directory rather than by basename. */
function routeFile(segment: string): { path: string; source: string } | undefined {
  return FILES.find(({ path }) => path.includes(segment) && path.endsWith("page.tsx"));
}

const SPECIFICATION_ROUTE = join("specifications", "[id]");
const PRODUCT_CLAIM_ROUTE = join("product-claims", "[id]");

describe("the read-only source set", () => {
  it("is exactly the files this surface owns, and it is not empty", () => {
    const names = FILES.map(({ path }) => path.split(/[\\/]/).pop()).sort();

    expect(names).toEqual([
      "detail-shell.tsx",
      "page.tsx",
      // The two Phase B detail routes. Three `page.tsx` entries in total: the queue and the two
      // subjects. Their directories are asserted separately below.
      "page.tsx",
      "page.tsx",
      "product-claim-detail.tsx",
      "queue-views.tsx",
      "review-api.ts",
      "review-query.ts",
      "review-routes.ts",
      "review-vocabulary.ts",
      "specification-detail.tsx",
    ]);
  });

  it("includes both Phase B detail routes, so the guard cannot miss them", () => {
    expect(routeFile(SPECIFICATION_ROUTE)).toBeDefined();
    expect(routeFile(PRODUCT_CLAIM_ROUTE)).toBeDefined();
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
      expect(source, path).not.toMatch(/\bapiPut\b/);
      expect(source, path).not.toMatch(/\bapiDelete\b/);
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
   * The review surface renders **no form at all**.
   *
   * A write here can only be expressed as a form bound to a Server Action, so the simplest true
   * statement is the strongest one: there is no form to bind. The page's only form is the shell's
   * sign-out, which `AdminShell` owns and which this surface merely composes.
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
   * surface lives in `@/features/admin/actions`. Nothing here imports it — `signOut` reaches the
   * page through `AdminShell`, which is chrome this surface composes rather than code it owns.
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
   * exactly that shape). Every control on this surface is a link.
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

  /**
   * Phase B addition. The decision vocabulary must not appear as an **action** anywhere.
   *
   * The words themselves are unavoidable on a review screen: a status reads "Approved", a blocker
   * explains why approval is unavailable, and a history entry records that somebody approved
   * something. What must not exist is a handler, an action prop, or a named function that performs
   * one. So the pattern targets the shapes an action takes, not the vocabulary.
   */
  it("declares no approve, reject, supersede or needs-review action", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/\bon[A-Z]\w*\s*=/);
      expect(source, path).not.toMatch(/\baction\s*=/);
      expect(source, path).not.toMatch(/formAction/);
      /*
       * Named as an exact set of verbs rather than as a substring sweep. The decision *vocabulary*
       * is unavoidable on a review screen — a status reads "Approved", a history entry records that
       * somebody approved something, and `HISTORY_DECISION_LABEL` is a label table — so a pattern
       * broad enough to catch `decisionLabel` would have to be weakened until it caught nothing.
       * What is forbidden is a function that PERFORMS one.
       */
      expect(source, path).not.toMatch(
        /\b(function|const|let|var)\s+(approve|reject|supersede|decide|recordDecision|submitDecision|postDecision)\b/i,
      );
    }
  });

  /**
   * Phase B addition. A reviewer note is presented as recorded history and never as something that
   * could be written from here.
   */
  it("offers no editable field for a reviewer note", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/contentEditable/i);
      expect(source, path).not.toMatch(/\bdefaultValue\b/);
      expect(source, path).not.toMatch(/\bplaceholder\s*=/);
    }
  });
});

/* ========================================================================== */

/**
 * Phase B addition — the frozen G7 source-document boundary.
 *
 * There is no document proxy: ADR-014 stores no bytes and the API publishes no download route, no
 * redirect and no signed URL. The Review UI therefore renders the document's identity and renders
 * no way to open it — no anchor, no download attribute, no `window.open`, no `<iframe>`, no
 * `<embed>`, and no image or object standing in as a preview.
 *
 * The one thing that could reintroduce a link without any of those constructs is a `locatorValue`
 * interpolated into an `href`, so that is asserted directly.
 */
describe("no source document can be opened from this surface", () => {
  it("renders no anchor, download, embed or preview", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/<a\b/);
      expect(source, path).not.toMatch(/\bdownload\b\s*[=}]/);
      expect(source, path).not.toMatch(/<iframe\b/);
      expect(source, path).not.toMatch(/<embed\b/);
      expect(source, path).not.toMatch(/<object\b/);
      expect(source, path).not.toMatch(/window\.open/);
    }
  });

  it("never puts a document locator, asset or URL into an href", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/href=\{[^}]*locator/i);
      expect(source, path).not.toMatch(/href=\{[^}]*document/i);
      expect(source, path).not.toMatch(/href=\{[^}]*asset/i);
      expect(source, path).not.toMatch(/href=\{[^}]*sha256/i);
    }
  });

  /**
   * Every `href` on this surface comes out of `review-query.ts`.
   *
   * Asserted as a shape rather than as a list of URLs, so a new link cannot arrive carrying an
   * arbitrary address. The permitted expressions are the four href builders, the `clearHref` those
   * builders put on an `ActiveFilter`, and a bare `href` — which is `Chip`'s own prop passthrough,
   * and is safe precisely because every `Chip` call site is itself checked by this same rule.
   */
  it("builds every href from the review URL module", () => {
    for (const { path, source } of FILES) {
      for (const [, expression] of source.matchAll(/href=\{([^}]*)\}/g)) {
        expect((expression ?? "").trim(), `${path} href`).toMatch(
          /^(href|filter\.clearHref|(reviewQueueHref|reviewPageHref|toggleHref|reviewSubjectHref|backToQueueHref)\()/,
        );
      }
    }
  });

  /** No `http`/`https` literal anywhere: an absolute URL on this surface is off-platform. */
  it("contains no absolute URL literal", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/["'`]https?:\/\//);
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
 * matters is a source-level one: the module that builds every URL on this surface must not know the
 * field exists. The rendered side (plain text, no anchor, no href) is proved by
 * `review-accessibility.spec.tsx` and `detail-accessibility.spec.tsx`; this proves the structural
 * side.
 */
describe("the source reference never enters URL state", () => {
  it("is unknown to the module that builds every review URL", () => {
    const query = file("review-query.ts");

    expect(query).toBeDefined();
    expect(query?.source).not.toContain("sourceRef");
  });

  it("is not a route segment", () => {
    const routes = file("review-routes.ts");

    expect(routes).toBeDefined();
    expect(routes?.source).not.toContain("sourceRef");
    // The three paths are built from `ADMIN_PATH` and fixed segments. The id-bearing href is built
    // in `review-query.ts`, so this module still takes no dynamic part of its own.
    expect(routes?.source).toContain("/catalog/review");
    expect(routes?.source).not.toMatch(/\[[^\]]+\]/);
  });

  /**
   * The two places it may appear are the queue row that renders it and the detail panel that
   * renders it. Asserted as an exact set rather than "not in the URL builders", so a later gate
   * cannot quietly add a third reader.
   */
  it("appears in exactly two source files, and both only render it", () => {
    const readers = FILES.filter(({ source }) => source.includes("sourceRef"))
      .map(({ path }) => path.split(/[\\/]/).pop())
      .sort();

    expect(readers).toEqual(["detail-shell.tsx", "queue-views.tsx"]);
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
   * The surface must not advertise a filter it does not offer. The API has the capability; this
   * surface does not expose it, and no label, chip or hint may suggest otherwise.
   */
  it("advertises no source reference filter", () => {
    const views = file("queue-views.tsx");

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
    const api = file("review-api.ts");

    expect(api).toBeDefined();
    expect(api?.source).toMatch(/^import ["']server-only["'];/m);
    expect(api?.source).toContain("getAdminAccessToken");
  });

  it("declares no client component in the review surface", () => {
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

  /**
   * Phase B addition. Back navigation is a real link to a real URL, never a script.
   *
   * `history.back()` would be wrong after a reload, wrong when the detail URL was opened directly,
   * and silent when it failed — and it would need a Client Component to exist at all, which the
   * rule above already forbids. This states the specific construct so the intent survives.
   */
  it("depends on no browser history or navigation API", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toMatch(/\bhistory\.(back|go|push|replace)/);
      expect(source, path).not.toMatch(/\bwindow\.location/);
      expect(source, path).not.toMatch(/useRouter/);
    }
  });
});

/* ========================================================================== */

describe("the caching boundary is stated where it has to be", () => {
  it("makes every review route dynamic and uncached", () => {
    const pages = FILES.filter(({ path }) => path.endsWith("page.tsx"));

    expect(pages).toHaveLength(3);

    for (const { path, source } of pages) {
      expect(source, path).toMatch(/export const dynamic = ["']force-dynamic["'];/);
      expect(source, path).toMatch(/export const revalidate = 0;/);
    }
  });

  /**
   * No `generateStaticParams` anywhere, so `next build` cannot resolve these routes and cannot call
   * a protected endpoint without a session. The detail routes have a dynamic segment, which is
   * exactly why this matters more for them than it did for the queue.
   */
  it("gives the build nothing to prerender", () => {
    for (const { path, source } of FILES) {
      expect(source, path).not.toContain("generateStaticParams");
      expect(source, path).not.toContain("generateMetadata");
    }
  });
});

/* ========================================================================== */

describe("nothing public imports the review surface", () => {
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
   * The review surface renders unapproved technical data and internal provenance. Nothing under a
   * public route may reach the feature that fetches it.
   *
   * The Product's internal supplier reference — the column ADR-015 §1 makes categorically
   * non-public — is not asserted here, and deliberately not: `apps/api`'s own
   * `source-ref-boundary.spec.ts` already proves the column is named nowhere in this app, nowhere
   * in `apps/cms` and nowhere in `packages/types`. Restating it in this file would require writing
   * the identifier, which is the one thing that test forbids.
   */
  it("keeps the review surface out of every public route and public feature", () => {
    const publicFiles = walk(join(WEB_SRC, "app", "[locale]")).concat(
      walk(join(WEB_SRC, "features")).filter((path) => !path.includes(`features${sep()}admin`)),
    );

    expect(publicFiles.length).toBeGreaterThan(0);

    for (const path of publicFiles) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source, path).not.toContain("catalog/review");
      expect(source, path).not.toContain("ReviewQueueItemResponse");
      expect(source, path).not.toContain("ReviewDetailResponse");
    }
  });
});

function sep(): string {
  return join("a", "b").includes("\\") ? "\\" : "/";
}
