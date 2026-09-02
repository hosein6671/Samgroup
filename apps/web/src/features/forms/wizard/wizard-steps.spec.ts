import { describe, expect, it } from "vitest";

import {
  REVIEW_STEP_HEADING,
  REVIEW_STEP_LABEL,
  firstInvalidStep,
  isReviewStep,
  reviewEntries,
  totalSteps,
  type ReviewEntry,
  type WizardStep,
} from "./wizard-steps";

/**
 * The wizard's step arithmetic and its review reader.
 *
 * These are the parts of the shared shell that can be asserted without a DOM renderer — `apps/web`
 * runs Vitest with `environment: "node"` and installs no testing library, a constraint
 * `vitest.config.mts` records. The behaviours that need a user agent (focus movement, the Enter
 * guard, `hidden` panels retaining values) are verified in a real browser and reported with the
 * gate; what is held here is the logic those behaviours are built on.
 */

const STEPS: readonly WizardStep[] = [
  { id: "contact", label: "Contact", heading: "Contact details", fields: ["email", "phone"] },
  { id: "request", label: "Request", heading: "Request details", fields: ["message"] },
];

describe("step arithmetic", () => {
  it("counts the review step that no form declares", () => {
    expect(totalSteps(STEPS)).toBe(3);
  });

  it("treats the index past the declared steps as the review", () => {
    expect(isReviewStep(STEPS, 0)).toBe(false);
    expect(isReviewStep(STEPS, 1)).toBe(false);
    expect(isReviewStep(STEPS, 2)).toBe(true);
  });

  it("names the review step once, for every form", () => {
    expect(REVIEW_STEP_LABEL).toBe("Review");
    expect(REVIEW_STEP_HEADING).toBe("Review and submit");
  });
});

describe("returning to a server-rejected field", () => {
  it("finds the step holding the rejected field", () => {
    expect(firstInvalidStep(STEPS, { phone: ["bad"] })).toBe(0);
    expect(firstInvalidStep(STEPS, { message: ["bad"] })).toBe(1);
  });

  it("prefers the earliest step when more than one holds an error", () => {
    expect(firstInvalidStep(STEPS, { message: ["bad"], email: ["bad"] })).toBe(0);
  });

  /*
   * The case that must NOT resolve to a step: a consent or Turnstile rejection belongs to no
   * declared field, and moving the visitor to step one for it would take them away from the
   * control that actually failed.
   */
  it("answers -1 when the rejection belongs to no declared field", () => {
    expect(firstInvalidStep(STEPS, { consentGiven: ["required"] })).toBe(-1);
    expect(firstInvalidStep(STEPS, {})).toBe(-1);
  });
});

/**
 * A minimal stand-in for the live form the review reads.
 *
 * `reviewEntries` uses exactly two things — `new FormData(form)` and `form.elements.namedItem` —
 * so a stub carrying those is enough to assert the reader without a DOM. The real behaviour it is
 * standing in for is verified in the browser.
 */
function formStub(values: Record<string, string>): HTMLFormElement {
  const entries = Object.entries(values);

  return {
    elements: {
      namedItem: (name: string) => (name in values ? {} : null),
    },
    [Symbol.for("nodejs.util.inspect.custom")]: () => "FormStub",
    __entries: entries,
  } as unknown as HTMLFormElement;
}

/*
 * `FormData` cannot be constructed from a stub, so the reader is exercised through a shimmed
 * global that reads the stub's entries. This keeps the assertion on the reader's own logic —
 * which names it skips, how it trims, what it marks empty — rather than on the platform's FormData.
 */
const RealFormData = globalThis.FormData;

class StubFormData {
  private readonly map: Map<string, string>;

  constructor(form: unknown) {
    this.map = new Map((form as { __entries: [string, string][] }).__entries);
  }

  get(name: string): string | null {
    return this.map.get(name) ?? null;
  }
}

describe("the review reader", () => {
  function read(
    step: WizardStep,
    values: Record<string, string>,
    labels: Record<string, string>,
  ): readonly ReviewEntry[] {
    globalThis.FormData = StubFormData as unknown as typeof RealFormData;

    try {
      return reviewEntries(formStub(values), step, labels);
    } finally {
      globalThis.FormData = RealFormData;
    }
  }

  const step = STEPS[0] as WizardStep;

  it("lists a step's fields in the declared order, with their labels", () => {
    const entries = read(
      step,
      { email: "buyer@example.test", phone: "+1 555" },
      { email: "Email address", phone: "Phone / WhatsApp" },
    );

    expect(entries.map((entry) => entry.name)).toEqual(["email", "phone"]);
    expect(entries.map((entry) => entry.label)).toEqual(["Email address", "Phone / WhatsApp"]);
    expect(entries[0]?.value).toBe("buyer@example.test");
  });

  /*
   * The property that lets ONE step table serve the Inquiry form's full and compact variants: a
   * field the variant did not render is skipped rather than listed as blank.
   */
  it("skips a field the form did not render", () => {
    const entries = read(
      step,
      { email: "buyer@example.test" },
      { email: "Email address", phone: "Phone / WhatsApp" },
    );

    expect(entries.map((entry) => entry.name)).toEqual(["email"]);
  });

  it("skips a field with no label to show it under", () => {
    const entries = read(step, { email: "a@b.test", phone: "+1" }, { email: "Email address" });

    expect(entries.map((entry) => entry.name)).toEqual(["email"]);
  });

  it("marks a blank optional field empty rather than dropping it", () => {
    const entries = read(
      step,
      { email: "a@b.test", phone: "   " },
      { email: "Email address", phone: "Phone / WhatsApp" },
    );

    expect(entries[1]).toMatchObject({ name: "phone", value: "", empty: true });
  });

  it("trims what it shows, so whitespace does not read as a value", () => {
    const entries = read(step, { email: "  a@b.test  " }, { email: "Email address" });

    expect(entries[0]).toMatchObject({ value: "a@b.test", empty: false });
  });

  /*
   * A `<select>` submits a value, not a label. The enquiry type's value is `general_inquiry`, and
   * showing that back to a person reviewing their own answers is showing them a vocabulary token.
   */
  describe("a select is read back by its chosen label, not its submitted token", () => {
    function selectStub(value: string, text: string, placeholderSelected = false): HTMLFormElement {
      const option = { textContent: text };

      return {
        elements: {
          namedItem: () => ({
            options: [option],
            selectedIndex: 0,
            selectedOptions: [placeholderSelected ? { textContent: "Select" } : option],
          }),
        },
        __entries: [["inquiryType", value]],
      } as unknown as HTMLFormElement;
    }

    const selectStep: WizardStep = {
      id: "contact",
      label: "Contact",
      heading: "Contact details",
      fields: ["inquiryType"],
    };

    function readSelect(form: HTMLFormElement): readonly ReviewEntry[] {
      globalThis.FormData = StubFormData as unknown as typeof RealFormData;

      try {
        return reviewEntries(form, selectStep, { inquiryType: "Enquiry type" });
      } finally {
        globalThis.FormData = RealFormData;
      }
    }

    it("shows the option text rather than the submitted value", () => {
      const entries = readSelect(selectStub("general_inquiry", "General enquiry"));

      expect(entries[0]).toMatchObject({ value: "General enquiry", empty: false });
    });

    /*
     * The case the short-circuit exists for: an unchosen optional select still has its placeholder
     * option selected, so reading its text would write "Select" where "Not provided" belongs.
     */
    it("stays empty when nothing was chosen, rather than reading the placeholder", () => {
      const entries = readSelect(selectStub("", "General enquiry", true));

      expect(entries[0]).toMatchObject({ value: "", empty: true });
    });
  });
});
