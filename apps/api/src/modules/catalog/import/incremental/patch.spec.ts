import { MappingConfidence, TechnicalReviewStatus } from "../../../../prisma/generated/enums";

import {
  COOLANT_NORMALIZATION_PATCH,
  patchEvidence,
  patchMappings,
  patchProperties,
  patchSpecifications,
} from "./patch";

describe("coolant source-layout patch", () => {
  it("is bounded to four exact immutable facts and two products", () => {
    expect(COOLANT_NORMALIZATION_PATCH.facts).toHaveLength(4);
    expect(new Set(COOLANT_NORMALIZATION_PATCH.facts.map((fact) => fact.sourceFactId)).size).toBe(
      4,
    );
    expect(new Set(COOLANT_NORMALIZATION_PATCH.facts.map((fact) => fact.productSourceRef))).toEqual(
      new Set(["SAMCAT-W1-R294", "SAMCAT-W1-R297"]),
    );
  });

  it("adds only the two controlled properties and promotes only their exact mappings", () => {
    expect(
      patchProperties()
        .map((row) => row.key)
        .sort(),
    ).toEqual(["coolant_ph_33pct_water", "coolant_reserve_alkalinity"]);
    expect(patchMappings()).toHaveLength(2);
    for (const mapping of patchMappings()) {
      expect(mapping.confidence).toBe(MappingConfidence.HIGH);
      expect(mapping.reviewStatus).toBe(TechnicalReviewStatus.SOURCE_RECORDED);
      expect(mapping.rawUnit).toBeNull();
    }
  });

  it("creates four non-public product-level candidates with one evidence link each", () => {
    expect(patchSpecifications()).toHaveLength(4);
    expect(patchEvidence()).toHaveLength(4);
    for (const specification of patchSpecifications()) {
      expect(specification.productGradeId).toBeNull();
      expect(specification.reviewStatus).toBe(TechnicalReviewStatus.NEEDS_REVIEW);
    }
    expect(new Set(patchEvidence().map((row) => row.specificationId))).toEqual(
      new Set(patchSpecifications().map((row) => row.id)),
    );
  });
});
