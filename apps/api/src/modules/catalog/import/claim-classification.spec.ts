import { classifyClaim, NEVER_PUBLISHABLE_KINDS } from "./claim-classification";

import type { RawClaim } from "./catalog-import.types";

const claim = (overrides: Partial<RawClaim> & Pick<RawClaim, "sourceText">): RawClaim => ({
  pageNumber: null,
  ...overrides,
});

describe("a bare designation is a classification and nothing more", () => {
  it("classifies an API class stated with no verb as CLASSIFICATION_STATED", () => {
    const decision = classifyClaim(
      claim({ sourceText: "CI-4 15W-40", standardBody: "API", standardCode: "CI-4" }),
      false,
    );
    expect(decision.kind).toBe("CLASSIFICATION_STATED");
    expect(decision.reviewStatus).toBe("SOURCE_RECORDED");
  });

  it("does not upgrade it to MEETS or APPROVED_BY", () => {
    const decision = classifyClaim(claim({ sourceText: "GL-5 85W-140" }), false);
    expect(decision.kind).not.toBe("MEETS");
    expect(decision.kind).not.toBe("APPROVED_BY");
  });
});

describe("the source's own verb governs", () => {
  it("reads `recommended for` as RECOMMENDED_FOR", () => {
    expect(
      classifyClaim(claim({ sourceText: "which is recommended for modern gasoline cars" }), false)
        .kind,
    ).toBe("RECOMMENDED_FOR");
  });

  it("reads `can meet the requirements of` as MEETS", () => {
    expect(
      classifyClaim(claim({ sourceText: "can meet the requirements of CD" }), false).kind,
    ).toBe("MEETS");
  });

  it("reads `designed to provide` and `in line with` as FORMULATED_FOR", () => {
    expect(
      classifyClaim(
        claim({ sourceText: "designed to provide basic API performance claims from SL" }),
        false,
      ).kind,
    ).toBe("FORMULATED_FOR");
    expect(
      classifyClaim(
        claim({ sourceText: "in line with the Japanese JASO M345 FB, FC performance index" }),
        false,
      ).kind,
    ).toBe("FORMULATED_FOR");
  });

  it("reads `Suitable for` as SUITABLE_FOR", () => {
    expect(classifyClaim(claim({ sourceText: "Suitable for manual gear box" }), false).kind).toBe(
      "SUITABLE_FOR",
    );
  });

  it("prefers the stronger verb when a sentence carries two", () => {
    // "can meet" must not be read as merely "suitable for".
    expect(
      classifyClaim(
        claim({ sourceText: "suitable for blending and can meet the requirements of CD" }),
        false,
      ).kind,
    ).toBe("MEETS");
  });
});

describe("an external licence can never become a SAM claim", () => {
  it("demotes a licensing statement to REFERENCE_ONLY", () => {
    const decision = classifyClaim(
      claim({ sourceText: "UNDER LICENSE OF BRITISH PETROLEUM GLOBAL ENGLAND" }),
      false,
    );
    expect(decision.kind).toBe("REFERENCE_ONLY");
    expect(decision.flags.map((flag) => flag.code)).toContain("CLAIM_EXTERNAL_LICENCE");
  });

  it("puts it in a kind the database refuses to approve", () => {
    const decision = classifyClaim(claim({ sourceText: "licensed by Someone" }), false);
    expect(NEVER_PUBLISHABLE_KINDS).toContain(decision.kind);
  });

  it("never produces LICENSED_BY itself, so there is no promotion path from it", () => {
    const decision = classifyClaim(claim({ sourceText: "UNDER LICENSE OF X" }), false);
    expect(decision.kind).not.toBe("LICENSED_BY");
  });
});

describe("an approval that names nobody is not an approval", () => {
  it("demotes it to REFERENCE_ONLY and marks it for review", () => {
    const decision = classifyClaim(
      claim({ sourceText: "approval by reputable global automakers" }),
      false,
    );
    expect(decision.kind).toBe("REFERENCE_ONLY");
    expect(decision.reviewStatus).toBe("NEEDS_REVIEW");
    expect(decision.flags.map((flag) => flag.code)).toContain("CLAIM_APPROVAL_NAMES_NOBODY");
  });

  it("demotes even a NAMED external approval, because only the body may assert one", () => {
    const decision = classifyClaim(
      claim({ sourceText: "approved by Denison", standardBody: "Denison" }),
      false,
    );
    expect(decision.kind).toBe("REFERENCE_ONLY");
    expect(decision.flags.map((flag) => flag.code)).toContain("CLAIM_EXTERNAL_APPROVAL");
  });
});

describe("a `meets` claim with no named party", () => {
  it("is flagged as unusable", () => {
    const decision = classifyClaim(
      claim({
        sourceText:
          "Meets the requirements of the manufacturers as regards extended oil change intervals",
      }),
      false,
    );
    expect(decision.kind).toBe("MEETS");
    expect(decision.flags.map((flag) => flag.code)).toContain("CLAIM_MEETS_UNNAMED_PARTY");
    expect(decision.reviewStatus).toBe("NEEDS_REVIEW");
  });
});

describe("the additive claim-transfer trap", () => {
  it("flags every performance level stated on an additive", () => {
    const decision = classifyClaim(
      claim({
        sourceText: "can meet the requirements of CD",
        standardBody: "API",
        standardCode: "CD",
      }),
      true,
    );
    expect(decision.flags.map((flag) => flag.code)).toContain("CLAIM_ADDITIVE_TREAT_RATE_TRANSFER");
    expect(decision.reviewStatus).toBe("NEEDS_REVIEW");
  });

  it("attaches the treat-rate context so the level is never read as the additive's own", () => {
    const decision = classifyClaim(
      claim({ sourceText: "CD", standardCode: "CD", contextNote: "Treat rate: 5.4% multi-grade" }),
      true,
    );
    expect(decision.contextNote).toBe("Treat rate: 5.4% multi-grade");
  });

  it("supplies a context note even when the sheet stated no rate", () => {
    const decision = classifyClaim(claim({ sourceText: "SN", standardCode: "SN" }), true);
    expect(decision.contextNote).toContain("blended oil");
  });

  it("does NOT flag the same claim on a finished lubricant", () => {
    const decision = classifyClaim(claim({ sourceText: "CD", standardCode: "CD" }), false);
    expect(decision.flags.map((flag) => flag.code)).not.toContain(
      "CLAIM_ADDITIVE_TREAT_RATE_TRANSFER",
    );
  });
});

describe("no claim is ever approved", () => {
  it("only ever produces SOURCE_RECORDED or NEEDS_REVIEW", () => {
    const texts = [
      "CI-4 15W-40",
      "recommended for gasoline cars",
      "can meet the requirements of CD",
      "UNDER LICENSE OF BRITISH PETROLEUM GLOBAL ENGLAND",
      "approval by reputable global automakers",
      "Suitable for manual gear box",
    ];
    for (const sourceText of texts) {
      for (const isAdditive of [false, true]) {
        const decision = classifyClaim(claim({ sourceText }), isAdditive);
        expect(["SOURCE_RECORDED", "NEEDS_REVIEW"]).toContain(decision.reviewStatus);
      }
    }
  });
});
