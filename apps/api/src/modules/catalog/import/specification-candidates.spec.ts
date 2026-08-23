/**
 * Database-shape simulation.
 *
 * Every planned Specification is checked against the two CHECK constraints the migration
 * actually installs — `specifications_value_shape` and `specifications_normalized_complete` —
 * and against the `numeric(20,6)` domain of the four numeric columns. A candidate PostgreSQL
 * would reject is not a plan; it is a deferred failure.
 */

import { SpecValueType } from "../../../prisma/generated/enums";

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { buildImportPlan } from "./import-planner";
import {
  decideSpecificationCandidate,
  validateSpecificationShape,
} from "./specification-candidates";

import type { SpecificationShape } from "./specification-candidates";

const EMPTY: SpecificationShape = {
  propertyKey: "kv_100c",
  displayValue: "14.2",
  valueType: null,
  numericMin: null,
  numericMax: null,
  pairFirst: null,
  pairSecond: null,
};

const plan = buildImportPlan({
  workbook: WORKBOOK_FIXTURE,
  workbookFileName: "wb.xlsx",
  workbookSha256: "0".repeat(64),
  workbookByteSize: 1,
  existingSlugKeys: new Set<string>(),
});

describe("specifications_value_shape", () => {
  it("accepts POINT with numeric_min alone", () => {
    expect(
      validateSpecificationShape({ ...EMPTY, valueType: SpecValueType.POINT, numericMin: "14.2" })
        .valid,
    ).toBe(true);
  });

  it("rejects POINT that also carries numeric_max", () => {
    const verdict = validateSpecificationShape({
      ...EMPTY,
      valueType: SpecValueType.POINT,
      numericMin: "1",
      numericMax: "2",
    });
    expect(verdict.valid).toBe(false);
    expect(verdict.violations[0]).toContain("specifications_value_shape");
  });

  it("rejects MAXIMUM carrying numeric_min", () => {
    expect(
      validateSpecificationShape({
        ...EMPTY,
        valueType: SpecValueType.MAXIMUM,
        numericMin: "1",
      }).valid,
    ).toBe(false);
  });

  it("rejects an inverted RANGE, exactly as the CHECK does", () => {
    const verdict = validateSpecificationShape({
      ...EMPTY,
      valueType: SpecValueType.RANGE,
      numericMin: "10",
      numericMax: "2",
    });
    expect(verdict.valid).toBe(false);
    expect(verdict.violations.join(" ")).toContain("numeric_min <= numeric_max");
  });

  it("accepts PAIR only with both halves", () => {
    expect(
      validateSpecificationShape({
        ...EMPTY,
        valueType: SpecValueType.PAIR,
        pairFirst: "5",
        pairSecond: "0",
      }).valid,
    ).toBe(true);
    expect(
      validateSpecificationShape({ ...EMPTY, valueType: SpecValueType.PAIR, pairFirst: "5" }).valid,
    ).toBe(false);
  });

  it("requires TEXT, REPORT_ONLY and CODE to leave every numeric column empty", () => {
    for (const valueType of [SpecValueType.TEXT, SpecValueType.REPORT_ONLY, SpecValueType.CODE]) {
      expect(validateSpecificationShape({ ...EMPTY, valueType }).valid).toBe(true);
      expect(validateSpecificationShape({ ...EMPTY, valueType, numericMin: "1" }).valid).toBe(
        false,
      );
    }
  });

  it("rejects a number that does not fit numeric(20,6)", () => {
    const tooPrecise = validateSpecificationShape({
      ...EMPTY,
      valueType: SpecValueType.POINT,
      numericMin: "1.1234567",
    });
    expect(tooPrecise.valid).toBe(false);
    expect(tooPrecise.violations.join(" ")).toContain("numeric(20,6)");

    const tooLarge = validateSpecificationShape({
      ...EMPTY,
      valueType: SpecValueType.POINT,
      numericMin: "123456789012345",
    });
    expect(tooLarge.valid).toBe(false);
  });
});

describe("specifications_normalized_complete", () => {
  it("refuses a normalized row with no property key", () => {
    const verdict = validateSpecificationShape({
      ...EMPTY,
      propertyKey: null,
      valueType: SpecValueType.TEXT,
    });
    expect(verdict.valid).toBe(false);
    expect(verdict.violations.join(" ")).toContain("specifications_normalized_complete");
  });

  it("refuses a normalized row with a blank display value", () => {
    expect(
      validateSpecificationShape({
        ...EMPTY,
        displayValue: "   ",
        valueType: SpecValueType.TEXT,
      }).valid,
    ).toBe(false);
  });
});

describe("the property gate runs before the value gate", () => {
  it("withholds an unknown label and never invents a SpecProperty", () => {
    const decision = decideSpecificationCandidate({
      propertyOutcome: "unknown",
      propertyKey: null,
      displayValue: "14.2",
      valueType: SpecValueType.POINT,
      numericMin: "14.2",
      numericMax: null,
      pairFirst: null,
      pairSecond: null,
      valueUnreadable: false,
    });
    expect(decision.emit).toBe(false);
    expect(decision.withholdReason).toBe("PROPERTY_UNKNOWN");
    expect(decision.detail).toContain("no Specification row and no SpecProperty is created");
  });

  it("withholds a mapping that is proposed but not approved", () => {
    const decision = decideSpecificationCandidate({
      propertyOutcome: "mapping-not-approved",
      propertyKey: null,
      displayValue: "14.2",
      valueType: SpecValueType.POINT,
      numericMin: "14.2",
      numericMax: null,
      pairFirst: null,
      pairSecond: null,
      valueUnreadable: false,
    });
    expect(decision.withholdReason).toBe("PROPERTY_MAPPING_NOT_APPROVED");
  });

  it("withholds a value the normalizer refused, keeping the reading itself", () => {
    const decision = decideSpecificationCandidate({
      propertyOutcome: "resolved",
      propertyKey: "kv_100c",
      displayValue: "23/6",
      valueType: SpecValueType.TEXT,
      numericMin: null,
      numericMax: null,
      pairFirst: null,
      pairSecond: null,
      valueUnreadable: true,
    });
    expect(decision.emit).toBe(false);
    expect(decision.withholdReason).toBe("VALUE_SHAPE_UNREADABLE");
  });

  it("withholds a candidate the database would reject, naming the constraint", () => {
    const decision = decideSpecificationCandidate({
      propertyOutcome: "resolved",
      propertyKey: "kv_100c",
      displayValue: "14.2",
      valueType: SpecValueType.RANGE,
      numericMin: "10",
      numericMax: null,
      pairFirst: null,
      pairSecond: null,
      valueUnreadable: false,
    });
    expect(decision.withholdReason).toBe("VALUE_SHAPE_REJECTED_BY_DATABASE");
    expect(decision.violations.join(" ")).toContain("specifications_value_shape");
  });
});

describe("every planned Specification satisfies the real constraints", () => {
  const candidates = plan.products.flatMap((product) =>
    product.technicalFacts.flatMap((fact) => (fact.specification === null ? [] : [fact])),
  );

  it("plans 1398 of them, and every single one passes the simulation", () => {
    expect(candidates).toHaveLength(1398);
    for (const fact of candidates) {
      const specification = fact.specification!;
      const verdict = validateSpecificationShape({
        propertyKey: specification.propertyKey,
        displayValue: specification.displayValue,
        valueType: specification.valueType,
        numericMin: specification.numericMin,
        numericMax: specification.numericMax,
        pairFirst: specification.pairFirst,
        pairSecond: specification.pairSecond,
      });
      expect({ key: specification.propertyKey, violations: verdict.violations }).toEqual({
        key: specification.propertyKey,
        violations: [],
      });
    }
  });

  it("gives every one of them a non-blank display value and a value type", () => {
    for (const fact of candidates) {
      expect(fact.specification!.displayValue.trim().length).toBeGreaterThan(0);
      expect(fact.specification!.valueType).not.toBeNull();
    }
  });

  it("attaches every one of them to exactly one owning SourceFact", () => {
    for (const fact of candidates) {
      expect(fact.sourceFact.rawValue).toBe(fact.specification!.displayValue);
      expect(fact.sourceFact.documentKey.length).toBeGreaterThan(0);
    }
  });

  it("names only grades the product actually has, which the composite FK requires", () => {
    for (const product of plan.products) {
      const labels = new Set(product.grades.map((grade) => grade.label));
      for (const fact of product.technicalFacts) {
        if (fact.specification?.gradeLabel == null) continue;
        expect(labels.has(fact.specification.gradeLabel)).toBe(true);
      }
    }
  });

  it("withholds 130 facts, all of which keep their raw reading", () => {
    const withheld = plan.products.flatMap((product) =>
      product.technicalFacts.filter((fact) => fact.specification === null),
    );
    expect(withheld).toHaveLength(130);
    for (const fact of withheld) {
      expect(fact.withheldReason).not.toBeNull();
      expect(fact.withheldDetail).not.toBeNull();
      expect(typeof fact.sourceFact.rawValue).toBe("string");
    }
  });
});
