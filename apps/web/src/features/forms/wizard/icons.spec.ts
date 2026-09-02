import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The icon set's accessibility and consistency contract.
 *
 * Lucide renders SVG, and this runner has no DOM to render into, so these hold the properties at
 * the source — which is where they are decided anyway. Each is a property that fails silently:
 * an icon that forgets `aria-hidden` reads its own name aloud before the message it decorates, and
 * a second stroke width is invisible in review and obvious on the page.
 */

const ICONS = readFileSync(join(__dirname, "icons.tsx"), "utf8");

const EXPORTED = [
  "StepCompleteIcon",
  "BackIcon",
  "ContinueIcon",
  "EditIcon",
  "FieldErrorIcon",
  "FormErrorIcon",
  "FormSuccessIcon",
  "ChallengeErrorIcon",
  "SubmitIcon",
];

describe("every icon is decorative to assistive technology", () => {
  /*
   * All nine are `aria-hidden`, and that is correct rather than lazy: each sits beside text that
   * already carries the meaning — a button label, a banner sentence, the visually-hidden
   * "completed" on a step. Removing every icon would take nothing away from anyone.
   */
  it("applies aria-hidden and focusable=false to all of them at once", () => {
    expect(ICONS).toMatch(/const HIDDEN = \{ "aria-hidden": true, focusable: "false" \} as const;/);
  });

  it.each(EXPORTED)("%s spreads the hidden attributes", (name) => {
    const start = ICONS.indexOf(`export function ${name}(`);
    const body = ICONS.slice(start, ICONS.indexOf("\n}", start));

    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("{...HIDDEN}");
  });

  /* No icon may carry its own label — that would make it a second, competing announcement. */
  it("gives no icon an aria-label or a title", () => {
    expect(ICONS).not.toMatch(/aria-label/);
    expect(ICONS).not.toMatch(/<title/);
  });
});

describe("one family, one stroke, one size scale", () => {
  it("imports only from lucide-react", () => {
    expect(ICONS).toMatch(/from "lucide-react";/);
    expect(ICONS.match(/^import .* from "(?!lucide-react|react)/gm) ?? []).toHaveLength(0);
  });

  it("writes the stroke width exactly once", () => {
    expect(ICONS.match(/const STROKE = /g)).toHaveLength(1);
  });

  it.each(EXPORTED)("%s uses the shared stroke", (name) => {
    const start = ICONS.indexOf(`export function ${name}(`);
    const body = ICONS.slice(start, ICONS.indexOf("\n}", start));

    expect(body).toContain("strokeWidth={STROKE}");
  });

  /*
   * Sizes come from `--fs-icon-*` through a class, not from Lucide's numeric `size` prop. A numeric
   * size would be a second scale living beside the token one and drifting from it.
   */
  it.each(EXPORTED)("%s sizes itself from the shared class, not a number", (name) => {
    const start = ICONS.indexOf(`export function ${name}(`);
    const body = ICONS.slice(start, ICONS.indexOf("\n}", start));

    expect(body).toContain("className={iconClass(");
    expect(body).not.toMatch(/size=\{\d/);
  });
});

describe("direction", () => {
  /* Only the navigation arrows have a direction to mirror. A tick and a shield do not. */
  it.each(["BackIcon", "ContinueIcon"])("%s is marked directional", (name) => {
    const start = ICONS.indexOf(`export function ${name}(`);
    const body = ICONS.slice(start, ICONS.indexOf("\n}", start));

    expect(body).toContain("directional: true");
  });

  it.each(["StepCompleteIcon", "EditIcon", "FieldErrorIcon", "FormSuccessIcon", "SubmitIcon"])(
    "%s is not mirrored",
    (name) => {
      const start = ICONS.indexOf(`export function ${name}(`);
      const body = ICONS.slice(start, ICONS.indexOf("\n}", start));

      expect(body).not.toContain("directional: true");
    },
  );

  it("mirrors the directional class under dir=rtl", () => {
    const css = readFileSync(join(__dirname, "..", "forms.css"), "utf8");

    expect(css).toMatch(/\[dir="rtl"\] \.fw-icon--dir \{\s*transform: scaleX\(-1\);/);
  });

  it("sizes the icon classes from the shared tokens", () => {
    const css = readFileSync(join(__dirname, "..", "forms.css"), "utf8");

    expect(css).toContain("inline-size: var(--fs-icon-md)");
    expect(css).toContain("inline-size: var(--fs-icon-sm)");
    expect(css).toContain("inline-size: var(--fs-icon-lg)");
  });
});

describe("icons support text, they do not replace it", () => {
  const shell = readFileSync(join(__dirname, "form-wizard.tsx"), "utf8");
  const review = readFileSync(join(__dirname, "review-summary.tsx"), "utf8");
  const feedback = readFileSync(join(__dirname, "..", "form-feedback.tsx"), "utf8");

  it("keeps the word beside Back and Continue", () => {
    expect(shell).toMatch(/<BackIcon size="sm" \/>\s*\n\s*Back/);
    expect(shell).toMatch(/Continue\s*\n\s*<ContinueIcon size="sm" \/>/);
  });

  it("keeps the word beside Edit", () => {
    expect(review).toMatch(/<EditIcon size="sm" \/>\s*\n\s*Edit/);
  });

  it("keeps the message beside every status mark", () => {
    expect(feedback).toMatch(/<FormSuccessIcon \/>\s*\n\s*\{SUCCESS_MESSAGE\}/);
    expect(feedback).toMatch(/<FieldErrorIcon \/>\s*\n\s*\{issues\[0\]\}/);
    expect(feedback).toMatch(/<FormErrorIcon \/>\s*\n\s*\{FAILURE_MESSAGE/);
  });

  /*
   * The submit mark is dropped while pending: "Sending…" already states the state, and a "send"
   * glyph beside it is a second claim about the same thing that has gone stale.
   */
  it("drops the submit mark while the submission is in flight", () => {
    expect(feedback).toContain('{!pending && <SubmitIcon size="sm" />}');
  });

  /* The Contact pathway cards keep their two-letter technical codes — out of scope, unchanged. */
  it("leaves the Contact pathway codes alone", () => {
    const pathways = readFileSync(
      join(__dirname, "..", "..", "contact", "sections", "pathways.tsx"),
      "utf8",
    );

    expect(pathways).toContain("ct-pathway-code");
    expect(pathways).not.toMatch(/lucide-react/);
  });
});
