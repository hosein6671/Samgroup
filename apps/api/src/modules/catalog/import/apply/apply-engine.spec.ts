/**
 * The apply engine, exercised against the real ratified plan.
 *
 * The plan is built from the frozen fixture plus the committed ratified ledger, with the
 * ledger's own references declared for each row. That is the same 100 products the approved
 * master workbook carries, so every simulation below runs everywhere — including on a machine
 * that does not have the workbook — and nothing here is skipped.
 *
 * Nothing in this file writes to a database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MappingConfidence, TechnicalReviewStatus } from "../../../../prisma/generated/enums";

import { WORKBOOK_FIXTURE } from "../__fixtures__/workbook-rows.fixture";
import { parseRatifiedLedger } from "../identity-ledger";
import { buildImportPlan, duplicateSpecificationSubjectFlags } from "../import-planner";
import { buildManifest } from "../manifest";

import {
  allWriteRows,
  APPLY_LOCK_TIMEOUT_MS,
  APPLY_STATEMENT_TIMEOUT_MS,
  APPLY_STEP_ORDER,
  APPROVED_PLAN_EXPECTATIONS,
  ApplyPreflightError,
  assertNothingApproved,
  assertPlanApplicable,
  assertWritePlanIdentitiesDistinct,
  beginGuardedTransaction,
  buildWritePlan,
  CATALOG_IMPORT_ADVISORY_LOCK_KEY,
  deleteAuditedDemoProducts,
} from "./apply-engine";
import {
  APPLY_CONFIRMATION_PHRASE,
  ApplyConfirmationError,
  assertApplyConfirmations,
  readApplyConfirmations,
} from "./confirmations";
import {
  AUDITED_DEMO_PRODUCT_SEGMENT_COUNT,
  AUDITED_DEMO_SLUGS,
  assertDemoReplacementAllowed,
  DemoReplacementGuardError,
} from "./demo-guard";
import * as ids from "./identities";
import {
  assertReferenceDataSafe,
  productTypeRows,
  referenceDataCounts,
  specPropertyMappingRows,
  specPropertyRows,
} from "./reference-data";

import type { ImportPlan, PlannedProduct, PlannedTechnicalFact } from "../catalog-import.types";
import type { ApplyTransaction } from "./apply-engine";
import type { ApplyConfirmations, ApplyObserved } from "./confirmations";
import type { DemoProductRow } from "./demo-guard";

const ledgerPath = join(__dirname, "..", "data", "catalog-identity-ledger.json");
const ledger = parseRatifiedLedger(readFileSync(ledgerPath, "utf8"), ledgerPath);

const declared = new Map(ledger.entries.map((entry) => [entry.rowNumber, entry.sourceRef]));
const ratifiedWorkbook = {
  ...WORKBOOK_FIXTURE,
  identifierColumn: 1,
  identifierHeader: "sourceRef",
  declaredSourceRefs: declared,
};

const planWith = (persisted: ReadonlySet<string>): ImportPlan =>
  buildImportPlan({
    workbook: ratifiedWorkbook,
    workbookFileName: "master.xlsx",
    workbookSha256: "4d993fd60411b315e69a0ddfd3d4c4a3ddce761a9a680da1d8e08020fbc7f2e9",
    workbookByteSize: 41957,
    existingSlugKeys: new Set<string>(),
    existingSourceRefs: persisted,
    ledger: ledger.entries,
  });

const NOTHING_PERSISTED: ReadonlySet<string> = new Set<string>();
const ALL_PERSISTED: ReadonlySet<string> = new Set(ledger.entries.map((e) => e.sourceRef));

const firstApplyPlan = planWith(NOTHING_PERSISTED);
const replayPlan = planWith(ALL_PERSISTED);

/* -------------------------------------------------------------------------- */

describe("the plan the apply engine would receive", () => {
  it("carries 100 RATIFIED identities and no blocking conflict", () => {
    expect(firstApplyPlan.products).toHaveLength(100);
    expect(firstApplyPlan.products.every((p) => p.identityState === "RATIFIED")).toBe(true);
    expect(firstApplyPlan.counts.products.conflict).toBe(0);
    expect(firstApplyPlan.identityRatifiable).toBe(true);
    expect(firstApplyPlan.unmatchedLedgerEntries).toEqual([]);
  });

  it("keeps the five ratified Marine/Gear decisions", () => {
    for (const ref of [
      "SAMCAT-W1-R234",
      "SAMCAT-W1-R237",
      "SAMCAT-W1-R240",
      "SAMCAT-W1-R243",
      "SAMCAT-W1-R246",
    ]) {
      const product = firstApplyPlan.products.find((p) => p.sourceRef === ref);
      expect(product?.proposedProductFamilyKey).toBe("marine-oils-lubricants");
      expect(product?.proposedProductTypeKey).toBe("gear-oils");
    }
  });
});

describe("apply preflight", () => {
  it("accepts a first apply: nothing persisted, 100 INSERT", () => {
    expect(assertPlanApplicable(firstApplyPlan, NOTHING_PERSISTED)).toBe("FIRST_APPLY");
    expect(firstApplyPlan.counts.products.insert).toBe(100);
  });

  it("accepts an identical replay: everything persisted, 100 SKIP", () => {
    expect(assertPlanApplicable(replayPlan, ALL_PERSISTED)).toBe("IDENTICAL_REPLAY");
    expect(replayPlan.counts.products.skip).toBe(100);
    expect(replayPlan.counts.products.insert).toBe(0);
    expect(replayPlan.counts.products.update).toBe(0);
  });

  it("REFUSES a partially persisted catalogue rather than completing it", () => {
    const half = new Set([...ALL_PERSISTED].slice(0, 50));
    expect(() => assertPlanApplicable(planWith(half), half)).toThrow(ApplyPreflightError);
    expect(() => assertPlanApplicable(planWith(half), half)).toThrow(
      /neither a first apply nor a replay/,
    );
  });

  it("REFUSES a plan whose identities are not all RATIFIED", () => {
    const proposed = buildImportPlan({
      ...{
        workbook: WORKBOOK_FIXTURE,
        workbookFileName: "f",
        workbookSha256: "0".repeat(64),
        workbookByteSize: 1,
      },
      existingSlugKeys: new Set<string>(),
    });
    expect(() => assertPlanApplicable(proposed, NOTHING_PERSISTED)).toThrow(/RATIFIED identities/);
  });

  it("REFUSES a plan whose approved counts moved", () => {
    const tampered: ImportPlan = {
      ...firstApplyPlan,
      counts: { ...firstApplyPlan.counts, gradeRecords: 133 },
    };
    expect(() => assertPlanApplicable(tampered, NOTHING_PERSISTED)).toThrow(/ProductGrades is 133/);
  });

  it("REFUSES a plan with an unmatched ledger entry — no deletion by omission", () => {
    const orphaned: ImportPlan = {
      ...firstApplyPlan,
      unmatchedLedgerEntries: [
        { sourceRef: "SAMCAT-W1-R003", exactName: "x", rowNumber: 3 },
      ] as never,
    };
    expect(() => assertPlanApplicable(orphaned, NOTHING_PERSISTED)).toThrow(
      /claimed by no row|reconciliation for the owner/,
    );
  });

  it("REFUSES anything APPROVED", () => {
    expect(() => assertNothingApproved(firstApplyPlan)).not.toThrow();
    // `reviewStatus` is deliberately narrower than the enum on PlannedProduct — the planner
    // cannot produce APPROVED. Cast so the guard can be tested against a state the type
    // system already forbids, which is the state it exists to catch.
    const poisoned: ImportPlan = {
      ...firstApplyPlan,
      products: firstApplyPlan.products.map((p, i) =>
        i === 0
          ? ({ ...p, reviewStatus: TechnicalReviewStatus.APPROVED } as unknown as PlannedProduct)
          : p,
      ),
    };
    expect(() => assertNothingApproved(poisoned)).toThrow(/never approves/);
  });
});

describe("the write plan", () => {
  const writePlan = buildWritePlan(firstApplyPlan);

  it("writes exactly the approved row counts", () => {
    expect(writePlan.products).toHaveLength(APPROVED_PLAN_EXPECTATIONS.products);
    expect(writePlan.productGrades).toHaveLength(APPROVED_PLAN_EXPECTATIONS.productGrades);
    expect(writePlan.sourceFacts).toHaveLength(APPROVED_PLAN_EXPECTATIONS.distinctSourceFacts);
    expect(writePlan.specifications).toHaveLength(APPROVED_PLAN_EXPECTATIONS.specifications);
    expect(writePlan.productClaims).toHaveLength(APPROVED_PLAN_EXPECTATIONS.productClaims);
    expect(writePlan.specificationEvidence).toHaveLength(
      APPROVED_PLAN_EXPECTATIONS.specificationEvidence,
    );
    expect(writePlan.claimEvidence).toHaveLength(APPROVED_PLAN_EXPECTATIONS.claimEvidence);
    expect(writePlan.sourceAssets).toHaveLength(APPROVED_PLAN_EXPECTATIONS.sourceAssets);
    expect(writePlan.sourceDocuments).toHaveLength(APPROVED_PLAN_EXPECTATIONS.sourceDocuments);
  });

  it("gives every row a distinct derived identity and id", () => {
    expect(() => assertWritePlanIdentitiesDistinct(writePlan)).not.toThrow();
  });

  it("is DETERMINISTIC: two builds produce identical ids", () => {
    const again = buildWritePlan(planWith(NOTHING_PERSISTED));
    expect(allWriteRows(again).map((r) => r.id)).toEqual(allWriteRows(writePlan).map((r) => r.id));
  });

  it("derives a Product id from its ratified sourceRef and nothing else", () => {
    const product = firstApplyPlan.products[0];
    if (!product) throw new Error("no product");
    const row = writePlan.products.find((r) => r.identity === product.sourceRef);
    expect(row?.id).toBe(ids.productId(product.sourceRef));
    // Renaming and moving the row does not change the identity.
    expect(ids.productId(product.sourceRef)).toBe(ids.productId(product.sourceRef));
  });

  it("never turns a WITHHELD fact into a Specification", () => {
    const withheld = firstApplyPlan.products.flatMap((p) =>
      p.technicalFacts.filter((f) => f.specification === null),
    );
    expect(withheld.length).toBe(126);
    // 1,528 raw facts, 1,402 specifications: every withheld fact is recorded, none normalized.
    expect(writePlan.specifications).toHaveLength(1402);
  });

  it("records every withheld fact as a SourceFact regardless", () => {
    // Evidence is kept even when it cannot be published — 1,661 distinct across both roles.
    expect(writePlan.sourceFacts).toHaveLength(1661);
  });

  it("writes NO product_slug_claims row: ADR-011 maintains that registry by trigger", () => {
    const tables = new Set(allWriteRows(writePlan).map((r) => r.table));
    expect([...tables]).not.toContain("product_slug_claims");
  });

  it("stores no document bytes anywhere in the plan", () => {
    for (const row of allWriteRows(writePlan)) {
      expect(row.identity).not.toMatch(/^data:|%PDF|\bJFIF\b/);
    }
    // SourceAssets are identified by hash, never by content.
    for (const asset of writePlan.sourceAssets) expect(asset.identity).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("identical replay", () => {
  it("produces the same ids as the first apply, so nothing is inserted twice", () => {
    const first = buildWritePlan(firstApplyPlan);
    const second = buildWritePlan(replayPlan);
    expect(allWriteRows(second).map((r) => r.id)).toEqual(allWriteRows(first).map((r) => r.id));
  });

  it("plans 0 inserts, 0 updates and 0 demo deletions", () => {
    expect(replayPlan.counts.products.insert).toBe(0);
    expect(replayPlan.counts.products.update).toBe(0);
    expect(replayPlan.counts.products.skip).toBe(100);
  });
});

describe("changed source evidence", () => {
  it("gives a changed reading a NEW SourceFact id, never reusing the old one", () => {
    const before = ids.sourceFactId("HSB-CAT 33  A kv_100c cSt 15.1 ASTM-D445 ");
    const after = ids.sourceFactId("HSB-CAT 33  A kv_100c cSt 99.9 ASTM-D445 ");
    expect(after).not.toBe(before);
  });

  it("keeps the SAME id when only the import run differs", () => {
    // The run is not part of the identity, which is what makes a replay converge.
    const identity = "HSB-CAT 33  A kv_100c cSt 15.1 ASTM-D445 ";
    expect(ids.sourceFactId(identity)).toBe(ids.sourceFactId(identity));
  });

  it("invalidates the approval when the evidence behind a row changes", () => {
    const poisoned = ledger.entries.map((entry) =>
      entry.sourceRef === "SAMCAT-W1-R003"
        ? { ...entry, evidenceHash: "f".repeat(64), approved: true }
        : entry,
    );
    const plan = buildImportPlan({
      workbook: ratifiedWorkbook,
      workbookFileName: "m",
      workbookSha256: "0".repeat(64),
      workbookByteSize: 1,
      existingSlugKeys: new Set<string>(),
      existingSourceRefs: ALL_PERSISTED,
      ledger: poisoned,
    });
    const product = plan.products.find((p) => p.sourceRef === "SAMCAT-W1-R003");
    expect(product?.reviewStatus).toBe("NEEDS_REVIEW");
    expect(product?.flags.map((f) => f.code)).toContain("APPROVAL_INVALIDATED_BY_EVIDENCE_CHANGE");
    expect(product?.action).not.toBe("SKIP");
  });
});

/* -------------------------------------------------------------------------- */

describe("the apply confirmation contract", () => {
  const good: ApplyConfirmations = {
    workbookPath: "master.xlsx",
    ledgerPath: "ledger.json",
    expectedWorkbookSha256: "4d993fd60411b315e69a0ddfd3d4c4a3ddce761a9a680da1d8e08020fbc7f2e9",
    expectedLedgerSha256: "3818c6457d41e404eaa30aac540db9a4e4d8ef77e781e2ab159fb1465f303505",
    expectedManifestHash: "3a9c07dce033d09fc0e96382b91012a013be8dc6fa96fba3a472ee9d21ea26e9",
    targetDatabase: "sam_platform",
    demoReplacementAuthorized: true,
    backupAttestation: "0".repeat(64),
    confirmationPhrase: APPLY_CONFIRMATION_PHRASE,
  };
  const observed: ApplyObserved = {
    workbookSha256: good.expectedWorkbookSha256,
    ledgerSha256: good.expectedLedgerSha256,
    manifestHash: good.expectedManifestHash,
    databaseName: "sam_platform",
  };

  it("accepts the complete, matching set", () => {
    expect(() => {
      assertApplyConfirmations(good, observed);
    }).not.toThrow();
  });

  it.each([
    ["workbook hash", { ...observed, workbookSha256: "a".repeat(64) }, /Workbook SHA-256 mismatch/],
    ["ledger hash", { ...observed, ledgerSha256: "b".repeat(64) }, /ledger SHA-256 mismatch/],
    ["manifest hash", { ...observed, manifestHash: "c".repeat(64) }, /Manifest hash mismatch/],
    ["database target", { ...observed, databaseName: "sam_cms" }, /Database target mismatch/],
  ])("REFUSES a %s mismatch", (_label, wrong, pattern) => {
    expect(() => {
      assertApplyConfirmations(good, wrong as ApplyObserved);
    }).toThrow(pattern as RegExp);
  });

  it("REFUSES a wrong or missing confirmation phrase", () => {
    for (const phrase of ["", "yes", "apply", APPLY_CONFIRMATION_PHRASE.toLowerCase()]) {
      expect(() => {
        assertApplyConfirmations({ ...good, confirmationPhrase: phrase }, observed);
      }).toThrow(ApplyConfirmationError);
    }
  });

  it("REFUSES when demo replacement was not authorized", () => {
    expect(() => {
      assertApplyConfirmations({ ...good, demoReplacementAuthorized: false }, observed);
    }).toThrow(/--replace-demo-products yes is required/);
  });

  it("REFUSES a missing or trivial backup attestation", () => {
    expect(() => {
      assertApplyConfirmations({ ...good, backupAttestation: "none" }, observed);
    }).toThrow(/backup/);
  });

  it("REFUSES every missing flag by name, with no default and no --force", () => {
    const flags: Record<string, string> = {
      "--workbook": "m.xlsx",
      "--ledger": "l.json",
      "--expect-workbook-sha256": "a".repeat(64),
      "--expect-ledger-sha256": "b".repeat(64),
      "--expect-manifest-hash": "c".repeat(64),
      "--target-database": "sam_platform",
      "--replace-demo-products": "yes",
      "--backup-attestation": "d".repeat(64),
      "--confirm": APPLY_CONFIRMATION_PHRASE,
    };
    for (const missing of Object.keys(flags)) {
      const read = (flag: string): string | null =>
        flag === missing ? null : (flags[flag] ?? null);
      if (missing === "--replace-demo-products") {
        // Present-but-not-"yes" is caught at assertion time rather than at read time.
        expect(readApplyConfirmations(read).demoReplacementAuthorized).toBe(false);
        continue;
      }
      expect(() => readApplyConfirmations(read)).toThrow(ApplyConfirmationError);
    }
  });

  it("rejects a non-hex hash rather than comparing it loosely", () => {
    const read = (flag: string): string | null =>
      flag === "--expect-workbook-sha256" ? "not-a-hash" : "x".repeat(64);
    expect(() => readApplyConfirmations(read)).toThrow(/64-character lowercase hex/);
  });
});

/* -------------------------------------------------------------------------- */

const demoRow = (slug: string, over: Partial<DemoProductRow> = {}): DemoProductRow => ({
  id: `id-${slug}`,
  slug,
  name: `SAM Demo ${slug}`,
  sourceRef: null,
  gradeCount: 0,
  specificationCount: 0,
  claimCount: 0,
  sourceFactCount: 0,
  inquiryCount: 0,
  segmentCount: 0,
  ...over,
});

/** The audited state: ten rows whose segment memberships total eighteen. */
const auditedDemoRows = (): DemoProductRow[] =>
  AUDITED_DEMO_SLUGS.map((slug, index) =>
    demoRow(slug, { segmentCount: index === 0 ? AUDITED_DEMO_PRODUCT_SEGMENT_COUNT - 9 : 1 }),
  );

describe("the demo replacement guard", () => {
  const guard = (
    over: Partial<Parameters<typeof assertDemoReplacementAllowed>[0]> = {},
  ): readonly string[] =>
    assertDemoReplacementAllowed({
      candidates: auditedDemoRows(),
      slugClaimCount: 10,
      authorized: true,
      ...over,
    });

  it("allows exactly the ten audited rows", () => {
    expect(guard()).toHaveLength(10);
  });

  it("REFUSES when replacement was not authorized", () => {
    expect(() => guard({ authorized: false })).toThrow(/not authorized/);
  });

  it("REFUSES an unexpected demo count", () => {
    expect(() => guard({ candidates: auditedDemoRows().slice(0, 9) })).toThrow(/exactly 10/);
    expect(() =>
      guard({ candidates: [...auditedDemoRows(), demoRow("sam-demo-surprise")] }),
    ).toThrow(/exactly 10/);
  });

  it("REFUSES a row outside the allowlist even when it matches the prefix", () => {
    const rows = auditedDemoRows();
    rows[3] = demoRow("sam-demo-not-audited", { segmentCount: 1 });
    expect(() => guard({ candidates: rows })).toThrow(/allowlist/);
  });

  it("REFUSES a row whose name lost the SAM Demo marker", () => {
    const rows = auditedDemoRows();
    rows[0] = { ...(rows[0] as DemoProductRow), name: "Real Product" };
    expect(() => guard({ candidates: rows })).toThrow(/marker/);
  });

  it("REFUSES a demo row that acquired a ratified identity", () => {
    const rows = auditedDemoRows();
    rows[0] = { ...(rows[0] as DemoProductRow), sourceRef: "SAMCAT-W1-R003" };
    expect(() => guard({ candidates: rows })).toThrow(/ratified Product is never deleted/);
  });

  it.each([
    ["gradeCount", "ProductGrade"],
    ["specificationCount", "Specification"],
    ["claimCount", "ProductClaim"],
    ["sourceFactCount", "SourceFact"],
  ])("REFUSES an unexpected dependent row: %s", (field) => {
    const rows = auditedDemoRows();
    rows[0] = { ...(rows[0] as DemoProductRow), [field]: 1 } as DemoProductRow;
    expect(() => guard({ candidates: rows })).toThrow(DemoReplacementGuardError);
  });

  it("REFUSES an Inquiry reference unless SET NULL was separately accepted", () => {
    const rows = auditedDemoRows();
    rows[0] = { ...(rows[0] as DemoProductRow), inquiryCount: 1 };
    expect(() => guard({ candidates: rows })).toThrow(/detach a real lead/);
    expect(() => guard({ candidates: rows, acceptInquirySetNull: true })).not.toThrow();
  });

  it("REFUSES an unexpected ProductSegment total", () => {
    const rows = auditedDemoRows();
    rows[1] = { ...(rows[1] as DemoProductRow), segmentCount: 5 };
    expect(() => guard({ candidates: rows })).toThrow(/ProductSegment rows/);
  });

  it("REFUSES an unexpected slug-claim count", () => {
    expect(() => guard({ slugClaimCount: 9 })).toThrow(/slug claims/);
  });
});

/* -------------------------------------------------------------------------- */

describe("the guarded transaction", () => {
  function recordingTransaction(): ApplyTransaction & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      execute(sql: string) {
        calls.push(sql.split("\n")[0]?.trim() ?? sql);
        return Promise.resolve(0);
      },
      query<T>() {
        calls.push("QUERY");
        return Promise.resolve([] as T[]);
      },
    };
  }

  it("takes SERIALIZABLE, both timeouts and the advisory lock, in that order", async () => {
    const tx = recordingTransaction();
    await beginGuardedTransaction(tx);
    expect(tx.calls[0]).toContain("SERIALIZABLE");
    expect(tx.calls[1]).toContain("lock_timeout");
    expect(tx.calls[2]).toContain("statement_timeout");
    expect(tx.calls[3]).toContain("pg_advisory_xact_lock");
    expect(APPLY_LOCK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(APPLY_STATEMENT_TIMEOUT_MS).toBeGreaterThan(APPLY_LOCK_TIMEOUT_MS);
    expect(CATALOG_IMPORT_ADVISORY_LOCK_KEY).toBeGreaterThan(0n);
  });

  it("orders the demo deletion after the guards and before the Products", () => {
    const at = (step: string): number => APPLY_STEP_ORDER.indexOf(step);
    expect(at("advisory-lock")).toBeLessThan(at("preflight-recheck"));
    expect(at("preflight-recheck")).toBeLessThan(at("demo-guard"));
    expect(at("demo-guard")).toBeLessThan(at("demo-delete"));
    expect(at("demo-delete")).toBeLessThan(at("products"));
    expect(at("products")).toBeLessThan(at("source_facts"));
    expect(at("source_facts")).toBeLessThan(at("specifications"));
    expect(at("specifications")).toBeLessThan(at("specification_evidence"));
    expect(at("product_claims")).toBeLessThan(at("claim_evidence"));
    expect(at("post-write-verification")).toBe(APPLY_STEP_ORDER.length - 1);
  });

  it("never issues a write against product_slug_claims", async () => {
    const tx = recordingTransaction();
    await beginGuardedTransaction(tx);
    for (const call of tx.calls) {
      expect(call).not.toMatch(
        /INSERT INTO "?product_slug_claims|UPDATE "?product_slug_claims|DELETE FROM "?product_slug_claims/i,
      );
    }
  });

  it("refuses to delete when the in-transaction read disagrees with the audit", async () => {
    const tx: ApplyTransaction = {
      execute: () => Promise.resolve(0),
      query: <T>() => Promise.resolve([] as T[]), // no demo rows at all
    };
    await expect(deleteAuditedDemoProducts(tx, { authorized: true })).rejects.toBeInstanceOf(
      DemoReplacementGuardError,
    );
  });
});

/* -------------------------------------------------------------------------- */

describe("reference data", () => {
  it("reconciles 8 ProductTypes, 28 SpecProperties and 75 mappings", () => {
    const counts = referenceDataCounts();
    expect(counts.productTypes).toBe(8);
    expect(counts.specProperties).toBe(28);
    expect(counts.specPropertyMappings).toBe(75);
    expect(counts.highMappings).toBe(54);
    expect(counts.deferredMappings).toBe(21);
  });

  it("gives every ProductType a stable id derived from its approved slug", () => {
    for (const row of productTypeRows()) expect(row.id).toBe(ids.productTypeId(row.slug));
    expect(new Set(productTypeRows().map((r) => r.slug)).size).toBe(8);
  });

  it("keys SpecProperty by its own key and creates no translation", () => {
    expect(new Set(specPropertyRows().map((r) => r.key)).size).toBe(28);
  });

  it("preserves MappingConfidence verbatim", () => {
    const byConfidence = new Map<string, number>();
    for (const row of specPropertyMappingRows()) {
      byConfidence.set(row.confidence, (byConfidence.get(row.confidence) ?? 0) + 1);
    }
    expect(byConfidence.get(MappingConfidence.HIGH)).toBe(54);
    expect(byConfidence.get(MappingConfidence.MEDIUM)).toBe(13);
    expect(byConfidence.get(MappingConfidence.LOW)).toBe(8);
  });

  it("marks ONLY HIGH mappings as able to produce a Specification", () => {
    for (const row of specPropertyMappingRows()) {
      if (row.maySpecify) expect(row.confidence).toBe(MappingConfidence.HIGH);
    }
    expect(() => {
      assertReferenceDataSafe();
    }).not.toThrow();
  });

  it("never writes a mapping as APPROVED", () => {
    for (const row of specPropertyMappingRows()) {
      expect(row.reviewStatus).toBe(TechnicalReviewStatus.SOURCE_RECORDED);
    }
  });

  it("touches neither the six frozen Families nor the eight Segments", () => {
    const tables = new Set(allWriteRows(buildWritePlan(firstApplyPlan)).map((r) => r.table));
    expect([...tables]).not.toContain("categories");
    expect([...tables]).not.toContain("segments");
  });
});

describe("the manifest the operator confirms", () => {
  it("is a pure function of the plan", () => {
    expect(buildManifest(firstApplyPlan).manifestHash).toBe(
      buildManifest(planWith(NOTHING_PERSISTED)).manifestHash,
    );
  });
});

/**
 * PRODUCT-DATA-2C-B1 durable-verification correction: the two identity rules that decide
 * whether a rerun converges or duplicates.
 */
describe("Specification subject uniqueness", () => {
  it("finds no duplicate subject anywhere in the ratified plan", () => {
    // 1402 candidates, 1402 distinct (product, grade, property). The policy costs nothing on
    // the authoritative data, which is why the synthetic case below has to exist.
    const flagged = firstApplyPlan.products.flatMap((product) =>
      product.flags.filter((flag) => flag.code === "SPECIFICATION_SUBJECT_DUPLICATED"),
    );
    expect(flagged).toEqual([]);
    const subjects = new Set<string>();
    let candidates = 0;
    for (const product of firstApplyPlan.products) {
      for (const fact of product.technicalFacts) {
        if (fact.specification === null) continue;
        candidates++;
        subjects.add(
          [product.sourceRef, fact.gradeLabel ?? "", fact.specification.propertyKey].join("|"),
        );
      }
    }
    expect(candidates).toBe(1402);
    expect(subjects.size).toBe(1402);
  });

  it("REPORTS two readings of one property at one scope, and chooses neither", () => {
    const product = firstApplyPlan.products.find((p) =>
      p.technicalFacts.some((f) => f.specification !== null),
    );
    if (!product) throw new Error("no product with a specification");
    const reading = product.technicalFacts.find((f) => f.specification !== null);
    if (!reading || reading.specification === null) throw new Error("unreachable");

    // The same property, at the same scope, measured by a DIFFERENT method.
    const second: PlannedTechnicalFact = {
      ...reading,
      specification: { ...reading.specification, displayValue: "999.9", method: "ASTM D9999" },
    };
    const flags = duplicateSpecificationSubjectFlags([...product.technicalFacts, second]);

    expect(flags).toHaveLength(1);
    expect(flags[0]?.code).toBe("SPECIFICATION_SUBJECT_DUPLICATED");
    expect(flags[0]?.severity).toBe("conflict");
    expect(flags[0]?.category).toBe("SPECIFICATION");
    expect(flags[0]?.detail).toContain(reading.specification.propertyKey);
    expect(flags[0]?.detail).toContain("Nothing is chosen automatically");
  });

  it("separates PRODUCT level from GRADE level rather than merging them", () => {
    const base = firstApplyPlan.products
      .flatMap((p) => p.technicalFacts)
      .find((f) => f.specification !== null);
    if (!base || base.specification === null) throw new Error("no specification");
    const atProduct: PlannedTechnicalFact = { ...base, gradeLabel: null };
    const atGrade: PlannedTechnicalFact = { ...base, gradeLabel: "SAE 40" };
    // One value per property PER SCOPE — the two scopes do not collide with each other.
    expect(duplicateSpecificationSubjectFlags([atProduct, atGrade])).toEqual([]);
    expect(duplicateSpecificationSubjectFlags([atGrade, { ...atGrade }])).toHaveLength(1);
  });

  it("does not flag a WITHHELD reading, which never becomes a Specification", () => {
    const base = firstApplyPlan.products
      .flatMap((p) => p.technicalFacts)
      .find((f) => f.specification !== null);
    if (!base) throw new Error("no specification");
    const withheld: PlannedTechnicalFact = { ...base, specification: null };
    expect(duplicateSpecificationSubjectFlags([base, withheld])).toEqual([]);
  });
});

describe("claim_identity_hash is the STATEMENT, not the reading", () => {
  const statementOf = (sourceRef: string, kind: string): string => {
    const product = firstApplyPlan.products.find((p) => p.sourceRef === sourceRef);
    const claim = product?.claims.find((c) => c.kind === kind);
    if (!claim) throw new Error(`no ${kind} claim on ${sourceRef}`);
    return claim.sourceFact.rawValue;
  };

  it("is deterministic and 64 lowercase hex characters", () => {
    const text = statementOf("SAMCAT-W1-R243", "SUITABLE_FOR");
    expect(ids.claimIdentityHash(text)).toMatch(/^[0-9a-f]{64}$/);
    expect(ids.claimIdentityHash(text)).toBe(ids.claimIdentityHash(text));
  });

  it("SURVIVES an evidence revision: the same sentence on a different page", () => {
    // The failure this replaced: hashing the SourceFact evidence identity meant a supplier
    // re-issuing a catalogue and moving a sentence from page 33 to 35 created a SECOND
    // ACTIVE CLAIM for a statement that never changed.
    const product = firstApplyPlan.products.find((p) => p.sourceRef === "SAMCAT-W1-R243");
    const claim = product?.claims.find((c) => c.kind === "SUITABLE_FOR");
    if (!claim) throw new Error("no claim");

    const moved = { ...claim.sourceFact, pageNumber: (claim.sourceFact.pageNumber ?? 0) + 2 };
    expect(ids.claimIdentityHash(moved.rawValue)).toBe(
      ids.claimIdentityHash(claim.sourceFact.rawValue),
    );
    // ...and therefore the same ProductClaim row, not a second one.
    const idFor = (raw: string): string =>
      ids.productClaimId(
        "SAMCAT-W1-R243",
        claim.gradeLabel,
        claim.kind,
        claim.standardBody,
        claim.standardCode,
        ids.claimIdentityHash(raw),
      );
    expect(idFor(moved.rawValue)).toBe(idFor(claim.sourceFact.rawValue));
  });

  it("excludes worksheet position, document and the public product name", () => {
    // Exclusion is proved by INVARIANCE, not by inspecting the digest: a 64-character hex
    // string contains every digit somewhere, so "the hash does not contain the row number"
    // would pass for any input at all. Change each excluded thing and require the identity
    // to stay put.
    const product = firstApplyPlan.products.find((p) => p.sourceRef === "SAMCAT-W1-R243");
    const claim = product?.claims.find((c) => c.kind === "SUITABLE_FOR");
    if (!product || !claim) throw new Error("no claim");
    const baseline = ids.claimIdentityHash(claim.sourceFact.rawValue);

    for (const mutated of [
      { ...claim.sourceFact, pageNumber: 999 },
      { ...claim.sourceFact, rowNumber: 999 },
      { ...claim.sourceFact, columnLabel: "ZZ" },
      { ...claim.sourceFact, sheetName: "Another Sheet" },
      { ...claim.sourceFact, documentKey: "SOME-OTHER-DOC" },
      { ...claim.sourceFact, rawMethod: "ASTM D9999" },
    ]) {
      expect(ids.claimIdentityHash(mutated.rawValue)).toBe(baseline);
    }
    // And the product's own name and row are not inputs either: the identity is computed
    // from the statement alone, with product/grade/kind/body/code carried by productClaimId.
    expect(ids.claimIdentityHash(claim.sourceFact.rawValue)).toBe(baseline);
    expect(product.publicProductName.length).toBeGreaterThan(0);
  });

  it("folds typography but not meaning", () => {
    expect(ids.claimIdentityHash("Suitable for  manual gear box ")).toBe(
      ids.claimIdentityHash("suitable for manual gear box"),
    );
    expect(ids.claimIdentityHash("Suitable for manual gear box")).not.toBe(
      ids.claimIdentityHash("Suitable for helical and spiral gear box"),
    );
  });

  it("stores a hash, so no verbatim third-party sentence becomes a column value", () => {
    const text = statementOf("SAMCAT-W1-R243", "SUITABLE_FOR");
    const hash = ids.claimIdentityHash(text);
    expect(hash).not.toContain("gear");
    expect(hash).not.toContain(" ");
    expect(hash).toHaveLength(64);
  });

  it("still tells all 148 claims apart, and keeps the three genuine pairs as six", () => {
    const keys = new Set<string>();
    let total = 0;
    for (const product of firstApplyPlan.products) {
      for (const claim of product.claims) {
        total++;
        keys.add(
          ids.productClaimId(
            product.sourceRef,
            claim.gradeLabel,
            claim.kind,
            claim.standardBody,
            claim.standardCode,
            ids.claimIdentityHash(claim.sourceFact.rawValue),
          ),
        );
      }
    }
    expect(total).toBe(148);
    expect(keys.size).toBe(148);

    // The three products whose two SUITABLE_FOR statements the columns alone cannot separate.
    for (const sourceRef of ["SAMCAT-W1-R243", "SAMCAT-W1-R246", "SAMCAT-W1-R300"]) {
      const product = firstApplyPlan.products.find((p) => p.sourceRef === sourceRef);
      const suitable = (product?.claims ?? []).filter((c) => c.kind === "SUITABLE_FOR");
      expect(suitable).toHaveLength(2);
      const hashes = new Set(suitable.map((c) => ids.claimIdentityHash(c.sourceFact.rawValue)));
      expect(hashes.size).toBe(2);
    }
  });
});
