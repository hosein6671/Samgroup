import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The DS-2B conformance invariants, asserted against `flagship.css` itself.
 *
 * ## Why this file reads a stylesheet instead of rendering something
 *
 * `apps/web`'s runner is `environment: "node"` — no jsdom, no React Testing Library — and this
 * gate may add no dependency (the same constraint `nav-behaviour.spec.ts` records for the drawer's
 * behaviour helpers). Every subject below is a **CSS invariant**: which semantic token a rule
 * references, and which `visibility` a disclosure carries in each state. None of it exists in a
 * React tree, and none of it can be observed without a user agent resolving a cascade.
 *
 * So these are narrow source assertions, and they are narrow deliberately. Each one names a single
 * declaration in a single rule. They cannot prove a contrast ratio and do not claim to — a ratio is
 * a property of resolved colour on a resolved background, which only a browser produces. The
 * measured ratios are reported as runtime verification, separately, exactly as
 * `nav-behaviour.spec.ts` reports `inert`.
 *
 * What they *do* prove is the thing that regresses silently: that a later edit has not put a
 * hardcoded colour back where a token now belongs, and has not dropped the `visibility` half of the
 * drawer's disclosure contract. Both were the original defects.
 *
 * ## Comments are stripped before anything is asserted
 *
 * The corrected rules carry comments naming the values they replaced — `rgba(255, 255, 255, 0.16)`
 * appears in `.fs-field`'s comment. A substring search over raw CSS would therefore find the old
 * literal and report a defect that is not there, or worse, find the new token inside a comment and
 * pass while the declaration says something else. Every assertion below runs against the
 * comment-free text.
 */

const CSS = readFileSync(fileURLToPath(new URL("./flagship.css", import.meta.url)), "utf8");

/* --------------------------------------------------------------- tiny reader */

type Rule = { readonly selector: string; readonly body: string };

/** `/* … *\/` removed. CSS has no nested comments, so one non-greedy pass is exact. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** A selector list as one line, so a rule written across three lines still matches by name. */
function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

/**
 * Every style rule, with at-rule bodies flattened into the same list.
 *
 * Flattening is what lets a rule inside `@media (max-width: 900px)` be found by name without this
 * helper growing a notion of media queries — none of the invariants below is media-scoped, and a
 * duplicate selector inside a media block would show up as a second entry rather than being missed.
 */
function rules(css: string): Rule[] {
  const found: Rule[] = [];

  const walk = (source: string): void => {
    let index = 0;
    let selectorStart = 0;

    while (index < source.length) {
      const char = source[index];

      if (char === "{") {
        const selector = source.slice(selectorStart, index).trim();

        let depth = 1;
        let end = index + 1;

        while (end < source.length && depth > 0) {
          if (source[end] === "{") depth += 1;
          else if (source[end] === "}") depth -= 1;
          end += 1;
        }

        const body = source.slice(index + 1, end - 1);

        if (selector.startsWith("@")) walk(body);
        else found.push({ selector: normalizeSelector(selector), body });

        index = end;
        selectorStart = end;
      } else if (char === "}") {
        index += 1;
        selectorStart = index;
      } else {
        index += 1;
      }
    }
  };

  walk(css);

  return found;
}

const RULES = rules(stripComments(CSS));

/** The one rule with this exact selector list. Fails loudly if it moved or was duplicated. */
function rule(selector: string): Rule {
  const matches = RULES.filter((entry) => entry.selector === normalizeSelector(selector));

  expect(matches, `expected exactly one \`${selector}\` rule`).toHaveLength(1);

  return matches[0] as Rule;
}

/** The last declared value for `property` in a rule — last wins, as the cascade does. */
function declaration(selector: string, property: string): string {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:([^;}]*)`, "g");
  const values = [...rule(selector).body.matchAll(pattern)].map((match) =>
    normalizeSelector(match[1] as string),
  );

  expect(values.length, `expected \`${property}\` in \`${selector}\``).toBeGreaterThan(0);

  return values[values.length - 1] as string;
}

/* ------------------------------------------------- 1 · form control boundary */

const CONTROLS = ".fs-field input, .fs-field select, .fs-field textarea";

describe("public form controls", () => {
  it("draws its boundary from `--color-border-strong`, not a literal", () => {
    expect(declaration(CONTROLS, "border")).toBe("1px solid var(--color-border-strong)");
  });

  it("no longer carries the 1.62:1 boundary literal anywhere in its declarations", () => {
    // Whitespace-insensitive: `rgba(255,255,255,.16)` is the same colour written differently.
    expect(rule(CONTROLS).body.replace(/\s+/g, "")).not.toContain("rgba(255,255,255,0.16)");
    expect(rule(CONTROLS).body.replace(/\s+/g, "")).not.toContain("rgba(255,255,255,.16)");
  });

  /*
   * This assertion was written by DS-2B as a scope guard: that gate replaced one hardcoded
   * boundary colour with a token, and pinning the four neighbouring declarations as literals was
   * how it proved it had changed nothing else. It was never a rule that a control dimension may
   * never move.
   *
   * The Contact/Form gate moves two of them deliberately, so the assertion now pins the tokens
   * rather than the literals — which is a stronger guard than the original, because a literal
   * creeping back in place of either token now fails here.
   *
   *   min-height     50px → var(--fs-control-h-lg)   52px, the height `.fs-btn` already used; the
   *                                                  field and the button that submits it were two
   *                                                  pixels apart for no reason.
   *   border-radius  12px → var(--fs-radius-field)   the same 12px, named. The value does not move;
   *                                                  what moves is that four rules now share one
   *                                                  source instead of repeating the number.
   *
   * `padding`, `background` and `width` are still literals and still pinned, because those genuinely
   * did not change.
   */
  it("takes its height and radius from the control tokens, and changes no other dimension", () => {
    expect(declaration(CONTROLS, "min-height")).toBe("var(--fs-control-h-lg)");
    expect(declaration(CONTROLS, "border-radius")).toBe("var(--fs-radius-field)");
    expect(declaration(CONTROLS, "padding")).toBe("13px 16px");
    expect(declaration(CONTROLS, "background")).toBe("rgba(255, 255, 255, 0.05)");
    expect(declaration(CONTROLS, "width")).toBe("100%");
  });

  /*
   * The 12px floor on the form label, asserted so it cannot quietly slide back under it. This is
   * the most-read technical text on the platform — it names what a buyer is being asked to type —
   * and it sat at 9.5px until this gate. DESIGN_SYSTEM §7.1/§7.2, ADR-022 §4.6.
   */
  /*
   * The size half of this assertion is the Contact/Form gate's and is unchanged. The tracking half
   * moved: it pinned `0.14em`, one of the eleven different values the technical register carried
   * across the site, and the typography gate collapsed all of them onto the role's own 0.12em.
   */
  it("sets the form label at the 12px technical floor, at the register's tracking", () => {
    expect(declaration(".fs-field label", "font-size")).toBe("var(--fs-text-technical)");
    expect(declaration(".fs-field label", "letter-spacing")).toBe(
      "var(--fs-text-technical--letter-spacing)",
    );
  });

  it("leaves the focus and invalid treatments exactly as they were", () => {
    expect(
      declaration(
        ".fs-field input:focus, .fs-field select:focus, .fs-field textarea:focus",
        "border-color",
      ),
    ).toBe("var(--fs-gold)");
    expect(declaration('.fs-field input[aria-invalid="true"]', "border-color")).toBe("#ffb4a2");
  });
});

/* ---------------------------------------------------- 2 · footer copyright */

describe("footer legal bar", () => {
  it("takes its text colour from `--color-text-tertiary`", () => {
    expect(declaration(".fs-fbot", "color")).toBe("var(--color-text-tertiary)");
  });

  it("no longer carries the 3.46:1 literal", () => {
    expect(rule(".fs-fbot").body.replace(/\s+/g, "")).not.toContain("rgba(238,241,246,0.4)");
  });

  /*
   * DS-2B wrote this as a scope guard: it changed one colour and pinned the neighbouring
   * declarations as literals to prove it had changed nothing else. It was never a rule that the
   * legal bar's type may not move.
   *
   * The typography gate moves the two type declarations deliberately and the assertion now pins
   * the tokens, which is the stronger guard — a literal creeping back in place of either token
   * now fails here.
   *
   *   font-size       10px    → var(--fs-text-technical)          the 12px floor. This bar is
   *                                                               the copyright and legal links;
   *                                                               10px uppercase at 0.14em was
   *                                                               the smallest text on the site.
   *   letter-spacing  0.14em  → var(--fs-text-technical--…)       0.12em, one tracking for the
   *                                                               whole technical register.
   *
   * `text-transform`, `margin-top` and `padding-top` are still literals and still pinned, because
   * those genuinely did not change.
   */
  it("sets the legal bar at the technical floor and changes no spacing or layout", () => {
    expect(declaration(".fs-fbot", "font-size")).toBe("var(--fs-text-technical)");
    expect(declaration(".fs-fbot", "letter-spacing")).toBe(
      "var(--fs-text-technical--letter-spacing)",
    );
    expect(declaration(".fs-fbot", "text-transform")).toBe("uppercase");
    expect(declaration(".fs-fbot", "margin-top")).toBe("48px");
    expect(declaration(".fs-fbot", "padding-top")).toBe("22px");
  });
});

/* ------------------------------------------------------- 3 · `.fs-gpanel-idx` */

describe(".fs-gpanel-idx", () => {
  it("takes its colour from `--color-text-secondary`", () => {
    expect(declaration(".fs-gpanel-idx", "color")).toBe("var(--color-text-secondary)");
  });

  /*
   * Same story as `.fs-fbot` above — a DS-2B scope guard, re-pinned on the tokens the typography
   * gate moved it to. 10.5px at 0.2em became the technical role: 12px at 0.12em.
   */
  it("takes its type from the technical role", () => {
    expect(declaration(".fs-gpanel-idx", "font-size")).toBe("var(--fs-text-technical)");
    expect(declaration(".fs-gpanel-idx", "letter-spacing")).toBe(
      "var(--fs-text-technical--letter-spacing)",
    );
    expect(declaration(".fs-gpanel-idx", "font-family")).toBe("var(--font-technical)");
  });
});

/* ------------------------------------------------------------ 4 · `.fs-wb-num` */

describe(".fs-wb-num", () => {
  /**
   * Three of the four instances sit on `.fs-why`'s paper and measure 4.57:1 through
   * `--color-text-accent`. They are correct and the general rule that serves them is untouched —
   * changing it is how this correction would have broken the three cases that were never broken.
   */
  it("keeps the general rule on `--color-text-accent`", () => {
    expect(declaration(".fs-wb-num", "color")).toBe("var(--color-text-accent)");
  });

  /**
   * The fourth sits inside `.fs-qual`, which paints `--fs-navy` while staying in a
   * `data-surface="light"` section, so the same token resolved to the dark gold and measured
   * 3.51:1. `--fs-gold-2` is the light step this file already defines — no new value, no new
   * token, no surface change.
   */
  it("overrides only inside the navy Quality panel, with `--fs-gold-2`", () => {
    expect(declaration(".fs-qual .fs-wb-num", "color")).toBe("var(--fs-gold-2)");
  });

  it("scopes the override to `.fs-qual` and to `.fs-wb-num` alone", () => {
    const overrides = RULES.filter((entry) => entry.selector.includes(".fs-qual .fs-wb-num"));

    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.selector).toBe(".fs-qual .fs-wb-num");
    // Colour only. A second declaration here would be a visual change this gate did not ratify.
    expect(declaration(".fs-qual .fs-wb-num", "color")).toBeTruthy();
    expect(overrides[0]?.body.replace(/\s+/g, "")).toBe("color:var(--fs-gold-2);");
  });

  /**
   * No surface context may be introduced anywhere in this stylesheet to solve a contrast defect —
   * that was the explicitly rejected alternative, because it remaps every semantic colour for
   * every descendant. `data-surface` appears here only where the generated theme reads it.
   */
  it("introduces no `data-surface` selector", () => {
    expect(stripComments(CSS)).not.toContain(".fs-qual[data-surface");
    expect(stripComments(CSS)).not.toContain(".fs-qual[data-surface");

    const surfaceRules = RULES.filter(
      (entry) => entry.selector.includes("data-surface") && entry.selector.includes("fs-"),
    );

    expect(surfaceRules).toHaveLength(0);
  });
});

/* --------------------------------------------- 5 · drawer disclosure contract */

describe("mobile drawer Products accordion", () => {
  it("is `visibility: hidden` while collapsed", () => {
    expect(declaration(".fs-drawer-panel", "visibility")).toBe("hidden");
  });

  it("is `visibility: visible` while open — but only inside an open drawer", () => {
    expect(declaration(".fs-drawer[data-open] .fs-drawer-panel[data-open]", "visibility")).toBe(
      "visible",
    );
  });

  /**
   * The un-hide must never be reachable from the panel's own state alone.
   *
   * `visibility: visible` on a descendant overrides an ancestor's `hidden`, so an unscoped
   * `.fs-drawer-panel[data-open] { visibility: visible }` re-exposes all nine links *through* a
   * closed drawer once the accordion has been expanded and the drawer dismissed — measured at
   * 375x812 as 9/9 focusable with the drawer shut. Scoping is the fix; this pins it.
   */
  it("never un-hides itself outside an open drawer", () => {
    expect(rule(".fs-drawer-panel[data-open]").body).not.toContain("visibility");
  });

  it("keeps the height interpolation it already had", () => {
    expect(declaration(".fs-drawer-panel", "grid-template-rows")).toBe("0fr");
    expect(declaration(".fs-drawer-panel[data-open]", "grid-template-rows")).toBe("1fr");
  });

  /**
   * `visibility` must NOT be transitioned. Transitioning it makes "is this link focusable" a
   * function of elapsed time, and at t=0 of a `hidden → visible` transition the computed value is
   * still `hidden` — measured, not assumed. The height alone interpolates, exactly as `.fs-drawer`
   * transitions only `opacity` and lets its own `visibility` flip at once.
   */
  it("interpolates height only, so focusability is never time-dependent", () => {
    expect(declaration(".fs-drawer-panel", "transition")).toBe(
      "grid-template-rows 380ms var(--e-entrance)",
    );
    expect(declaration(".fs-drawer-panel", "transition")).not.toContain("visibility");
  });

  it("uses the same contract the desktop mega panel already proved", () => {
    expect(declaration(".fs-mega-panel", "visibility")).toBe("hidden");
    expect(declaration(".fs-mega-panel[data-open]", "visibility")).toBe("visible");
  });

  it("does not remove the links from the DOM — the panel still lays them out", () => {
    expect(declaration(".fs-drawer-panel", "display")).toBe("grid");
    expect(declaration(".fs-drawer-panel > div", "overflow")).toBe("hidden");
  });
});

/* ------------------------------------------------- 6 · no token value changed */

describe("token values", () => {
  /**
   * DS-2B may change **which** token a rule references and nothing else. These are the four
   * semantic values the corrections lean on, in both surface contexts, exactly as they stood at
   * `0e4612f`. A gate that "fixed" contrast by editing a token value would fail here.
   */
  const LIGHT = '[data-brand="flagship"], [data-brand="flagship"] [data-surface="light"]';
  const MIDNIGHT = '[data-brand="flagship"] [data-surface="midnight"]';

  it("leaves the light context untouched", () => {
    expect(declaration(LIGHT, "--color-text-secondary")).toBe("#5a667c");
    expect(declaration(LIGHT, "--color-text-tertiary")).toBe("#6b7689");
    expect(declaration(LIGHT, "--color-text-accent")).toBe("#8a6a2a");
    expect(declaration(LIGHT, "--color-border-strong")).toBe("rgba(6, 19, 70, 0.42)");
  });

  it("leaves the midnight context untouched", () => {
    expect(declaration(MIDNIGHT, "--color-text-secondary")).toBe("#a6b0c2");
    expect(declaration(MIDNIGHT, "--color-text-tertiary")).toBe("#8d99ad");
    expect(declaration(MIDNIGHT, "--color-text-accent")).toBe("var(--fs-gold-2)");
    expect(declaration(MIDNIGHT, "--color-border-strong")).toBe("rgba(255, 255, 255, 0.4)");
  });
});

/* ------------------------------------ 7 · the Admin midnight gradient stays cancelled */

describe("midnight surface treatment", () => {
  /**
   * `packages/ui/src/styles/surfaces.css` paints every `[data-surface="midnight"]` element with
   * `background-image: var(--gradient-midnight-depth)`, and the generated token holds the **Admin**
   * palette — `#1b2740 -> #0b1220 -> #070c18`, a desaturated slate that is not in the Flagship's
   * ink family at all. The Flagship remaps `--color-surface-canvas`, so the background *colour*
   * resolved correctly to `--fs-ink` and the background *image* was never remapped.
   *
   * Which sections it reached was then decided by CSS shorthand rather than by design: a rule
   * written `background: var(--fs-ink)` resets `background-image` to none, a rule that sets only
   * the colour does not. Measured on `/en` at 1440 before the fix, `#trust-indicators` and
   * `#industries` computed the slate gradient while `#top`, `#products` and `#network` computed
   * `none` — five midnight sections, two treatments, and a hard seam wherever one met the other.
   *
   * This is the only thing that has to hold for that not to come back, and it has to hold in
   * `flagship.css`: overriding the token in the Flagship's own dark context covers every current
   * midnight section and every future one, and leaves the Admin Dashboard's gradient intact.
   */
  it("neutralises --gradient-midnight-depth in the Flagship dark context", () => {
    expect(
      declaration('[data-brand="flagship"] [data-surface="midnight"]', "--gradient-midnight-depth"),
    ).toBe("none");
  });
});
