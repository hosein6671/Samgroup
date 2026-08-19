import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The Admin surface's colour pairings, measured against the **real** generated design tokens.
 *
 * ## Why this is a test and not a one-off audit
 *
 * A contrast audit run by hand is true on the day it was run. The palette is generated
 * (`packages/ui/src/tokens/theme.generated.css`) and the Admin stylesheet resolves every colour to
 * a token, so a regenerated token or a swapped `var()` can put this surface below AA without anyone
 * touching the Admin code. Reading the token file at test time is what makes the check survive
 * that: the ratios below are computed from whatever the palette currently says.
 *
 * ## The target
 *
 * WCAG 2.2 AA. Normal text ≥ 4.5:1 (§1.4.3), and user interface components and their states
 * ≥ 3:1 against adjacent colours (§1.4.11). Every Admin type ramp used here — `--text-body`
 * (16px), `--text-caption` (13px), `--text-technical` (12–13px) — is **normal** text, not large, so
 * the 3:1 large-text allowance is deliberately never applied to a text pairing.
 *
 * ## The light palette only, and why that is complete
 *
 * The `(admin)` root layout sets no `data-surface`, so the surface renders in the `:root` default —
 * light. `[data-surface="midnight"]` exists for the public site and no Admin element opts into it.
 * If one ever does, this file gains a second table rather than an assumption.
 *
 * ## What this cannot see
 *
 * Whether a focus ring is *drawn* where the audit assumes. Every focusable Admin control uses
 * `outline` with a non-zero `outline-offset`, so the ring is painted on the surface **behind** the
 * control rather than on the control itself — which is why `--color-focus-ring` is measured against
 * the surfaces and not against the accent button it sits on. That the offsets exist is asserted
 * below by reading the stylesheet; that the ring is visible was verified in a browser.
 */

/*
 * Resolved by path rather than through the package entry: `@sam-group/ui` publishes components,
 * and its `exports` map does not expose the generated stylesheet — nor should it, since nothing
 * imports the raw file at runtime. This test reads it as a file, which is what it is.
 */
const TOKENS_FILE = new URL(
  "../../../../../packages/ui/src/tokens/theme.generated.css",
  import.meta.url,
);
const ADMIN_CSS = new URL("./admin.css", import.meta.url);

/**
 * The light-context token values — what the Admin surface renders in.
 *
 * The generated file puts the primitives and the light semantics in `@theme` (so Tailwind can
 * generate utilities from them) and re-maps the same properties inside `[data-surface]` blocks for
 * the selective midnight context. Everything before the first `[data-surface` block is therefore
 * the light palette, and that is the slice read here — the midnight overrides are excluded on
 * purpose, since no Admin element opts into that context.
 */
function lightTokens(): Record<string, string> {
  const source = readFileSync(TOKENS_FILE, "utf8");
  const root = source.slice(0, source.indexOf("[data-surface="));
  const found: Record<string, string> = {};

  for (const [, name, value] of root.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    if (name !== undefined && value !== undefined) found[name] = value;
  }

  return found;
}

const TOKENS = lightTokens();

function token(name: string): string {
  const value = TOKENS[name];

  if (value === undefined) throw new Error(`token ${name} is not defined in the light palette`);

  return value;
}

/** WCAG relative luminance, sRGB. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (raw: number): number => {
    const c = raw / 255;

    return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];

  return (hi + 0.05) / (lo + 0.05);
}

/** Every text pairing the Admin surface actually renders. `where` names the element. */
const TEXT_PAIRS: [where: string, foreground: string, background: string][] = [
  ["page heading (.ad-heading) on the shell", "--color-text-primary", "--color-surface-sunken"],
  ["panel title (.ad-title) on a panel", "--color-text-primary", "--color-surface-raised"],
  ["shell note (.ad-note)", "--color-text-secondary", "--color-surface-sunken"],
  ["notice body (.ad-note in .ad-notice)", "--color-text-secondary", "--color-surface-raised"],
  ["identity line (.ad-identity)", "--color-text-secondary", "--color-surface-sunken"],
  ["role label (.ad-role)", "--color-text-accent", "--color-surface-sunken"],
  ["wordmark (.ad-mark)", "--color-text-tertiary", "--color-surface-sunken"],
  ["detail group title (.ad-group-title)", "--color-text-tertiary", "--color-surface-raised"],
  ["table column header", "--color-text-tertiary", "--color-surface-inset"],
  ["absent value (.ad-field-value--absent)", "--color-text-tertiary", "--color-surface-raised"],
  ["field label (.ad-field-label)", "--color-text-tertiary", "--color-surface-raised"],
  ["inert pager step", "--color-text-tertiary", "--color-surface-sunken"],
  ["link (.ad-link) in a notice", "--color-text-accent", "--color-surface-raised"],
  ["link (.ad-link) in a table row", "--color-text-accent", "--color-surface-raised"],
  ["timestamp cell (.ad-cell-stamp)", "--color-text-secondary", "--color-surface-raised"],
  ["timestamp cell on a hovered row", "--color-text-secondary", "--color-surface-inset"],
  ["table cell on a hovered row", "--color-text-primary", "--color-surface-inset"],
  ["filter chip (.ad-chip)", "--color-text-secondary", "--color-surface-sunken"],
  ["selected filter chip (.ad-chip--on)", "--color-text-primary", "--color-surface-inset"],
  ["current page step", "--color-text-on-accent", "--color-accent-default"],
  ["login banner (.ad-banner)", "--color-text-primary", "--color-surface-inset"],
  ["login label (.ad-label)", "--color-text-secondary", "--color-surface-raised"],
  ["login input text (.ad-input)", "--color-text-primary", "--color-surface-canvas"],
  ["submit button (.ad-submit)", "--color-text-on-accent", "--color-accent-default"],
  ["submit button hovered", "--color-text-on-accent", "--color-accent-hover"],
  ["sign out (.ad-signout)", "--color-text-secondary", "--color-surface-sunken"],
  ["module nav link (.ad-nav-link)", "--color-text-primary", "--color-surface-raised"],
];

/**
 * Non-text pairings — §1.4.11.
 *
 * Only boundaries that **identify a control** are here. A panel, table, notice or group border is
 * decorative: the element it outlines is not interactive and its identification does not depend on
 * the edge, so the hairline token stays there and is not measured. Darkening those would restyle
 * the whole surface to satisfy a criterion that does not apply to them.
 */
const COMPONENT_PAIRS: [where: string, foreground: string, background: string][] = [
  ["text input boundary", "--color-border-strong", "--color-surface-canvas"],
  ["sign out boundary", "--color-border-strong", "--color-surface-sunken"],
  ["module nav link boundary", "--color-border-strong", "--color-surface-sunken"],
  ["filter chip boundary", "--color-border-strong", "--color-surface-sunken"],
  ["selected chip boundary", "--color-border-accent", "--color-surface-sunken"],
  ["pager step boundary", "--color-border-strong", "--color-surface-sunken"],
  ["focus ring on the shell", "--color-focus-ring", "--color-surface-sunken"],
  ["focus ring on a panel", "--color-focus-ring", "--color-surface-raised"],
  ["focus ring on an inset row", "--color-focus-ring", "--color-surface-inset"],
];

describe("Admin text meets WCAG 2.2 AA (4.5:1)", () => {
  it.each(TEXT_PAIRS)("%s", (_where, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Admin interface components meet WCAG 2.2 AA (3:1)", () => {
  it.each(COMPONENT_PAIRS)("%s", (_where, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(3);
  });
});

describe("the stylesheet keeps the properties the audit assumes", () => {
  const css = readFileSync(ADMIN_CSS, "utf8");

  /**
   * The audit measures the focus ring against the surfaces because `outline-offset` paints it
   * outside the control. Without an offset the ring on the primary button would sit on the button's
   * own accent fill — the same colour, 1:1, an indicator that disappears exactly where it matters.
   */
  it("gives every focus outline a non-zero offset", () => {
    const blocks = [...css.matchAll(/:focus-visible\s*\{([^}]*)\}/g)].map(
      (match) => match[1] ?? "",
    );

    expect(blocks.length).toBeGreaterThan(0);

    for (const block of blocks) {
      expect(block).toMatch(/outline:\s*2px solid var\(--color-focus-ring\)/);
      expect(block).toMatch(/outline-offset:\s*[1-9]/);
    }
  });

  /** A ring drawn with `outline: none` is no ring. Nothing on this surface removes one. */
  it("removes no focus outline anywhere", () => {
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  /**
   * No colour, size, radius, duration or spacing literal — every value resolves to a token, which
   * is what lets the audit above read the palette and be right about this stylesheet.
   */
  it("declares no raw colour value", () => {
    const declarations = css.replaceAll(/\/\*[\s\S]*?\*\//g, " ");

    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\b(rgb|hsl|oklch)\(/);
  });
});
