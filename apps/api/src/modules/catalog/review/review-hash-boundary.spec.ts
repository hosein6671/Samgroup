import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ONE authoritative review-hash implementation, and it is in PostgreSQL.
 *
 * ## Why a source test rather than a behavioural one
 *
 * ADR-017 §3 makes the review hash a database function and forbids a second definition anywhere
 * else. A behavioural test cannot prove that: it can show the paths it happens to exercise agree,
 * and a second implementation added tomorrow would agree too — right up to the first divergence,
 * which by then would be a stale approval that looked current.
 *
 * The property to assert is a NEGATIVE one — there is no code here capable of computing a review
 * hash — and the only way to assert a negative about code is to read the code. This is the same
 * technique `phase-boundary.spec.ts` uses on the web side and the same one ADR-016 §9b used to pin
 * `technicalReview.create` as the only write in the review service.
 *
 * ## What it would catch
 *
 * The realistic regression is not somebody deciding to rewrite the hash. It is somebody needing the
 * hash in a place that has no database handle — a queue worker, a test helper, an importer dry-run
 * — and reaching for `node:crypto` because it is right there. That is how the second definition
 * arrives, and this is where it stops.
 */

const API_SRC = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(API_SRC, "..", "..", "..");

/**
 * Comments stripped, so the guard reads code rather than prose.
 *
 * Not cosmetic. `evidence-set-hash.ts` documents at length that it does NOT implement the hash, and
 * scanning raw text would make that explanation fail its own assertion — leaving exactly two ways
 * forward: delete the explanation, or weaken the pattern until it catches nothing.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

const SKIP_DIRECTORIES = new Set(["node_modules", "dist", ".next", ".turbo", "generated", ".git"]);

function walk(directory: string, found: { path: string; source: string }[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      walk(path, found);
      continue;
    }

    if (/\.tsx?$/.test(entry.name)) {
      found.push({ path, source: codeOf(readFileSync(path, "utf8")) });
    }
  }
}

/**
 * Every TypeScript source in the repository's own apps and packages.
 *
 * Repository-wide rather than scoped to this module, deliberately, and it is the whole point: a
 * second hash implementation inside `review/` would be obvious in code review. One in a worker, a
 * script, a seed or the web app is the one that would not be.
 */
function repositorySources(): { path: string; source: string }[] {
  const found: { path: string; source: string }[] = [];

  for (const root of ["apps", "packages", "prisma", "scripts"]) {
    const path = join(REPO_ROOT, root);
    try {
      if (statSync(path).isDirectory()) walk(path, found);
    } catch {
      // A root that does not exist in this checkout is not a failure; the assertion below proves
      // the walk found real files, so an empty scan can never pass silently.
    }
  }

  return found;
}

const FILES = repositorySources();

/**
 * Offending paths, collected and asserted as a list.
 *
 * Jest's `expect` takes no message argument — that is Vitest, which the web side uses — so a
 * per-file assertion here would fail with `Expect takes at most one argument` rather than naming
 * the file. Collecting the offenders and asserting the LIST is empty puts every offending path in
 * the failure output, which is what a guard like this has to do to be actionable.
 */
function offenders(
  pattern: RegExp,
  applies: (file: { path: string; source: string }) => boolean = () => true,
): string[] {
  return FILES.filter((file) => applies(file) && pattern.test(file.source)).map(({ path }) => path);
}

/** Files that also mention a REVIEW hash — the only ones the digest rules apply to. */
const MENTIONS_REVIEW_HASH =
  /evidenceSetHash|evidence_set_hash|reviewHash|review_hash|specification_review_hash|product_claim_review_hash|spec-review-v2|claim-review-v2/;

/** This guard names every forbidden construct, so it must exempt itself from all of them. */
function notThisSpec(file: { path: string }): boolean {
  return !file.path.endsWith("review-hash-boundary.spec.ts");
}

describe("the review hash has exactly one implementation", () => {
  it("scanned a real, non-trivial set of sources", () => {
    // Without this, a broken walk would make every assertion below vacuously true.
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.some(({ path }) => path.endsWith("evidence-set-hash.ts"))).toBe(true);
  });

  /**
   * The canonical spelling of a hand-rolled digest in Node. `createHash` is not forbidden in the
   * repository at large — the importer's manifest and claim identity hashes legitimately use it —
   * so the rule is scoped to files that also mention a REVIEW hash. That is the combination that
   * would be a second definition of this specific value.
   */
  it("computes no review hash in TypeScript", () => {
    const applies = (file: { path: string; source: string }): boolean =>
      notThisSpec(file) && MENTIONS_REVIEW_HASH.test(file.source);

    expect(offenders(/createHash\s*\(/, applies)).toEqual([]);
    expect(offenders(/\bcreateHmac\s*\(/, applies)).toEqual([]);
    expect(offenders(/subtle\s*\.\s*digest/, applies)).toEqual([]);
    expect(offenders(/\bsha256\s*\(/, applies)).toEqual([]);
  });

  /**
   * The other way a second definition could arrive: rebuilding the canonical PAYLOAD in TypeScript
   * and hashing it somewhere else, or later. The payload's own key names are the fingerprint of
   * that attempt, and none of them belongs in application code.
   */
  it("reconstructs no part of the canonical hash payload", () => {
    /*
     * `rawMethodPresent` on its own is NOT evidence of a reconstruction, and asserting on it alone
     * was wrong: `review-eligibility.ts` has carried a field of that name since PRODUCT-REVIEW-1B,
     * where it means "some current evidence link states a raw method". The v2 payload borrowed the
     * same words for the same idea, which makes the name a coincidence rather than a fingerprint.
     * Renaming either side to make a guard pass would be changing a shipped contract to suit a
     * test.
     *
     * What IS a fingerprint is the COMBINATION: an object carrying the payload's evidence-entry
     * keys together. No legitimate module has a reason to assemble all three, and a reconstruction
     * cannot avoid them.
     */
    const evidenceEntryShape = FILES.filter(
      (file) =>
        notThisSpec(file) &&
        /["']sourceFactId["']\s*:/.test(file.source) &&
        /["']assetSha256["']\s*:/.test(file.source) &&
        /["']rawMethodPresent["']\s*:/.test(file.source),
    ).map(({ path }) => path);

    expect(evidenceEntryShape).toEqual([]);

    /* The digest helper's name has exactly one legitimate home, and it is the migration. */
    expect(offenders(/review_hash_digest/, notThisSpec)).toEqual([]);
  });

  /**
   * The two SQL functions are named in exactly one APPLICATION module, so "which module reaches
   * the authoritative hash" has one answer rather than a convention.
   *
   * Scoped to non-spec sources deliberately. Two disposable-database suites name the functions
   * while BUILDING A FIXTURE — approving a probe subject requires quoting the hash the gate will
   * demand, and there is no other way to write that. A call to the one implementation is not a
   * second implementation, and forbidding it would only push those suites into hard-coding a hash,
   * which is the drift this file exists to prevent.
   */
  it("names the v2 hash functions in only one application module", () => {
    const callers = FILES.filter(
      ({ path, source }) =>
        !/\.spec\.tsx?$/.test(path) &&
        /specification_review_hash_v2|product_claim_review_hash_v2/.test(source),
    ).map(({ path }) => path);

    expect(callers).toHaveLength(1);
    expect(callers[0]).toMatch(/evidence-set-hash\.ts$/);
  });

  /**
   * And the retired v1 functions are named nowhere at all.
   *
   * The migration that DROPs them is `.sql` and is not walked, so this is a statement about
   * TypeScript only: no call site survives against a function that no longer exists.
   */
  it("calls no retired v1 hash function", () => {
    expect(
      offenders(
        /specification_evidence_set_hash|product_claim_evidence_set_hash|evidence_set_hash_lines/,
        notThisSpec,
      ),
    ).toEqual([]);
  });
});
