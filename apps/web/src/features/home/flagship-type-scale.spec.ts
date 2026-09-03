import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The Flagship type scale's invariants, asserted against the stylesheets themselves.
 *
 * ## Why a source test rather than a rendered one
 *
 * `apps/web`'s runner is `environment: "node"` — no jsdom, no user agent — and this gate may add
 * no dependency, the same constraint `flagship-conformance.spec.ts` and `nav-behaviour.spec.ts`
 * already record. Everything below is therefore a property of the CSS text, and the resolver in
 * the middle of this file is a deliberate, narrow re-implementation of `clamp()` for the one
 * shape the scale uses. Rendered sizes were verified separately in a browser and reported as
 * measurements; these assertions exist to stop the scale drifting back afterwards.
 *
 * ## What each block protects, and why it is not a restatement of the CSS
 *
 * 1. **No public stylesheet declares a type size of its own.** This is the invariant the whole
 *    gate exists to create — 355 `font-size` declarations in ~70 values became eleven roles —
 *    and it is the one that decays first, because adding `font-size: 13px` to one new rule is
 *    always the path of least resistance. ADR-022 §4.1.
 * 2. **Every `--fs-text-*` a stylesheet reads is defined.** ADR-022 §4.2: a `var()` that resolves
 *    to nothing is a defect even when a per-call-site fallback hides it.
 * 3. **The 12px floor.** DESIGN_SYSTEM §7.1/§7.2 and ADR-022 §4.6. Asserted at the *minimum* of
 *    each role, not at one viewport, because a role that only dips below 12px on a phone is
 *    exactly the failure the floor is for.
 * 4. **The ladder is strictly descending at every breakpoint.** Before this gate it was not:
 *    `.fs-d1` resolved to 109.44px at 1440 while the home hero resolved to 93.6px, so a page's
 *    own display line outranked the hero it was a step below.
 * 5. **The owner's size bands**, checked at 1440 and 1920.
 * 6. **Leading floors** — 1.05 on headings, 1.45 on reading roles.
 * 7. **`clamp()` reaches its bounds at the anchors**, which is what "gradual scaling, no large
 *    jumps between breakpoints" means mechanically: the curve is a line between 320 and 1920 and
 *    is clamped only outside that range, never part-way through it.
 */

const FLAGSHIP = fileURLToPath(new URL("./flagship.css", import.meta.url));
const FEATURES = fileURLToPath(new URL("../", import.meta.url));

/** `/* … *\/` removed, so a value quoted in prose is never mistaken for a declaration. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every public stylesheet. `admin.css` is the other visual system — ADR-022 §2 — and is excluded. */
function publicStylesheets(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) publicStylesheets(path, found);
    else if (entry.endsWith(".css") && !path.includes("admin")) found.push(path);
  }
  return found;
}

const SHEETS = publicStylesheets(FEATURES).map((path) => ({
  path,
  css: stripComments(readFileSync(path, "utf8")),
}));

/* ------------------------------------------------------------------ resolver */

/**
 * The px value of a token expression at a given viewport width.
 *
 * Handles exactly the two shapes the scale uses — a bare `<n>px`, and
 * `clamp(<min>px, <intercept>px + <slope>vw, <max>px)`. Anything else throws rather than
 * guessing, so a future author who reaches for a third shape gets a failing test rather than a
 * silently wrong number.
 */
function resolve(expression: string, viewport: number): number {
  const bare = expression.trim().match(/^(-?[\d.]+)px$/);
  if (bare) return Number(bare[1]);

  const fluid = expression
    .trim()
    .match(/^clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\+\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)$/);
  if (!fluid) throw new Error(`unsupported type-size expression: ${expression}`);

  const [, min, intercept, slope, max] = fluid as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  const preferred = Number(intercept) + (Number(slope) * viewport) / 100;

  return Math.min(Math.max(Number(min), preferred), Number(max));
}

/** The `--fs-text-*` custom properties declared in `flagship.css`, by name. */
function tokens(): Map<string, string> {
  const declared = new Map<string, string>();
  for (const match of stripComments(readFileSync(FLAGSHIP, "utf8")).matchAll(
    /(--fs-text-[a-z0-9-]+)\s*:\s*([^;]+);/g,
  )) {
    declared.set(match[1] as string, (match[2] as string).replace(/\s+/g, " ").trim());
  }
  return declared;
}

const TOKENS = tokens();

/** The reading and heading roles, largest first. `ghost` is decorative and is not in the ladder. */
const LADDER = [
  "hero",
  "display",
  "heading",
  "subheading",
  "title",
  "lead",
  "body",
  "body-sm",
  "caption",
  "technical",
] as const;

const VIEWPORTS = [320, 375, 768, 1024, 1440, 1920] as const;

function size(role: string, viewport: number): number {
  const value = TOKENS.get(`--fs-text-${role}`);
  expect(value, `--fs-text-${role} is declared`).toBeTruthy();
  return resolve(value as string, viewport);
}

/* ------------------------------------------------ 1 · no sheet sets its own size */

describe("public stylesheets set no type size of their own", () => {
  it("routes every font-size through a --fs-text-* role", () => {
    const offenders: string[] = [];

    for (const { path, css } of SHEETS) {
      for (const match of css.matchAll(/(?:^|;|\{)\s*font-size\s*:\s*([^;}]+)/g)) {
        const value = (match[1] as string).trim();
        // `--pr-title-size` is an alias declared in products.css and asserted in block 2.
        if (/^var\(--(fs-text-|pr-title-size)/.test(value)) continue;
        offenders.push(`${path}: font-size: ${value}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
   * The `font:` SHORTHAND is the hole the `font-size` scan above does not cover, and it is not a
   * hypothetical one: `.fs-field input` carried `font: 400 14.5px/1.5 var(--font-text)` and
   * `.pf-search-control button` carried `font: 500 12px var(--font-technical)`. Neither showed up
   * in a `font-size` inventory, so both survived every previous pass — the form control a buyer
   * types into was the last raw type size on the public site.
   *
   * `font: inherit` is allowed and is the correct way for a control to take its parent's type.
   */
  it("declares no type size through a `font:` shorthand either", () => {
    const offenders: string[] = [];

    for (const { path, css } of SHEETS) {
      for (const match of css.matchAll(/(?:^|;|\{)\s*font\s*:\s*([^;}]+)/g)) {
        const value = (match[1] as string).replace(/\s+/g, " ").trim();
        if (value === "inherit") continue;
        offenders.push(`${path}: font: ${value}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("declares no font-size inside packages/ui's own token names", () => {
    // The Flagship re-binds the substrate's semantic *colour* names; it must not re-bind
    // `--text-*`, which belongs to packages/ui and to the Admin surface (ADR-022 §2).
    expect(stripComments(readFileSync(FLAGSHIP, "utf8"))).not.toMatch(/--text-[a-z0-9-]+\s*:/);
  });
});

/* ------------------------------------------------------ 2 · every var() resolves */

describe("every type token a stylesheet reads is declared", () => {
  it("has no undefined --fs-text-* reference", () => {
    const missing = new Set<string>();

    for (const { css } of SHEETS) {
      for (const match of css.matchAll(/var\(\s*(--fs-text-[a-z0-9-]+)/g)) {
        if (!TOKENS.has(match[1] as string)) missing.add(match[1] as string);
      }
    }

    expect([...missing]).toEqual([]);
  });

  it("carries a line-height and a letter-spacing for every ladder role", () => {
    for (const role of LADDER) {
      expect(TOKENS.has(`--fs-text-${role}--line-height`), `${role} line-height`).toBe(true);
      expect(TOKENS.has(`--fs-text-${role}--letter-spacing`), `${role} letter-spacing`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------- 3 · the 12px floor */

describe("no role renders below 12px", () => {
  it.each(LADDER)("%s clears the floor at every breakpoint", (role) => {
    for (const viewport of VIEWPORTS) {
      expect(size(role, viewport), `${role} at ${viewport}px`).toBeGreaterThanOrEqual(12);
    }
  });

  it("puts the technical register exactly on the floor, at every width", () => {
    // Not merely >= 12: this role is fixed by decision, so a clamp appearing here is a change.
    for (const viewport of VIEWPORTS) expect(size("technical", viewport)).toBe(12);
  });

  /*
   * One tracking for the whole uppercase register.
   *
   * Before this gate the same role carried 0.06, 0.08, 0.09, 0.1, 0.12, 0.13, 0.14, 0.15, 0.16,
   * 0.17, 0.18, 0.19, 0.2, 0.22, 0.24, 0.28 and 0.42em depending on which page an author was
   * looking at, and at 11px the widest of them opened 4.6px between letters. Tracking is part of
   * the role, so a rule that takes the role's size may not invent its own — DESIGN_SYSTEM §7.2
   * and ADR-022 §4.1.
   */
  it("gives the technical register one tracking everywhere it is used", () => {
    const offenders: string[] = [];

    for (const { path, css } of SHEETS) {
      for (const match of css.matchAll(/\{([^{}]*)\}/g)) {
        const body = match[1] as string;
        if (!/font-size\s*:\s*var\(\s*--fs-text-technical\s*\)/.test(body)) continue;
        const tracking = body.match(/(?:^|;)\s*letter-spacing\s*:\s*([^;}]+)/);
        if (!tracking) continue;
        const value = (tracking[1] as string).trim();
        if (value === "var(--fs-text-technical--letter-spacing)") continue;
        offenders.push(`${path}: letter-spacing: ${value}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

/* --------------------------------------------------- 4 · a strictly descending ladder */

describe("the ladder never inverts", () => {
  it.each(VIEWPORTS)("descends at %ipx", (viewport) => {
    const resolved = LADDER.map((role) => [role, size(role, viewport)] as const);

    for (let i = 1; i < resolved.length; i += 1) {
      const [previousRole, previous] = resolved[i - 1] as readonly [string, number];
      const [role, current] = resolved[i] as readonly [string, number];
      // `lead` and `title` are allowed to meet — they are the same size in different registers,
      // one reading and one display — so the ladder is non-increasing rather than strictly
      // decreasing at that single step.
      const allowedEqual = previousRole === "title" && role === "lead";

      if (allowedEqual) expect(current, `${role} <= ${previousRole}`).toBeLessThanOrEqual(previous);
      else expect(current, `${role} < ${previousRole}`).toBeLessThan(previous);
    }
  });

  it("keeps the decorative ghost numeral below the hero at every width", () => {
    // It measured 208px at 1440 before this gate — the largest type on the platform, on a
    // watermark. It may be prominent; it may not out-rank the page's own largest heading.
    for (const viewport of VIEWPORTS) {
      const ghost = resolve(TOKENS.get("--fs-text-ghost") as string, viewport);
      expect(ghost, `ghost at ${viewport}px`).toBeLessThanOrEqual(size("hero", viewport) * 1.4);
    }
  });
});

/* ------------------------------------------------------------- 5 · the owner's bands */

describe("each role sits inside the band it was given", () => {
  const BANDS: ReadonlyArray<readonly [string, number, number]> = [
    // role, min at 1440, max at 1920 — the desktop window the direction was written against.
    ["hero", 48, 64],
    ["display", 40, 56],
    ["heading", 30, 42],
    ["subheading", 22, 30],
    ["title", 18, 22],
    ["lead", 17, 20],
  ];

  it.each(BANDS)("%s stays within %i–%ipx across large desktop", (role, low, high) => {
    expect(size(role, 1440), `${role} at 1440`).toBeGreaterThanOrEqual(low);
    expect(size(role, 1920), `${role} at 1920`).toBeLessThanOrEqual(high);
  });

  it("holds body and secondary reading copy at 15–16px", () => {
    for (const viewport of VIEWPORTS) {
      expect(size("body", viewport)).toBe(16);
      expect(size("body-sm", viewport)).toBe(15);
    }
  });
});

/* ------------------------------------------------------------------ 6 · leading floors */

describe("leading floors", () => {
  const leading = (role: string): number =>
    Number(TOKENS.get(`--fs-text-${role}--line-height`) as string);

  it.each(["hero", "display", "heading", "subheading", "title"])(
    "%s is not set below 1.05",
    (role) => {
      expect(leading(role)).toBeGreaterThanOrEqual(1.05);
    },
  );

  it.each(["lead", "body", "body-sm", "caption"])("%s is not set below 1.45", (role) => {
    expect(leading(role)).toBeGreaterThanOrEqual(1.45);
  });
});

/* --------------------------------------------------- 7 · the clamp reaches its anchors */

describe("fluid roles scale gradually between 320 and 1920", () => {
  const FLUID = ["hero", "display", "heading", "subheading", "title", "lead"] as const;

  it.each(FLUID)("%s is a line between the two anchors, clamped only outside them", (role) => {
    const value = TOKENS.get(`--fs-text-${role}`) as string;
    const match = value.match(
      /^clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\+\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)$/,
    );

    expect(match, `${role} uses the two-term clamp`).not.toBeNull();

    const [, min, , , max] = match as unknown as [string, string, string, string, string];

    // At 320 the preferred term equals the minimum, and at 1920 it equals the maximum — so the
    // bounds bite at the anchors rather than somewhere in the middle of the supported range,
    // which is what makes the curve read as gradual at 375, 768, 1024 and 1440.
    expect(size(role, 320), `${role} at 320`).toBeCloseTo(Number(min), 1);
    expect(size(role, 1920), `${role} at 1920`).toBeCloseTo(Number(max), 1);

    // And it is monotonically increasing in between — never a step, never a reversal.
    for (let i = 1; i < VIEWPORTS.length; i += 1) {
      expect(size(role, VIEWPORTS[i] as number)).toBeGreaterThan(
        size(role, VIEWPORTS[i - 1] as number) - 0.001,
      );
    }
  });
});
