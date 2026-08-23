/**
 * What happens when a source is RE-ISSUED.
 *
 * ── The distinction the whole design turns on ───────────────────────────────
 *
 * A claim's identity is WHAT IT SAYS. Where it was found is evidence, evidence has its own
 * identity, and the two revise independently:
 *
 *   the sentence moved from page 33 to page 35   -> same claim, NEW evidence
 *   the sentence now says something different    -> DIFFERENT claim, needs review
 *
 * ADR-015 §3 records that an earlier version hashed the SourceFact evidence identity, which
 * includes the page number — so a supplier re-issuing a catalogue produced a SECOND ACTIVE
 * CLAIM for a statement that never changed. These tests are what keep that from coming back.
 *
 * ── Immutability is not a convention here ───────────────────────────────────
 *
 * `source_facts_immutable_guard` refuses UPDATE and DELETE outright. A revised reading is a
 * NEW row; the old one stays, and its `ClaimEvidence` link is retired by role rather than
 * removed. The database-backed half of this file proves that against PostgreSQL, because a
 * trigger is the only thing that can prove it.
 */

import { randomUUID } from "node:crypto";

import { evidenceHashOf } from "../import-planner";

import { APPROVED_PLAN_EXPECTATIONS } from "./apply-engine";
import { runApplyOnDisposableDatabase } from "./disposable-harness";
import * as ids from "./identities";
import { buildPlanFor } from "./__tests__/build-plan";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readCounts,
  readIntegrationConfig,
  withDisposableClient,
} from "./__tests__/disposable-database";

import type { PlannedProduct } from "../catalog-import.types";
import type { IntegrationConfig } from "./__tests__/disposable-database";

const config = readIntegrationConfig();
const suite = config === null ? describe.skip : describe;
const TIMEOUT_MS = 180_000;

/* ========================================================================== */
/* The identity rules, with no database involved                               */
/* ========================================================================== */

describe("claim identity across a re-issued document", () => {
  const STATEMENT = "Meets API CJ-4 performance requirements.";
  const claimFor = (statement: string): string =>
    ids.productClaimId(
      "SAMCAT-W1-R101",
      null,
      "MEETS",
      "API",
      "CJ-4",
      ids.claimIdentityHash(statement),
    );

  it("is unchanged when the same sentence moves to another page", () => {
    // The page is not an input to the identity at all — there is no argument for it to
    // arrive through, which is a stronger guarantee than agreeing not to pass one.
    expect(claimFor(STATEMENT)).toBe(claimFor(STATEMENT));
  });

  it("is unchanged by typography that is not meaning", () => {
    expect(claimFor(STATEMENT)).toBe(claimFor("  meets   API CJ-4 performance requirements. "));
  });

  it("is DIFFERENT when the sentence says something else", () => {
    expect(claimFor(STATEMENT)).not.toBe(claimFor("Meets API CK-4 performance requirements."));
  });

  it("separates two statements that reduce to the same normalized columns", () => {
    // The case the discriminator exists for: same product, same kind, no body and no code,
    // and only the sentence tells them apart.
    const suitable = (statement: string): string =>
      ids.productClaimId(
        "SAMCAT-W1-R101",
        null,
        "SUITABLE_FOR",
        null,
        null,
        ids.claimIdentityHash(statement),
      );
    expect(suitable("Suitable for hydraulic systems.")).not.toBe(
      suitable("Suitable for gearboxes."),
    );
  });
});

describe("the product evidence hash", () => {
  const fact = (page: number | null, rawValue: string): PlannedProduct["technicalFacts"][number] =>
    ({
      sourceFact: {
        documentKey: "DOC-1",
        sheetName: null,
        pageNumber: page,
        rowNumber: null,
        columnLabel: "VALUE",
        rawProperty: "Flash point",
        rawUnit: "°C",
        rawValue,
        rawMethod: "ASTM D 92",
        rawGrade: null,
        extractionMethod: "MANUAL_TRANSCRIPTION",
        unitClassification: "STATED",
        resultBasisOverride: null,
      },
      gradeLabel: null,
      resolvedPropertyKey: null,
      specification: null,
      withheldReason: null,
      withheldDetail: null,
      shapeViolations: [],
      flags: [],
    }) as PlannedProduct["technicalFacts"][number];

  const productWith = (facts: PlannedProduct["technicalFacts"]): PlannedProduct =>
    ({ technicalFacts: facts, claims: [] }) as unknown as PlannedProduct;

  it("changes when a reading moves to another page, so any approval of it expires", () => {
    // Approval is keyed to the evidence a reviewer actually looked at. A re-issued document
    // is different evidence even when the number on the page is the same, and the reviewer
    // has to see it again.
    expect(evidenceHashOf(productWith([fact(33, "Min 170")]))).not.toBe(
      evidenceHashOf(productWith([fact(35, "Min 170")])),
    );
  });

  it("changes when the reading itself changes", () => {
    expect(evidenceHashOf(productWith([fact(33, "Min 170")]))).not.toBe(
      evidenceHashOf(productWith([fact(33, "Min 180")])),
    );
  });

  it("is stable for an unchanged reading", () => {
    expect(evidenceHashOf(productWith([fact(33, "Min 170")]))).toBe(
      evidenceHashOf(productWith([fact(33, "Min 170")])),
    );
  });
});

/* ========================================================================== */
/* The same rules, against PostgreSQL                                          */
/* ========================================================================== */

suite("a re-issued document, applied to an imported catalogue", () => {
  let url = "";
  let claimId = "";
  let oldFactId = "";
  let newFactId = "";
  let identityHashBefore = "";
  let oldFactBefore: Record<string, unknown> = {};

  beforeAll(async () => {
    url = await createDisposableDatabase(
      config as IntegrationConfig,
      `revision_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
    );
    const inputs = await buildPlanFor(url, (config as IntegrationConfig).workbookPath);
    await runApplyOnDisposableDatabase({
      connectionString: url,
      plan: inputs.plan,
      manifestHash: inputs.manifestHash,
      workbookSha256: inputs.workbookSha256,
      ledgerSha256: inputs.ledgerSha256,
      demoReplacementAuthorized: true,
    });

    await withDisposableClient(url, async (client) => {
      const found = await client.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT c.id AS claim_id, c.claim_identity_hash, f.*
           FROM product_claims c
           JOIN claim_evidence e ON e.product_claim_id = c.id
           JOIN source_facts f ON f.id = e.source_fact_id
          WHERE f.page_number IS NOT NULL
          ORDER BY c.id
          LIMIT 1`,
      );
      const row = found[0] ?? {};
      claimId = String(row["claim_id"]);
      oldFactId = String(row["id"]);
      identityHashBefore = String(row["claim_identity_hash"]);
      oldFactBefore = row;

      // The re-issue: the SAME statement, at a different place in the same document. A new
      // row, because the evidence identity includes the page and the page changed.
      newFactId = randomUUID();
      await client.$executeRawUnsafe(
        `INSERT INTO source_facts
           (id, source_document_id, import_run_id, page_number, sheet_name, row_number,
            column_label, raw_property, raw_unit, raw_value, raw_method, raw_grade,
            extraction_method, unit_classification, result_basis_override)
         SELECT $1::uuid, source_document_id, import_run_id, page_number + 2, sheet_name,
                row_number, column_label, raw_property, raw_unit, raw_value, raw_method,
                raw_grade, extraction_method, unit_classification, result_basis_override
           FROM source_facts WHERE id = $2::uuid`,
        newFactId,
        oldFactId,
      );
      // The claim now cites the newer reading, and the older link is RETIRED rather than
      // removed: the history of what supported this claim stays readable.
      await client.$executeRawUnsafe(
        `INSERT INTO claim_evidence (product_claim_id, source_fact_id, role)
         VALUES ($1::uuid, $2::uuid, 'primary'::evidence_role)`,
        claimId,
        newFactId,
      );
      await client.$executeRawUnsafe(
        `UPDATE claim_evidence SET role = 'superseded'::evidence_role
          WHERE product_claim_id = $1::uuid AND source_fact_id = $2::uuid`,
        claimId,
        oldFactId,
      );
    });
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (url) await dropDisposableDatabase(config as IntegrationConfig, url);
  }, TIMEOUT_MS);

  it("keeps the claim's identity: same row, same identity hash, no second claim", async () => {
    const counts = await readCounts(url);
    expect(counts["product_claims"]).toBe(APPROVED_PLAN_EXPECTATIONS.productClaims);

    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ claim_identity_hash: string }[]>(
        `SELECT claim_identity_hash FROM product_claims WHERE id = $1::uuid`,
        claimId,
      ),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.claim_identity_hash).toBe(identityHashBefore);
  });

  it("records the revision as a NEW SourceFact and leaves the old one exactly as it was", async () => {
    const counts = await readCounts(url);
    expect(counts["source_facts"]).toBe(APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts + 1);

    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM source_facts WHERE id = $1::uuid`,
        oldFactId,
      ),
    );
    const now = found[0] ?? {};
    for (const column of [
      "source_document_id",
      "page_number",
      "raw_property",
      "raw_unit",
      "raw_value",
      "raw_method",
      "raw_grade",
      "extraction_method",
      "unit_classification",
    ]) {
      expect([column, String(now[column])]).toEqual([column, String(oldFactBefore[column])]);
    }
  });

  it("points the claim at the newer evidence and retires the older link", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ source_fact_id: string; role: string }[]>(
        `SELECT source_fact_id, role::text AS role FROM claim_evidence
          WHERE product_claim_id = $1::uuid ORDER BY role`,
        claimId,
      ),
    );
    expect(found).toHaveLength(2);
    expect(found.find((row) => row.source_fact_id === newFactId)?.role).toBe("primary");
    expect(found.find((row) => row.source_fact_id === oldFactId)?.role).toBe("superseded");
  });

  it("refuses to UPDATE or DELETE the superseded reading", async () => {
    await withDisposableClient(url, async (client) => {
      await expect(
        client.$executeRawUnsafe(
          `UPDATE source_facts SET raw_value = 'rewritten' WHERE id = $1::uuid`,
          oldFactId,
        ),
      ).rejects.toThrow(/immutable/);
      await expect(
        client.$executeRawUnsafe(`DELETE FROM source_facts WHERE id = $1::uuid`, oldFactId),
      ).rejects.toThrow(/immutable/);
    });
  });

  it("leaves the revised claim unpublished and still unapproved", async () => {
    const found = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ review_status: string }[]>(
        `SELECT review_status::text AS review_status FROM product_claims WHERE id = $1::uuid`,
        claimId,
      ),
    );
    expect(["source_recorded", "needs_review"]).toContain(found[0]?.review_status);
    expect(found[0]?.review_status).not.toBe("approved");
  });

  it(
    "still refuses a replay, because the catalogue no longer matches the plan",
    async () => {
      // A revised catalogue is not a replay of the plan that built the original one, and the
      // engine says so at the first row that disagrees: the retired ClaimEvidence link now
      // carries role SUPERSEDED where the plan says PRIMARY.
      //
      // That is the intended refusal, and it is worth being explicit about what it costs: once
      // a review service starts retiring evidence links, a re-run of the SAME workbook will
      // refuse rather than skip, because `role` is compared as immutable. Refusing is the
      // correct default for this gate — the alternative is an importer that quietly reinstates
      // evidence a reviewer retired — and reconciling reviewed evidence is the review
      // service's decision to model, not this one's (ADR-015 §10).
      const inputs = await buildPlanFor(url, (config as IntegrationConfig).workbookPath);
      await expect(
        runApplyOnDisposableDatabase({
          connectionString: url,
          plan: inputs.plan,
          manifestHash: inputs.manifestHash,
          workbookSha256: inputs.workbookSha256,
          ledgerSha256: inputs.ledgerSha256,
          demoReplacementAuthorized: true,
        }),
      ).rejects.toThrow(/claim_evidence: a row already exists under identity/);
    },
    TIMEOUT_MS,
  );

  it(
    "leaves the revised catalogue untouched after that refusal",
    async () => {
      const counts = await readCounts(url);
      expect(counts["source_facts"]).toBe(APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts + 1);
      expect(counts["product_claims"]).toBe(APPROVED_PLAN_EXPECTATIONS.productClaims);
      expect(counts["products"]).toBe(APPROVED_PLAN_EXPECTATIONS.products);
      expect(counts["import_runs_finished"]).toBe(1);
    },
    TIMEOUT_MS,
  );
});
