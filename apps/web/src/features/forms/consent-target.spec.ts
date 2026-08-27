import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The consent checkbox's target size — WCAG 2.2 AA 2.5.8, asserted against the real stylesheets.
 *
 * ## Why this is a CSS-source test and not a rendered measurement
 *
 * The runner is `environment: "node"`: there is no layout engine here, so a spec cannot measure a
 * box. Browser verification does that, and did — the control was measured at 16×16 with its nearest
 * adjacent target 20 CSS pixels away, failing both the 24×24 threshold and the spacing exception,
 * and re-measured after the fix.
 *
 * What a spec *can* hold is the contract that produced the measurement: the declared size of the two
 * shared rules, and the fact that every consent checkbox on the platform is inside one of them. That
 * is the part that regresses silently — a value edited back down, or a fourth form that quietly
 * styles its own checkbox — and it is what fails here.
 *
 * ## Why the two rules are asserted together
 *
 * They are the same control in two stylesheets: `.pr-consent` serves the Customized Solutions
 * request form, and `.fm-consent` the Contact Us inquiry form. A
 * consent control that meets the target size on one page and not the other is exactly the
 * divergence that made this a shared fix rather than a page-level one.
 */

const MINIMUM_TARGET_PX = 24;

const FEATURES = join(__dirname, "..");

const SHARED_RULES = [
  { file: join(FEATURES, "products", "products.css"), selector: ".pr-consent input" },
  { file: join(FEATURES, "forms", "forms.css"), selector: ".fm-consent input" },
] as const;

/** The declaration block for a selector, as written. */
function ruleBody(file: string, selector: string): string {
  const css = readFileSync(file, "utf8");
  const start = css.indexOf(`${selector} {`);

  expect(start, `${selector} must exist in ${file}`).toBeGreaterThan(-1);

  return css.slice(start, css.indexOf("}", start));
}

function pixels(body: string, property: string): number {
  const match = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`).exec(body);

  expect(match, `${property} must be declared in CSS pixels`).not.toBeNull();

  return Number(match?.[1]);
}

describe("the consent checkbox meets the minimum target size", () => {
  it.each(SHARED_RULES)("$selector is at least 24×24", ({ file, selector }) => {
    const body = ruleBody(file, selector);

    expect(pixels(body, "width")).toBeGreaterThanOrEqual(MINIMUM_TARGET_PX);
    expect(pixels(body, "height")).toBeGreaterThanOrEqual(MINIMUM_TARGET_PX);
  });

  /**
   * The control must stay a native checkbox. `accent-color` tints the browser's own control; an
   * `appearance: none` would replace it with a painted box, taking the native checked state, the
   * native focus ring and the native keyboard behaviour with it.
   */
  it.each(SHARED_RULES)("$selector keeps the native control", ({ file, selector }) => {
    const body = ruleBody(file, selector);

    expect(body).toContain("accent-color");
    expect(body).not.toContain("appearance");
  });

  it("declares the same size in both stylesheets", () => {
    const [first, second] = SHARED_RULES.map(({ file, selector }) => {
      const body = ruleBody(file, selector);

      return `${String(pixels(body, "width"))}x${String(pixels(body, "height"))}`;
    });

    expect(first).toBe(second);
  });
});

describe("every consent checkbox uses a shared construction", () => {
  /**
   * A checkbox styled outside these two rules would be a fourth consent control with its own size,
   * and nothing above would notice. Each markup site is listed with the class it must sit inside.
   */
  const MARKUP = [
    {
      file: join(FEATURES, "customized-solutions", "sections", "custom-request-form.tsx"),
      className: "pr-consent",
    },
    { file: join(FEATURES, "forms", "inquiry-form.tsx"), className: "fm-consent" },
  ] as const;

  it.each(MARKUP)("$className wraps the checkbox in $file", ({ file, className }) => {
    const source = readFileSync(file, "utf8");
    const wrapper = source.indexOf(`className="${className}"`);

    expect(wrapper, "the shared consent wrapper must be used").toBeGreaterThan(-1);

    // The checkbox is the next input after the wrapper, and it is a native one.
    const after = source.slice(wrapper, wrapper + 400);

    expect(after).toContain('type="checkbox"');
    expect(after).toContain("<label htmlFor=");
  });

  it("finds no consent checkbox outside those two sites", () => {
    const sites = MARKUP.map((entry) => entry.file);
    const found = collectCheckboxFiles(FEATURES);

    expect(found.filter((file) => !sites.includes(file as never))).toEqual([]);
  });
});

/** Every non-spec component declaring a checkbox input. */
function collectCheckboxFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      collectCheckboxFiles(path, found);
    } else if (/\.tsx$/.test(entry.name) && !/\.spec\.tsx$/.test(entry.name)) {
      if (readFileSync(path, "utf8").includes('type="checkbox"')) {
        found.push(path);
      }
    }
  }

  return found;
}
