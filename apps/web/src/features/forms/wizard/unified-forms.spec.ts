import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The owner decision, asserted across every public customer-inquiry form at once.
 *
 * ── Why these are source assertions ─────────────────────────────────────────
 *
 * `apps/web` runs Vitest with `environment: "node"` and installs no testing library, so a wizard
 * cannot be mounted and driven here. Everything below is therefore a property of the *composition*
 * — which forms use the shell, what they hand it, and what stays out of the steps before the last.
 * The interactive half (focus movement, the Enter guard, Back preserving values, the review reading
 * live values) is verified in a real browser and reported with the gate.
 *
 * They are narrow deliberately, and each one names a defect that would otherwise be silent:
 * a form that quietly stops using the shell, a consent control that drifts back onto step one, a
 * field that disappears from a payload because it was dropped from a step table.
 */

const WEB_SRC = join(__dirname, "..", "..", "..");

/** Every public form that creates a customer inquiry. Admin, auth and filtering are not inquiries. */
const INQUIRY_FORMS = [
  [
    "Inquiry form (Contact Us, Request a Quote, homepage panel)",
    join(__dirname, "..", "inquiry-form.tsx"),
  ],
  [
    "Custom Product Request (Customized Solutions)",
    join(WEB_SRC, "features", "customized-solutions", "sections", "custom-request-form.tsx"),
  ],
] as const;

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/**
 * The same source with block comments removed.
 *
 * Both form files *describe* `<form>` in prose — the Custom Product Request's header recounts that
 * it was once "a `<fieldset disabled>` with no `<form>` around it" — so a bare substring search
 * finds the word in a sentence and reports a defect that is not there. Every assertion about what
 * the markup does runs against the comment-free text, the same precaution
 * `flagship-conformance.spec.ts` takes for the same reason.
 */
function readCode(file: string): string {
  return read(file).replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("every public inquiry form uses the one shared shell", () => {
  it.each(INQUIRY_FORMS)("%s renders FormWizard", (_name, file) => {
    const source = read(file);

    expect(source).toContain("<FormWizard");
    expect(source).toMatch(
      /from "(\.\/wizard\/form-wizard|@\/features\/forms\/wizard\/form-wizard)"/,
    );
  });

  /*
   * The shell owns the `<form>`. A form file that opens its own would be running its own
   * navigation, its own validation and its own Enter behaviour beside the shared ones — which is
   * exactly the three-copied-implementations outcome this gate exists to remove.
   */
  it.each(INQUIRY_FORMS)("%s does not open a <form> of its own", (_name, file) => {
    expect(readCode(file)).not.toMatch(/<form[\s>]/);
  });

  it.each(INQUIRY_FORMS)("%s declares two data steps, contact then request", (_name, file) => {
    const source = read(file);

    expect(source).toMatch(
      /id: "contact",\s*\n\s*label: "Contact",\s*\n\s*heading: "Contact details"/,
    );
    expect(source).toMatch(
      /id: "request",\s*\n\s*label: "Request",\s*\n\s*heading: "Request details"/,
    );
  });
});

describe("consent and the challenge belong to the final step only", () => {
  /*
   * Both are passed to the shell as slots, and the shell renders slots on the review step. A
   * `consentGiven` control written inline in a step's fields would appear on step one — legally the
   * wrong place to take consent, and the reason this is asserted rather than reviewed.
   */
  it.each(INQUIRY_FORMS)("%s passes consent to the shell as a slot", (_name, file) => {
    const source = read(file);
    const slot = source.indexOf("consent={");
    const control = source.indexOf('name="consentGiven"');

    expect(slot).toBeGreaterThan(-1);
    expect(control).toBeGreaterThan(slot);
  });

  it("the shell renders consent and submit only inside the review panel", () => {
    const shell = read(join(__dirname, "form-wizard.tsx"));
    const reviewPanel = shell.indexOf('className="fw-panel fw-panel--review"');
    const consent = shell.indexOf("{consent}");
    const submit = shell.indexOf("{submitSlot}");

    expect(reviewPanel).toBeGreaterThan(-1);
    expect(consent).toBeGreaterThan(reviewPanel);
    expect(submit).toBeGreaterThan(reviewPanel);
  });

  /*
   * The submit control exists once, on the review step. A second one on an earlier step would make
   * "Enter does not submit early" a promise the markup contradicts.
   */
  it("the shell renders no submit control outside the review panel", () => {
    const shell = read(join(__dirname, "form-wizard.tsx"));

    expect(shell.match(/\{submitSlot\}/g)).toHaveLength(1);
  });

  it("the Continue and Back controls are explicitly type=button", () => {
    const shell = readCode(join(__dirname, "form-wizard.tsx"));
    const buttons = shell.match(/<button\s+type="button"/g) ?? [];

    // Back and Continue. A bare <button> inside a <form> defaults to submit.
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(shell).not.toMatch(/<button(?!\s+type=)/);
  });

  it("the step indicator's controls are explicitly type=button too", () => {
    const indicator = readCode(join(__dirname, "step-indicator.tsx"));

    expect(indicator).toMatch(/<button\s+type="button"/);
    expect(indicator).not.toMatch(/<button(?!\s+type=)/);
  });
});

/**
 * Enter, as the owner decided it: it does nothing in an ordinary control.
 *
 * ── What these hold, and what the browser check holds ───────────────────────
 *
 * The handler is a closure inside a Client Component, and this runner has no DOM to dispatch a
 * key event into. So these assert its *shape* — that the only escape hatches are a textarea and a
 * button, and that no navigation call follows the `preventDefault`. The behaviour itself was
 * driven in a real browser and is reported with the gate.
 *
 * The regression each one guards is specific. An earlier revision of this shell called `advance()`
 * after `preventDefault`, which is a common wizard pattern and the one the owner ruled out: it
 * moves the page under someone who pressed Enter to accept an autocomplete suggestion.
 */
describe("Enter neither submits nor navigates", () => {
  const handler = (): string => {
    const shell = readCode(join(__dirname, "form-wizard.tsx"));
    const start = shell.indexOf("onKeyDown={(event) => {");
    const end = shell.indexOf("</form>", start);

    expect(start).toBeGreaterThan(-1);

    return shell.slice(start, shell.indexOf("}}", start) + 2);
  };

  it("acts only on Enter", () => {
    expect(handler()).toMatch(/if \(event\.key !== "Enter"\) return;/);
  });

  it("lets a textarea keep Enter as a newline", () => {
    expect(handler()).toMatch(/instanceof HTMLTextAreaElement\) return;/);
  });

  it("lets a focused button keep native activation", () => {
    expect(handler()).toMatch(/instanceof HTMLButtonElement\) return;/);
  });

  it("suppresses the default and does nothing else", () => {
    const body = handler();

    expect(body).toContain("event.preventDefault();");
    // No navigation call may follow — that was the behaviour the owner ruled out.
    expect(body).not.toMatch(/advance\(\)/);
    expect(body).not.toMatch(/goTo\(/);
    expect(body).not.toMatch(/setActiveIndex\(/);
  });

  /*
   * The guard is unconditional across steps. Scoping it to "not the review step" would leave Enter
   * able to submit from the review before the visitor reached the submit button, which is the one
   * control the decision says may submit.
   */
  it("applies on every step, including the review", () => {
    expect(handler()).not.toMatch(/onReview/);
  });

  it("leaves exactly one control able to submit", () => {
    const shell = readCode(join(__dirname, "form-wizard.tsx"));

    expect(shell.match(/\{submitSlot\}/g)).toHaveLength(1);
    expect(shell).not.toMatch(/type="submit"/);
  });
});

describe("the payload is unchanged by stepping the forms", () => {
  /**
   * Every name the Inquiry form's DTO accepts, as the single-page form submitted them.
   *
   * Stepping a form is a presentation change; this is the assertion that says so. A field dropped
   * from a step table would vanish from the payload silently, because the shell renders only what
   * a step declares.
   */
  const INQUIRY_FIELDS = [
    "firstName",
    "lastName",
    "companyName",
    "country",
    "email",
    "phone",
    "industry",
    "inquiryType",
    "requiredQuantity",
    "destinationCountryPort",
    "preferredIncoterm",
    "message",
  ];

  it.each(INQUIRY_FIELDS)("the Inquiry form still submits %s", (name) => {
    const source = read(join(__dirname, "..", "inquiry-form.tsx"));

    // Present as a rendered control and accounted for in a step.
    expect(source).toMatch(new RegExp(`name="${name}"|name=\\{"${name}"\\}|"${name}"`));
  });

  it("the Inquiry form's step tables cover every field it submits", () => {
    const source = read(join(__dirname, "..", "inquiry-form.tsx"));
    const stepFields = [...source.matchAll(/fields: \[([^\]]*)\]/g)]
      .flatMap((match) => (match[1] ?? "").split(","))
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter((entry) => entry !== "");

    for (const name of INQUIRY_FIELDS) expect(stepFields).toContain(name);
  });

  /*
   * The Custom Product Request keeps `solutions-form.ts` as its field source. That module mirrors
   * the DTO and the NOT NULL columns, so a step table that stopped covering it would be a payload
   * change disguised as a layout change.
   */
  it("the Custom Product Request's step tables cover every declared field", () => {
    const form = read(
      join(WEB_SRC, "features", "customized-solutions", "sections", "custom-request-form.tsx"),
    );
    const definitions = read(
      join(WEB_SRC, "features", "customized-solutions", "solutions-form.ts"),
    );

    const declared = [...definitions.matchAll(/name: "([A-Za-z]+)"/g)].map((match) => match[1]);
    const stepFields = [...form.matchAll(/fields: \[([^\]]*)\]/g)]
      .flatMap((match) => (match[1] ?? "").split(","))
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter((entry) => entry !== "");

    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) expect(stepFields).toContain(name);
  });

  it("the Custom Product Request still reads its fields from the DTO-mirroring module", () => {
    const form = read(
      join(WEB_SRC, "features", "customized-solutions", "sections", "custom-request-form.tsx"),
    );

    expect(form).toContain("REQUEST_GROUPS");
    expect(form).toContain("../solutions-form");
  });
});

describe("the step indicator is semantic, not decorative", () => {
  const indicator = (): string => read(join(__dirname, "step-indicator.tsx"));

  it("marks the current step with aria-current=step", () => {
    expect(indicator()).toContain('aria-current={index === activeIndex ? "step" : undefined}');
  });

  it("states total progress in words rather than leaving it to be counted", () => {
    expect(indicator()).toMatch(/Step \{activeIndex \+ 1\} of \{total\}/);
  });

  it("announces the completed state rather than only drawing it", () => {
    expect(indicator()).toMatch(/state === "done" && <VisuallyHidden> completed<\/VisuallyHidden>/);
  });

  it("makes an unreached step unavailable rather than silently inert", () => {
    expect(indicator()).toContain("disabled={!reachable || index === activeIndex}");
  });
});

/**
 * Target sizes, with the two criteria kept apart.
 *
 * WCAG 2.2 **AA** is SC 2.5.8 Target Size (Minimum), **24x24** CSS px.
 * WCAG 2.2 **AAA** is SC 2.5.5 Target Size (Enhanced), **44x44** CSS px.
 *
 * Every control in this form clears the higher of the two. The review's Edit action is the one that
 * needed help: its visible box is 24px, which meets AA on its own, and it reaches 44px through an
 * out-of-flow overlay rather than by growing the glyph — measured 50x44 in a browser at 320, 375,
 * 768, 1024, 1440 and 1920px, and in RTL.
 */
describe("pointer targets clear the 44px enhanced floor", () => {
  const css = (): string => read(join(__dirname, "..", "forms.css"));

  it("grows the Edit action's target with an overlay, not with its own box", () => {
    const source = css();

    expect(source).toMatch(/\.fw-review-edit\s*\{[^}]*position: relative;/);
    expect(source).toMatch(/\.fw-review-edit::after\s*\{[^}]*position: absolute;/);
  });

  /*
   * `min(0px, …)` is the grow-only clamp. Without it the same expression SHRINKS an axis that
   * already exceeds 44px — the inline axis does, at ~50px — which would pull the target inwards
   * and quietly undo the fix on the wider of the two dimensions.
   */
  it("expands each axis to 44px and never contracts one", () => {
    const source = css();
    const rule = source.slice(source.indexOf(".fw-review-edit::after"));
    const body = rule.slice(0, rule.indexOf("}"));

    expect(body).toContain("inset-block: min(0px, calc((44px - 100%) / -2));");
    expect(body).toContain("inset-inline: min(0px, calc((44px - 100%) / -2));");
  });

  /* Logical properties, so the growth is symmetric in both writing directions with no RTL rule. */
  it("uses logical insets so RTL needs no special case", () => {
    const rule = css().slice(css().indexOf(".fw-review-edit::after"));
    const body = rule.slice(0, rule.indexOf("}"));

    expect(body).not.toMatch(/\b(top|right|bottom|left):/);
  });

  /* The overlay must draw nothing — it is a hit area, not a visible box. */
  it("gives the overlay no paint of its own", () => {
    const rule = css().slice(css().indexOf(".fw-review-edit::after"));
    const body = rule.slice(0, rule.indexOf("}"));

    expect(body).not.toMatch(/background|border|outline|box-shadow/);
  });

  it("keeps the visible control at the AA floor", () => {
    expect(css()).toMatch(/\.fw-review-edit\s*\{[^}]*min-block-size: var\(--fs-control-min\);/);
  });
});
