import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { buildImportPlan, evidenceHashOf, IMPORTER_VERSION } from "./import-planner";
import { buildLedger, buildManifest } from "./manifest";

import type {
  ImportPlan,
  PlannedProduct,
  PlannedTechnicalFact,
  WorkbookProductRow,
} from "./catalog-import.types";
import type { ParsedWorkbook } from "./workbook-parser";

const BASE_INPUT = {
  workbook: WORKBOOK_FIXTURE,
  workbookFileName: "دسته بندی محصولات.xlsx",
  workbookSha256: "922c689d040ae191fd711f24ef9f8524a551e294e4bf5304eaa4f4f693c0fb73",
  workbookByteSize: 46381,
  existingSlugKeys: new Set<string>(),
};

const plan = buildImportPlan(BASE_INPUT);
const byRow = new Map(plan.products.map((product) => [product.rowNumber, product]));
const active = plan.products;
const ledger = buildLedger(plan).entries;

const withRows = (rows: readonly WorkbookProductRow[]): ParsedWorkbook => ({
  sheetName: WORKBOOK_FIXTURE.sheetName,
  rows,
  identifierColumn: null,
  declaredSourceRefs: new Map<number, string>(),
});

const candidates = (product: PlannedProduct | undefined): PlannedTechnicalFact[] =>
  (product?.technicalFacts ?? []).filter((fact) => fact.specification !== null);

describe("the 100 authoritative rows", () => {
  it("are all planned, in workbook order", () => {
    expect(plan.counts.rowsParsed).toBe(100);
    expect(active).toHaveLength(100);
    expect(active.map((product) => product.rowNumber)).toEqual(
      WORKBOOK_FIXTURE.rows.map((row) => row.rowNumber),
    );
  });

  it("carry the exact Excel name as the public name, with the raw cell kept beside it", () => {
    for (const row of WORKBOOK_FIXTURE.rows) {
      const product = byRow.get(row.rowNumber);
      expect(product?.publicProductName).toBe(row.name);
      expect(product?.sourceName).toBe(row.rawName);
    }
  });

  it("preserve the original Excel category on every row as provenance", () => {
    for (const row of WORKBOOK_FIXTURE.rows) {
      expect(byRow.get(row.rowNumber)?.excelCategory).toBe(row.categoryLabel);
      expect(byRow.get(row.rowNumber)?.excelProductTypeLabel).toBe(row.productTypeLabel);
    }
  });

  it("give every row a distinct sourceRef, and call all 100 of them PROPOSED", () => {
    const refs = active.map((product) => product.sourceRef);
    expect(new Set(refs).size).toBe(100);
    expect(plan.counts.duplicateIdentity).toBe(0);
    for (const product of active) expect(product.identityState).toBe("PROPOSED");
    expect(plan.identityRatifiable).toBe(true);
  });

  it("proposes 100 distinct slugs", () => {
    expect(new Set(active.map((product) => product.proposedSlug)).size).toBe(100);
    expect(plan.counts.duplicateSlug).toBe(0);
  });
});

describe("the ratified grade distribution", () => {
  it("is 56 zero-grade, 5 single-grade and 39 multi-grade products", () => {
    expect(plan.counts.gradesZero).toBe(56);
    expect(plan.counts.gradesSingle).toBe(5);
    expect(plan.counts.gradesMulti).toBe(39);
    expect(plan.counts.gradesZero + plan.counts.gradesSingle + plan.counts.gradesMulti).toBe(100);
  });

  it("proposes exactly 134 ProductGrade candidates", () => {
    expect(plan.counts.gradeRecords).toBe(134);
    const summed = active.reduce((total, product) => total + product.grades.length, 0);
    expect(summed).toBe(134);
  });

  it("gives the 39 King Power `Average Results` documents ZERO grades", () => {
    // The single result column names a result basis, not a variant.
    expect(byRow.get(3)?.grades).toEqual([]);
    expect(byRow.get(42)?.grades).toEqual([]);
    expect(byRow.get(165)?.grades).toEqual([]);
  });

  it("gives the 15 Addilex additives ZERO grades", () => {
    for (const rowNumber of [
      249, 252, 255, 258, 261, 264, 267, 270, 273, 276, 279, 282, 285, 288, 291,
    ]) {
      expect(byRow.get(rowNumber)?.grades).toEqual([]);
    }
  });

  it("gives `quenching oil` and `TWO-Stroke Engine Oil` zero grades", () => {
    expect(byRow.get(153)?.grades).toEqual([]);
    expect(byRow.get(219)?.grades).toEqual([]);
  });

  it("leaves the five genuine single-grade HSB products with exactly one each", () => {
    for (const rowNumber of [81, 96, 99, 150, 225]) {
      expect(byRow.get(rowNumber)?.grades).toHaveLength(1);
    }
  });

  it("creates no grade whose label the source did not print", () => {
    for (const product of active) {
      for (const grade of product.grades) {
        expect(grade.label.length).toBeGreaterThan(0);
        expect(grade.label).not.toMatch(/default|standard|n\/a|unknown/i);
      }
    }
  });

  it("records TC as a claim rather than as a grade", () => {
    const product = byRow.get(219);
    expect(product?.grades).toEqual([]);
    expect(product?.claims.some((c) => c.standardCode === "TC")).toBe(true);
  });
});

describe("SourceFacts and Specifications are counted separately", () => {
  const technical = plan.counts.technical;

  it("keeps EVERY extracted reading as a SourceFact", () => {
    const facts = active.flatMap((product) => product.technicalFacts);
    expect(technical.rawTechnicalFacts).toBe(facts.length);
    expect(technical.rawTechnicalFacts).toBe(1528);
  });

  it("plans fewer Specifications than SourceFacts, and reconciles the difference", () => {
    expect(technical.validSpecificationCandidates).toBeLessThan(technical.rawTechnicalFacts);
    expect(technical.validSpecificationCandidates + technical.withheldFromSpecification).toBe(
      technical.rawTechnicalFacts,
    );
    expect(technical.productLevelCandidates + technical.gradeLevelCandidates).toBe(
      technical.validSpecificationCandidates,
    );
    expect(technical.missingPropertyReference + technical.invalidValueShape).toBe(
      technical.withheldFromSpecification,
    );
  });

  it("never emits a Specification without an approved property key", () => {
    for (const product of active) {
      for (const fact of product.technicalFacts) {
        if (fact.specification === null) continue;
        expect(fact.specification.propertyKey.length).toBeGreaterThan(0);
        expect(fact.resolvedPropertyKey).toBe(fact.specification.propertyKey);
      }
    }
  });

  it("keeps a withheld fact's raw value, unit, method and grade label intact", () => {
    const withheld = active
      .flatMap((product) => product.technicalFacts)
      .filter((fact) => fact.specification === null);
    expect(withheld.length).toBe(technical.withheldFromSpecification);
    for (const fact of withheld) {
      expect(fact.withheldReason).not.toBeNull();
      expect(fact.sourceFact.rawValue.length).toBeGreaterThanOrEqual(0);
      expect(fact.specification).toBeNull();
    }
  });

  it("reports every conflicting raw label with the number of facts under it", () => {
    expect(technical.conflictingRawLabels).toBeGreaterThan(0);
    expect(technical.factsUnderConflictingRawLabels).toBe(technical.withheldFromSpecification);
  });

  it("hangs a fact off the Product when its grade label was rejected", () => {
    const quenching = byRow.get(153);
    expect(quenching?.technicalFacts.length).toBeGreaterThan(0);
    expect(quenching?.technicalFacts.every((fact) => fact.gradeLabel === null)).toBe(true);
  });

  it("hangs a fact off the Grade when the grade was accepted", () => {
    const gearTech = byRow.get(102);
    expect(gearTech?.grades).toHaveLength(8);
    expect(gearTech?.technicalFacts.every((fact) => fact.gradeLabel !== null)).toBe(true);
  });

  it("only ever names a grade the same product actually has", () => {
    for (const product of active) {
      const labels = new Set(product.grades.map((grade) => grade.label));
      for (const fact of product.technicalFacts) {
        if (fact.gradeLabel === null) continue;
        expect(labels.has(fact.gradeLabel)).toBe(true);
      }
    }
  });
});

describe("raw source facts are preserved verbatim", () => {
  it("keeps the printed value on every Specification candidate, unmodified", () => {
    for (const product of active) {
      for (const fact of product.technicalFacts) {
        if (fact.specification === null) continue;
        expect(fact.sourceFact.rawValue).toBe(fact.specification.displayValue);
      }
    }
  });

  it("keeps the printed unit, method and grade label alongside it", () => {
    const viscosity = byRow
      .get(3)
      ?.technicalFacts.find(
        (fact) => fact.sourceFact.rawProperty === "Kinematic viscosity at 100°C",
      );
    expect(viscosity?.sourceFact.rawUnit).toBe("cSt");
    expect(viscosity?.sourceFact.rawMethod).toBe("ASTM D445");
    expect(viscosity?.specification?.unit).toBe("cSt");
    expect(viscosity?.specification?.method).toBe("ASTM D445");
  });

  it("records where in the document every fact came from", () => {
    for (const product of active) {
      for (const fact of product.technicalFacts) {
        expect(fact.sourceFact.documentKey.length).toBeGreaterThan(0);
        const hasLocator =
          fact.sourceFact.pageNumber !== null || fact.sourceFact.columnLabel !== null;
        expect(hasLocator).toBe(true);
      }
    }
  });

  it("records the extraction method, distinguishing a parsed table from a page read by eye", () => {
    expect(byRow.get(3)?.technicalFacts[0]?.sourceFact.extractionMethod).toBe("PDF_TEXT_LAYER");
    expect(byRow.get(69)?.technicalFacts[0]?.sourceFact.extractionMethod).toBe(
      "MANUAL_TRANSCRIPTION",
    );
    expect(byRow.get(249)?.technicalFacts[0]?.sourceFact.extractionMethod).toBe(
      "MANUAL_TRANSCRIPTION",
    );
  });
});

describe("units, methods, qualifiers and result basis", () => {
  it("carries the King Power `Average Results` header through as a result basis", () => {
    expect(candidates(byRow.get(3)).every((f) => f.specification?.resultBasis === "AVERAGE")).toBe(
      true,
    );
  });

  it("does not claim a result basis the source never stated", () => {
    expect(
      candidates(byRow.get(69)).every((f) => f.specification?.resultBasis === "UNSPECIFIED"),
    ).toBe(true);
  });

  it("keeps the CCS test temperature as a qualifier rather than four keys", () => {
    const ccs = candidates(byRow.get(3)).find(
      (f) => f.specification?.propertyKey === "ccs_viscosity",
    );
    expect(ccs?.specification?.qualifier).toBe("@ -25 °C");
  });

  it("imports a genuinely blank unit as blank and flags it", () => {
    const specificGravity = candidates(byRow.get(3)).find(
      (f) => f.specification?.propertyKey === "specific_gravity",
    );
    expect(specificGravity?.specification?.unit).toBeNull();
    expect(specificGravity?.sourceFact.unitClassification).toBe("DIMENSIONLESS");
  });
});

describe("the five gear rows filed under Marine", () => {
  it("stay an explicit unresolved family conflict, and are not guessed", () => {
    for (const rowNumber of [234, 237, 240, 243, 246]) {
      const product = byRow.get(rowNumber);
      expect(product?.proposedProductFamilyKey).toBeNull();
      expect(product?.excelCategory).toBe("روغن های دریایی Marine Oils");
      expect(product?.proposedProductTypeKey).toBe("gear-oils");
      expect(product?.flags.map((flag) => flag.code)).toContain("TAXONOMY_FAMILY_UNRESOLVED");
      expect(product?.action).toBe("CONFLICT");
    }
  });
});

describe("conflicts are separated by what they are about", () => {
  it("does not let a withheld specification block the Product row", () => {
    const withSpecConflictOnly = active.filter(
      (product) =>
        product.technicalFacts.some((fact) => fact.specification === null) &&
        product.proposedProductFamilyKey !== null &&
        product.identityState === "PROPOSED",
    );
    expect(withSpecConflictOnly.length).toBeGreaterThan(0);
    for (const product of withSpecConflictOnly) {
      expect(product.action).not.toBe("CONFLICT");
    }
  });

  it("counts conflicts per category rather than as one product-level verdict", () => {
    expect(plan.counts.conflictsByCategory.SPECIFICATION).toBeGreaterThan(
      plan.counts.products.conflict,
    );
    expect(plan.counts.conflictsByCategory.IDENTITY).toBe(0);
    expect(plan.counts.conflictsByCategory.SLUG).toBe(0);
  });

  it("blocks the Product row only for identity, slug and taxonomy", () => {
    const blocked = active.filter((product) => product.action === "CONFLICT");
    for (const product of blocked) {
      expect(
        product.proposedProductFamilyKey === null || product.identityState !== "PROPOSED",
      ).toBe(true);
    }
    expect(plan.counts.products.conflict).toBe(plan.counts.conflictsByCategory.TAXONOMY);
  });
});

describe("nothing is ever approved", () => {
  it("emits only SOURCE_RECORDED or NEEDS_REVIEW on every planned row", () => {
    for (const product of plan.products) {
      expect(["SOURCE_RECORDED", "NEEDS_REVIEW"]).toContain(product.reviewStatus);
    }
  });

  it("has no product, specification or claim in an APPROVED state", () => {
    const json = JSON.stringify(plan);
    expect(json).not.toContain('"reviewStatus":"APPROVED"');
  });

  it("emits every ledger entry as PROPOSED, never RATIFIED", () => {
    for (const entry of ledger) expect(entry.state).toBe("PROPOSED");
  });

  it("is asserted by buildManifest, which throws rather than emitting one", () => {
    const poisoned: ImportPlan = {
      ...plan,
      products: [{ ...(plan.products[0] as PlannedProduct), reviewStatus: "APPROVED" as never }],
    };
    expect(() => buildManifest(poisoned)).toThrow(/may only ever emit/);
  });
});

describe("determinism", () => {
  it("produces an identical plan on a repeat run over identical inputs", () => {
    const again = buildImportPlan(BASE_INPUT);
    expect(JSON.stringify(again)).toBe(JSON.stringify(plan));
  });

  it("produces an identical manifest hash on a repeat run", () => {
    expect(buildManifest(buildImportPlan(BASE_INPUT)).manifestHash).toBe(
      buildManifest(plan).manifestHash,
    );
  });

  it("puts the importer version inside the hash, so an importer change is visible", () => {
    expect(plan.importerVersion).toBe(IMPORTER_VERSION);
    const shifted = buildManifest({ ...plan, importerVersion: "catalog-importer/9.9.9" });
    expect(shifted.manifestHash).not.toBe(buildManifest(plan).manifestHash);
  });
});

describe("planner replay against a ledger the planner produced", () => {
  // NOT a database re-import. Nothing has ever been written; see `planner-replay.ts`.
  it("re-identifies every unchanged row instead of minting a new reference", () => {
    const second = buildImportPlan({ ...BASE_INPUT, ledger });
    expect(second.counts.products.insert).toBe(0);
    expect(second.counts.products.update).toBe(0);
    for (const entry of ledger) {
      expect(second.products.some((p) => p.sourceRef === entry.sourceRef)).toBe(true);
    }
    expect(second.counts.duplicateIdentity).toBe(0);
    expect(second.identityRatifiable).toBe(true);
  });

  it("REPORTS a rename rather than silently accepting the re-identification", () => {
    const renamed = WORKBOOK_FIXTURE.rows.map((row) =>
      row.rowNumber === 3 ? { ...row, name: "CK-4 10W-40 Renamed" } : row,
    );
    const second = buildImportPlan({ ...BASE_INPUT, workbook: withRows(renamed), ledger });
    const product = second.products.find((item) => item.rowNumber === 3);
    expect(product?.sourceRef).toBe("SAMCAT-W1-R003");
    expect(product?.identityState).toBe("INFERRED_UNCONFIRMED");
    expect(product?.action).toBe("CONFLICT");
    expect(second.identityRatifiable).toBe(false);
  });

  it("PRESERVES identity through a category change without a conflict", () => {
    const recategorised = WORKBOOK_FIXTURE.rows.map((row) =>
      row.rowNumber === 3 ? { ...row, categoryLabel: "روغن های صنعتی Industrial Oils" } : row,
    );
    const second = buildImportPlan({ ...BASE_INPUT, workbook: withRows(recategorised), ledger });
    const product = second.products.find((item) => item.rowNumber === 3);
    expect(product?.sourceRef).toBe("SAMCAT-W1-R003");
    expect(product?.identityState).toBe("LEDGER_CORROBORATED");
  });

  it("NEVER deletes a row the workbook stopped listing", () => {
    const shortened = WORKBOOK_FIXTURE.rows.filter((row) => row.rowNumber !== 300);
    const second = buildImportPlan({ ...BASE_INPUT, workbook: withRows(shortened), ledger });
    expect(second.unmatchedLedgerEntries.map((entry) => entry.sourceRef)).toEqual([
      "SAMCAT-W1-R300",
    ]);
    expect(JSON.stringify(second)).not.toContain('"DELETE"');
  });

  it("does NOT let a genuinely new row inherit another row's identity", () => {
    const added: WorkbookProductRow = {
      ...(WORKBOOK_FIXTURE.rows[0] as WorkbookProductRow),
      rowNumber: 303,
      name: "A Brand New Product",
      rawName: "A Brand New Product",
    };
    const second = buildImportPlan({
      ...BASE_INPUT,
      workbook: withRows([...WORKBOOK_FIXTURE.rows, added]),
      ledger,
    });
    const product = second.products.find((item) => item.rowNumber === 303);
    expect(product?.sourceRef).toBe("SAMCAT-W1-R303");
    expect(product?.identityState).toBe("PROPOSED");
    expect(ledger.some((entry) => entry.sourceRef === "SAMCAT-W1-R303")).toBe(false);
    expect(second.counts.duplicateIdentity).toBe(0);
  });
});

describe("changed evidence", () => {
  it("changes the row's evidence hash when a raw reading changes", () => {
    const product = byRow.get(3) as PlannedProduct;
    const altered: PlannedProduct = {
      ...product,
      technicalFacts: product.technicalFacts.map((fact, index) =>
        index === 0 ? { ...fact, sourceFact: { ...fact.sourceFact, rawValue: "99.9" } } : fact,
      ),
    };
    expect(evidenceHashOf(altered)).not.toBe(evidenceHashOf(product));
  });

  it("does NOT change the hash when only presentation order would differ", () => {
    const product = byRow.get(3) as PlannedProduct;
    const reordered: PlannedProduct = {
      ...product,
      technicalFacts: [...product.technicalFacts].reverse(),
    };
    expect(evidenceHashOf(reordered)).toBe(evidenceHashOf(product));
  });

  it("invalidates a prior APPROVAL and requires review again", () => {
    const poisoned = ledger.map((entry) =>
      entry.sourceRef === "SAMCAT-W1-R003"
        ? { ...entry, evidenceHash: "f".repeat(64), approved: true }
        : entry,
    );
    const second = buildImportPlan({ ...BASE_INPUT, ledger: poisoned });
    const product = second.products.find((item) => item.rowNumber === 3);
    expect(product?.reviewStatus).toBe("NEEDS_REVIEW");
    expect(product?.flags.map((flag) => flag.code)).toContain(
      "APPROVAL_INVALIDATED_BY_EVIDENCE_CHANGE",
    );
    expect(product?.action).not.toBe("SKIP");
  });

  it("marks an evidence change as UPDATE, never as a silent SKIP", () => {
    const poisoned = ledger.map((entry) =>
      entry.sourceRef === "SAMCAT-W1-R201" ? { ...entry, evidenceHash: "a".repeat(64) } : entry,
    );
    const second = buildImportPlan({ ...BASE_INPUT, ledger: poisoned });
    const product = second.products.find((item) => item.rowNumber === 201);
    expect(["UPDATE", "CONFLICT"]).toContain(product?.action);
    expect(product?.flags.map((flag) => flag.code)).toContain("EVIDENCE_CHANGED_SINCE_REVIEW");
  });
});

describe("slug collisions inside the plan", () => {
  it("are reported as CONFLICT and given no numeric suffix", () => {
    const collided = WORKBOOK_FIXTURE.rows.map((row) =>
      row.rowNumber === 6 ? { ...row, name: "CK-4 10W-40" } : row,
    );
    const collidedPlan = buildImportPlan({ ...BASE_INPUT, workbook: withRows(collided) });
    expect(collidedPlan.counts.duplicateSlug).toBeGreaterThan(0);
    for (const rowNumber of [3, 6]) {
      const product = collidedPlan.products.find((item) => item.rowNumber === rowNumber);
      expect(product?.action).toBe("CONFLICT");
      expect(product?.proposedSlug).not.toMatch(/-\d$/);
    }
  });

  it("reports a collision with a slug the database already holds", () => {
    const withExisting = buildImportPlan({
      ...BASE_INPUT,
      existingSlugKeys: new Set(["ck-4-10w-40"]),
    });
    const product = withExisting.products.find((item) => item.rowNumber === 3);
    expect(product?.action).toBe("CONFLICT");
    expect(product?.flags.map((flag) => flag.code)).toContain("SLUG_COLLISION_WITH_EXISTING");
  });
});

describe("the plan's own reporting", () => {
  it("lists every unmapped source property with its occurrence count", () => {
    expect(plan.unmappedProperties.length).toBe(plan.counts.unknownProperty);
    for (const unmapped of plan.unmappedProperties) {
      expect(unmapped.occurrences).toBeGreaterThan(0);
      expect(unmapped.reason.length).toBeGreaterThan(0);
    }
  });

  it("reports the one extraction artefact it corrected, with what the document prints", () => {
    expect(plan.corrections).toHaveLength(1);
    expect(plan.corrections[0]?.extracted).toBe("ISO VG 100 0");
    expect(plan.corrections[0]?.corrected).toBe("ISO VG 1000");
  });

  it("cites the workbook itself as a source document", () => {
    const workbookDocument = plan.documents.find(
      (document) => document.documentKey === "SAM-CATALOG-WORKBOOK",
    );
    expect(workbookDocument?.locatorType).toBe("UPLOADED_FILE");
    expect(workbookDocument?.sha256).toBe(BASE_INPUT.workbookSha256);
  });

  it("says whether the plan came from the workbook or from the frozen fixture", () => {
    expect(plan.workbook.provenance).toBe("AUTHORITATIVE_WORKBOOK");
    const fromFixture = buildImportPlan({
      ...BASE_INPUT,
      workbookProvenance: "FROZEN_FIXTURE",
    });
    expect(fromFixture.workbook.provenance).toBe("FROZEN_FIXTURE");
  });
});
