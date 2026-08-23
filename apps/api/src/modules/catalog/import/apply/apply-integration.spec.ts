/**
 * The catalog writer, executed end to end against disposable databases.
 *
 * ── What makes this different from `apply-engine.spec.ts` ───────────────────
 *
 * That file proves the plan, the identities and the ordering with no database at all, which
 * is the right way to test a pure function. This file proves the things only PostgreSQL can
 * answer: that the ADR-011 triggers really release and re-claim slugs, that a `CASCADE` really
 * takes what the guard says it would, that a failure at any step really restores the ten demo
 * Products, and that the counts the manifest promises are the counts the tables end up with.
 *
 * ── Every database here is created and dropped by the test ──────────────────
 *
 * Named `sam_platform_disposable_*`, cloned from the live template, dropped afterwards. The
 * writer refuses any other name, so no configuration mistake can point one of these at
 * `sam_platform`.
 *
 * ── Skipping ────────────────────────────────────────────────────────────────
 *
 * Without `CATALOG_APPLY_TEST_ADMIN_URL` and `CATALOG_WORKBOOK` the whole suite is skipped by
 * name rather than silently passing. The workbook is not in version control and CI has never
 * had a copy of it.
 */

import { randomUUID } from "node:crypto";

import { APPROVED_PLAN_EXPECTATIONS } from "./apply-engine";
import {
  AUDITED_DEMO_PRODUCT_COUNT,
  AUDITED_DEMO_PRODUCT_SEGMENT_COUNT,
  AUDITED_DEMO_SLUGS,
} from "./demo-guard";
import { runApplyOnDisposableDatabase } from "./disposable-harness";
import { buildPlanFor } from "./__tests__/build-plan";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readCounts,
  readIntegrationConfig,
  withDisposableClient,
} from "./__tests__/disposable-database";

import type { ApplyResult } from "./executor";
import type { IntegrationConfig } from "./__tests__/disposable-database";

const config = readIntegrationConfig();
const suite = config === null ? describe.skip : describe;

/** The authoritative ProductSegment count, computed from the manifest rather than assumed. */
const EXPECTED_PRODUCT_SEGMENTS = 41;
const EXPECTED_SPEC_PROPERTY_MAPPINGS = 75;
const EXPECTED_CATEGORY_SLUG_CLAIMS = 6;

/** Cloning plus a full apply is well past Jest's default. */
const TIMEOUT_MS = 180_000;

/** Every database this file creates, so a failure cannot leak one. */
const created = new Set<string>();

async function clone(suffix: string): Promise<string> {
  const url = await createDisposableDatabase(
    config as IntegrationConfig,
    `${suffix}_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
  );
  created.add(url);
  return url;
}

async function drop(url: string): Promise<void> {
  await dropDisposableDatabase(config as IntegrationConfig, url);
  created.delete(url);
}

async function apply(
  url: string,
  overrides: Partial<Parameters<typeof runApplyOnDisposableDatabase>[0]> = {},
): Promise<ApplyResult> {
  const inputs = await buildPlanFor(url, (config as IntegrationConfig).workbookPath);
  return runApplyOnDisposableDatabase({
    connectionString: url,
    plan: inputs.plan,
    manifestHash: inputs.manifestHash,
    workbookSha256: inputs.workbookSha256,
    ledgerSha256: inputs.ledgerSha256,
    demoReplacementAuthorized: true,
    ...overrides,
  });
}

/** Runs an apply expected to fail, and returns the message. Passing means it did NOT fail. */
async function applyExpectingRefusal(
  url: string,
  overrides: Partial<Parameters<typeof runApplyOnDisposableDatabase>[0]> = {},
): Promise<string> {
  try {
    await apply(url, overrides);
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("The apply succeeded; it was expected to refuse.");
}

async function exec(url: string, sql: string, ...params: unknown[]): Promise<void> {
  await withDisposableClient(url, async (client) => {
    await client.$executeRawUnsafe(sql, ...params);
  });
}

afterAll(async () => {
  for (const url of [...created]) await drop(url);
}, TIMEOUT_MS);

/* ========================================================================== */
/* First apply, replay, and what the tables hold afterwards                    */
/* ========================================================================== */

suite("first apply on a clone of the current catalogue", () => {
  let url = "";
  let result: ApplyResult;
  let before: Record<string, number>;
  let after: Record<string, number>;

  beforeAll(async () => {
    url = await clone("first");
    before = await readCounts(url);
    result = await apply(url);
    after = await readCounts(url);
  }, TIMEOUT_MS);

  it("starts from the audited baseline: ten demos, eighteen memberships, sixteen claims", () => {
    expect(before["products"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
    expect(before["products_demo"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
    expect(before["products_with_source_ref"]).toBe(0);
    expect(before["product_segments"]).toBe(AUDITED_DEMO_PRODUCT_SEGMENT_COUNT);
    expect(before["slug_claims_product"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
    expect(before["slug_claims_category"]).toBe(EXPECTED_CATEGORY_SLUG_CLAIMS);
    expect(before["product_types"]).toBe(0);
    expect(before["import_runs"]).toBe(0);
  });

  it("runs as a FIRST_APPLY and deletes exactly the ten audited demos", () => {
    expect(result.mode).toBe("FIRST_APPLY");
    expect(result.demoProductsDeleted).toBe(AUDITED_DEMO_PRODUCT_COUNT);
    expect(after["products_demo"]).toBe(0);
  });

  it("releases the ten demo slug claims through the ADR-011 delete trigger", () => {
    expect(after["slug_claims_demo"]).toBe(0);
  });

  it("preserves all six Category slug claims", () => {
    expect(after["slug_claims_category"]).toBe(EXPECTED_CATEGORY_SLUG_CLAIMS);
  });

  it("writes exactly the approved number of rows in every table", () => {
    expect(after["products"]).toBe(APPROVED_PLAN_EXPECTATIONS.products);
    expect(after["products_with_source_ref"]).toBe(APPROVED_PLAN_EXPECTATIONS.products);
    expect(after["product_types"]).toBe(8);
    expect(after["spec_properties"]).toBe(26);
    expect(after["spec_property_mappings"]).toBe(EXPECTED_SPEC_PROPERTY_MAPPINGS);
    expect(after["product_segments"]).toBe(EXPECTED_PRODUCT_SEGMENTS);
    expect(after["product_grades"]).toBe(APPROVED_PLAN_EXPECTATIONS.productGrades);
    expect(after["source_facts"]).toBe(APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts);
    expect(after["specifications"]).toBe(APPROVED_PLAN_EXPECTATIONS.specifications);
    expect(after["product_claims"]).toBe(APPROVED_PLAN_EXPECTATIONS.productClaims);
    expect(after["specification_evidence"]).toBe(APPROVED_PLAN_EXPECTATIONS.specificationEvidence);
    expect(after["claim_evidence"]).toBe(APPROVED_PLAN_EXPECTATIONS.claimEvidence);
    expect(after["source_assets"]).toBe(APPROVED_PLAN_EXPECTATIONS.sourceAssets);
    expect(after["source_documents"]).toBe(APPROVED_PLAN_EXPECTATIONS.sourceDocuments);
  });

  it("reports every table as INSERT and nothing as SKIP", () => {
    for (const [table, outcome] of Object.entries(result.tables)) {
      expect([table, outcome.skipped]).toEqual([table, 0]);
      expect(outcome.inserted).toBeGreaterThan(0);
    }
  });

  it("finishes with 106 Product and Category slug claims and nothing else", () => {
    expect(after["slug_claims_product"]).toBe(APPROVED_PLAN_EXPECTATIONS.products);
    expect(after["product_slug_claims"]).toBe(
      APPROVED_PLAN_EXPECTATIONS.products + EXPECTED_CATEGORY_SLUG_CLAIMS,
    );
  });

  it("gives all 100 Products a distinct ratified sourceRef and a distinct slug", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ refs: number; slugs: number }[]>(
        `SELECT count(DISTINCT source_ref)::int AS refs, count(DISTINCT slug)::int AS slugs
           FROM products`,
      ),
    );
    expect(Number(found[0]?.refs)).toBe(APPROVED_PLAN_EXPECTATIONS.products);
    expect(Number(found[0]?.slugs)).toBe(APPROVED_PLAN_EXPECTATIONS.products);
  });

  it("keeps the five owner-decided Gear rows in the Marine family as gear-oils", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM products p
           JOIN categories c ON c.id = p.category_id
           JOIN product_types t ON t.id = p.product_type_id
          WHERE c.slug = 'marine-oils-lubricants' AND t.slug = 'gear-oils'`,
      ),
    );
    expect(Number(found[0]?.n)).toBe(5);
  });

  it("leaves the 130 withheld readings as SourceFacts and never as Specifications", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ backed: number }[]>(
        `SELECT count(DISTINCT source_fact_id)::int AS backed FROM specification_evidence`,
      ),
    );
    // 1,661 readings, 1,398 of them backing a Specification. Nothing withheld normalized.
    expect(Number(found[0]?.backed)).toBe(APPROVED_PLAN_EXPECTATIONS.specifications);
    expect(after["source_facts"]).toBeGreaterThan(Number(found[0]?.backed));
  });

  it("preserves MappingConfidence exactly as reviewed: 52 HIGH, 15 MEDIUM, 8 LOW", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ confidence: string; n: number }[]>(
        `SELECT confidence::text AS confidence, count(*)::int AS n
           FROM spec_property_mappings GROUP BY 1`,
      ),
    );
    const byConfidence = Object.fromEntries(found.map((row) => [row.confidence, Number(row.n)]));
    expect(byConfidence).toEqual({ high: 52, medium: 15, low: 8 });
  });

  it("approves nothing, anywhere", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ n: number }[]>(
        `SELECT (SELECT count(*) FROM specifications WHERE review_status = 'approved')
              + (SELECT count(*) FROM product_claims WHERE review_status = 'approved')
              + (SELECT count(*) FROM spec_property_mappings WHERE review_status = 'approved')
              AS n`,
      ),
    );
    expect(Number(found[0]?.n)).toBe(0);
  });

  it("records exactly one successful ImportRun, for this manifest", async () => {
    expect(result.importRunCreated).toBe(true);
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ manifest_hash: string; finished: boolean }[]>(
        `SELECT manifest_hash, finished_at IS NOT NULL AS finished FROM import_runs`,
      ),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.manifest_hash).toBe(result.manifestHash);
    expect(found[0]?.finished).toBe(true);
  });

  /* ---- replay, on the very database the first apply produced ---- */

  it(
    "replays as IDENTICAL_REPLAY with 100 SKIP and zero writes anywhere",
    async () => {
      const replay = await apply(url);
      expect(replay.mode).toBe("IDENTICAL_REPLAY");
      expect(replay.demoProductsDeleted).toBe(0);
      expect(replay.importRunCreated).toBe(false);
      expect(replay.tables["products"]).toEqual({
        inserted: 0,
        skipped: APPROVED_PLAN_EXPECTATIONS.products,
      });
      for (const [table, outcome] of Object.entries(replay.tables)) {
        expect([table, outcome.inserted]).toEqual([table, 0]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "leaves every count identical after the replay, and adds no second ImportRun",
    async () => {
      const afterReplay = await readCounts(url);
      expect(afterReplay).toEqual(after);
      expect(afterReplay["import_runs"]).toBe(1);
      expect(afterReplay["import_runs_finished"]).toBe(1);
    },
    TIMEOUT_MS,
  );

  it(
    "plans 100 SKIP on a dry run against the imported database",
    async () => {
      const inputs = await buildPlanFor(url, (config as IntegrationConfig).workbookPath);
      expect(inputs.plan.counts.products.skip).toBe(APPROVED_PLAN_EXPECTATIONS.products);
      expect(inputs.plan.counts.products.insert).toBe(0);
      expect(inputs.plan.counts.products.update).toBe(0);
      expect(inputs.plan.counts.products.conflict).toBe(0);
    },
    TIMEOUT_MS,
  );
});

/* ========================================================================== */
/* The demo guard, against a real database                                     */
/* ========================================================================== */

suite("demo replacement guard", () => {
  const mutations: readonly {
    readonly name: string;
    readonly mutate: (url: string) => Promise<void>;
    readonly refusal: RegExp;
  }[] = [
    {
      name: "nine demo Products",
      mutate: async (url) => {
        await exec(url, `DELETE FROM products WHERE slug = $1`, AUDITED_DEMO_SLUGS[0]);
      },
      refusal: /Expected exactly 10 demo Products; found 9/,
    },
    {
      name: "eleven demo Products",
      mutate: async (url) => {
        await exec(
          url,
          `INSERT INTO products (id, name, slug, category_id)
           SELECT gen_random_uuid(), 'SAM Demo Extra', 'sam-demo-extra', id FROM categories LIMIT 1`,
        );
      },
      refusal: /Expected exactly 10 demo Products; found 11/,
    },
    {
      name: "a demo slug outside the audited allowlist",
      mutate: async (url) => {
        await exec(
          url,
          `UPDATE products SET slug = 'sam-demo-not-audited' WHERE slug = $1`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      refusal: /Not in the audited allowlist: sam-demo-not-audited/,
    },
    {
      name: "a demo Product carrying a ratified sourceRef",
      mutate: async (url) => {
        await exec(
          url,
          `UPDATE products SET source_ref = 'SAMCAT-W1-R999' WHERE slug = $1`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      refusal: /carries source_ref SAMCAT-W1-R999\. A ratified Product is never deleted/,
    },
    {
      name: "an unexpected ProductGrade on a demo Product",
      mutate: async (url) => {
        await exec(
          url,
          `INSERT INTO product_grades (id, product_id, label, sort_order)
           SELECT gen_random_uuid(), id, 'SAE 40', 0 FROM products WHERE slug = $1`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      refusal: /has 1 ProductGrade rows/,
    },
    {
      name: "an unexpected Specification on a demo Product",
      mutate: async (url) => {
        await exec(
          url,
          `INSERT INTO specifications (id, product_id, key, value)
           SELECT gen_random_uuid(), id, 'legacy', '1' FROM products WHERE slug = $1`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      refusal: /has 1 Specification rows, which would CASCADE/,
    },
    {
      name: "an unexpected ProductClaim on a demo Product",
      mutate: async (url) => {
        await exec(
          url,
          `INSERT INTO product_claims (id, product_id, kind)
           SELECT gen_random_uuid(), id, 'meets'::product_claim_kind
             FROM products WHERE slug = $1`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      refusal: /has 1 ProductClaim rows, which would CASCADE/,
    },
    {
      name: "an unexpected SourceFact reachable from a demo Product",
      mutate: async (url) => {
        await exec(
          url,
          `WITH run AS (
             INSERT INTO import_runs (id, importer_version, started_at)
             VALUES (gen_random_uuid(), 'test/0', now()) RETURNING id
           ), doc AS (
             INSERT INTO source_documents (id, locator_type, locator_value, title, retrieved_at)
             VALUES (gen_random_uuid(), 'url'::source_locator_type, 'https://example.invalid/x',
                     'unexpected', now())
             RETURNING id
           ), fact AS (
             INSERT INTO source_facts (id, source_document_id, import_run_id, raw_value,
                                       extraction_method, unit_classification)
             SELECT gen_random_uuid(), doc.id, run.id, 'unexpected',
                    'manual_transcription'::extraction_method, 'absent'::source_unit_classification
               FROM doc, run RETURNING id
           ), claim AS (
             INSERT INTO product_claims (id, product_id, kind)
             SELECT gen_random_uuid(), id, 'meets'::product_claim_kind
               FROM products WHERE slug = $1 RETURNING id
           )
           INSERT INTO claim_evidence (product_claim_id, source_fact_id, role)
           SELECT claim.id, fact.id, 'primary'::evidence_role FROM claim, fact`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      // The Claim is seen first; the guard reports the first breach it finds, and the point
      // is that a demo row with evidence hanging off it is never deleted.
      refusal: /ProductClaim rows, which would CASCADE|is cited by 1 SourceFacts/,
    },
    {
      name: "an Inquiry pointing at a demo Product",
      mutate: async (url) => {
        await exec(
          url,
          `INSERT INTO inquiries (id, first_name, last_name, company_name, country, email,
                                  industry, inquiry_type, message, consent_given, status,
                                  related_product_id)
           SELECT gen_random_uuid(), 'A', 'Buyer', 'Buyer Ltd', 'DE',
                  'buyer@example.invalid', 'Manufacturing',
                  'product_inquiry'::inquiry_type, 'Is this available?', true,
                  'new', id
             FROM products WHERE slug = $1`,
          AUDITED_DEMO_SLUGS[0],
        );
      },
      refusal: /is referenced by 1 Inquiry rows/,
    },
    {
      name: "a ProductSegment count other than eighteen",
      mutate: async (url) => {
        await exec(
          url,
          `DELETE FROM product_segments WHERE ctid IN (SELECT ctid FROM product_segments LIMIT 1)`,
        );
      },
      refusal: /Expected 18 ProductSegment rows across the ten demo Products; found 17/,
    },
    {
      name: "a demo slug-claim count other than ten",
      mutate: async (url) => {
        await exec(url, `DELETE FROM product_slug_claims WHERE slug = $1`, AUDITED_DEMO_SLUGS[0]);
      },
      refusal: /Expected 10 trigger-managed slug claims for the demo Products; found 9/,
    },
  ];

  it.each(mutations.map((m) => [m.name, m] as const))(
    "refuses to delete when the database shows %s",
    async (_name, mutation) => {
      const url = await clone("guard");
      try {
        await mutation.mutate(url);
        const before = await readCounts(url);

        const message = await applyExpectingRefusal(url);
        expect(message).toMatch(mutation.refusal);

        // Byte for byte the state the mutation left behind. The refusal rolled the whole
        // transaction back, the reference vocabulary written before the guard included, and
        // the mutation itself is untouched because the apply never got to it.
        const after = await readCounts(url);
        expect(after).toEqual(before);
        expect(after["product_types"]).toBe(0);
        expect(after["spec_properties"]).toBe(0);
        expect(after["import_runs"]).toBe(before["import_runs"]);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "refuses when demo replacement was never authorized",
    async () => {
      const url = await clone("unauth");
      try {
        const message = await applyExpectingRefusal(url, { demoReplacementAuthorized: false });
        expect(message).toMatch(/Demo replacement was not authorized/);
        const counts = await readCounts(url);
        expect(counts["products_demo"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
        expect(counts["products_with_source_ref"]).toBe(0);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );
});

/* ========================================================================== */
/* Rollback                                                                    */
/* ========================================================================== */

suite("a failure at any step restores everything", () => {
  const steps: readonly [string, string][] = [
    ["demo-delete", "immediately after the ten demos were deleted"],
    ["products", "after the hundredth Product was inserted"],
    ["specification_evidence", "during evidence insertion"],
    ["post-write-verification", "after the post-write verification passed"],
  ];

  it.each(steps)(
    "rolls back a failure %s (%s)",
    async (step) => {
      const url = await clone("rollback");
      try {
        const before = await readCounts(url);
        const message = await applyExpectingRefusal(url, {
          faultInjector: (completed: string) => {
            if (completed === step) throw new Error(`INJECTED FAULT after "${completed}"`);
          },
        });
        expect(message).toMatch(/INJECTED FAULT/);

        const after = await readCounts(url);
        // Every demo Product, every membership and every trigger-managed claim is back.
        expect(after).toEqual(before);
        expect(after["products_demo"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
        expect(after["product_segments"]).toBe(AUDITED_DEMO_PRODUCT_SEGMENT_COUNT);
        expect(after["slug_claims_demo"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
        expect(after["slug_claims_category"]).toBe(EXPECTED_CATEGORY_SLUG_CLAIMS);
        expect(after["import_runs"]).toBe(0);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "rolls back when the post-write verification itself finds a problem",
    async () => {
      const url = await clone("verify");
      try {
        // A SourceAsset the plan does not describe. It touches no demo Product, so the guard
        // passes and the failure has to come from the verification.
        await exec(
          url,
          `INSERT INTO source_assets (id, sha256, byte_size, media_type)
           VALUES (gen_random_uuid(), repeat('a', 64), 1, 'application/pdf')`,
        );
        const before = await readCounts(url);

        const message = await applyExpectingRefusal(url);
        expect(message).toMatch(/Post-write verification failed/);
        expect(message).toMatch(/orphan_source_assets/);

        const after = await readCounts(url);
        expect(after).toEqual(before);
        expect(after["products_demo"]).toBe(AUDITED_DEMO_PRODUCT_COUNT);
        expect(after["products_with_source_ref"]).toBe(0);
        expect(after["import_runs"]).toBe(0);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "never marks an ImportRun successful when a later step fails",
    async () => {
      const url = await clone("runopen");
      try {
        await applyExpectingRefusal(url, {
          faultInjector: (completed: string) => {
            if (completed === "post-write-verification") throw new Error("INJECTED FAULT");
          },
        });
        const counts = await readCounts(url);
        expect(counts["import_runs"]).toBe(0);
        expect(counts["import_runs_finished"]).toBe(0);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );
});

/* ========================================================================== */
/* Partial state                                                               */
/* ========================================================================== */

suite("a partially imported catalogue", () => {
  it(
    "refuses rather than completing itself when some Products are already persisted",
    async () => {
      const url = await clone("partial");
      try {
        await apply(url);
        // Remove one Product. The catalogue is now neither empty nor complete.
        await exec(
          url,
          `DELETE FROM claim_evidence WHERE product_claim_id IN
             (SELECT id FROM product_claims WHERE product_id IN
               (SELECT id FROM products ORDER BY source_ref LIMIT 1))`,
        );
        await exec(
          url,
          `DELETE FROM specification_evidence WHERE specification_id IN
             (SELECT id FROM specifications WHERE product_id IN
               (SELECT id FROM products ORDER BY source_ref LIMIT 1))`,
        );
        await exec(
          url,
          `DELETE FROM product_grades WHERE product_id IN
             (SELECT id FROM products ORDER BY source_ref LIMIT 1)`,
        );
        await exec(
          url,
          `DELETE FROM products WHERE id IN
             (SELECT id FROM products ORDER BY source_ref LIMIT 1)`,
        );

        const message = await applyExpectingRefusal(url);
        expect(message).toMatch(/99 of 100 ratified identities are already persisted/);
        expect(message).toMatch(/never completed automatically/);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "refuses a replay whose technical rows are missing rather than back-filling them",
    async () => {
      const url = await clone("noevidence");
      try {
        await apply(url);
        // All 100 Products stay, so this is still a replay by every identity test — but the
        // normalized layer is gone. `source_facts` is deliberately NOT touched: the
        // ADR-014 immutability trigger refuses DELETE, which is itself the proof that
        // evidence cannot be quietly removed and re-derived.
        await exec(url, `DELETE FROM specification_evidence`);
        await exec(url, `DELETE FROM claim_evidence`);
        await exec(url, `DELETE FROM specifications`);
        await exec(url, `DELETE FROM product_claims`);

        const message = await applyExpectingRefusal(url);
        expect(message).toMatch(/A replay would insert 1398 specifications rows/);
        expect(message).toMatch(/partial catalogue and is never completed automatically/);

        // It refused instead of repairing.
        const counts = await readCounts(url);
        expect(counts["specifications"]).toBe(0);
        expect(counts["product_claims"]).toBe(0);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "cannot delete a SourceFact at all: ADR-014 immutability is enforced by trigger",
    async () => {
      const url = await clone("immutable");
      try {
        await apply(url);
        await expect(exec(url, `DELETE FROM source_facts WHERE true`)).rejects.toThrow(
          /source_facts rows are immutable extracted evidence/,
        );
        await expect(exec(url, `UPDATE source_facts SET raw_value = 'tampered'`)).rejects.toThrow(
          /immutable/,
        );
        const counts = await readCounts(url);
        expect(counts["source_facts"]).toBe(APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "refuses when a persisted row carries different immutable data",
    async () => {
      const url = await clone("conflict");
      try {
        await apply(url);
        // A ProductType whose display name was changed behind the importer's back.
        await exec(url, `UPDATE product_types SET name = 'Renamed' WHERE slug = 'engine-oils'`);

        const message = await applyExpectingRefusal(url);
        expect(message).toMatch(/product_types: a row already exists under identity/);
        expect(message).toMatch(/refuses rather than overwriting it/);

        // And it really did not overwrite it.
        const found = await withDisposableClient(url, (client) =>
          client.$queryRawUnsafe<{ name: string }[]>(
            `SELECT name FROM product_types WHERE slug = 'engine-oils'`,
          ),
        );
        expect(found[0]?.name).toBe("Renamed");
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "refuses to record one manifest as two successful applications",
    async () => {
      const url = await clone("tworuns");
      try {
        const first = await apply(url);
        // Take the Products away but leave the successful run behind — the only shape in
        // which one manifest could be recorded as applied twice. `source_facts` stays,
        // because it cannot be deleted, and nothing about it changes the question.
        await exec(url, `DELETE FROM claim_evidence`);
        await exec(url, `DELETE FROM specification_evidence`);
        await exec(url, `DELETE FROM specifications`);
        await exec(url, `DELETE FROM product_claims`);
        await exec(url, `DELETE FROM product_grades`);
        await exec(url, `DELETE FROM products`);

        const message = await applyExpectingRefusal(url);
        expect(message).toMatch(
          new RegExp(`Manifest ${first.manifestHash} was already applied successfully`),
        );
        expect(message).toMatch(/this is not a replay/);

        // Refused in the preflight, so the ten demo Products were never even considered.
        const counts = await readCounts(url);
        expect(counts["import_runs_finished"]).toBe(1);
        expect(counts["products"]).toBe(0);
      } finally {
        await drop(url);
      }
    },
    TIMEOUT_MS,
  );
});

/* ========================================================================== */
/* The harness itself                                                          */
/* ========================================================================== */

describe("the disposable harness refuses a real database", () => {
  it.each(["sam_platform", "sam_cms", "postgres", "template1"])(
    "refuses to open %s",
    async (name) => {
      await expect(
        runApplyOnDisposableDatabase({
          connectionString: `postgresql://u:p@localhost:5432/${name}`,
          plan: {} as never,
          manifestHash: "0".repeat(64),
          workbookSha256: "0".repeat(64),
          ledgerSha256: "0".repeat(64),
          demoReplacementAuthorized: true,
        }),
      ).rejects.toThrow(/is a real database/);
    },
  );

  it("refuses a database that is not named as disposable", async () => {
    await expect(
      runApplyOnDisposableDatabase({
        connectionString: "postgresql://u:p@localhost:5432/sam_platform_backup",
        plan: {} as never,
        manifestHash: "0".repeat(64),
        workbookSha256: "0".repeat(64),
        ledgerSha256: "0".repeat(64),
        demoReplacementAuthorized: true,
      }),
    ).rejects.toThrow(/is not named as a disposable database/);
  });
});
