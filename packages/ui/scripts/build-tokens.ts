// Token build — packages/ui/src/tokens/*.ts  ->  src/tokens/theme.generated.css
//
// Run with: pnpm --filter @sam-group/ui tokens:build
//
// Direction is one-way and deliberate: TypeScript is edited, CSS is generated and committed.
// The alternative (authoring in CSS and parsing it back for the non-CSS consumers) turns a
// legible source into a parsed one, and maintaining both by hand duplicates every value.
//
// Every emitted value is a literal. Custom properties are NOT emitted as var() indirection,
// because a custom property whose declared value contains var() is substituted on the element
// where it is declared — :root — and the already-substituted result is what inherits. Scoped
// [data-surface] and [dir="rtl"] overrides would therefore have no effect. Literals in scoped
// blocks are what makes the override actually win.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  breakpoints,
  colorPrimitives,
  containers,
  durations,
  easings,
  editorialGrid,
  fontFamilies,
  glassBlur,
  gradients,
  mediaRatios,
  motionSwitches,
  namedSpacing,
  radii,
  revealRange,
  rtlFontFamilies,
  shadows,
  spacingBase,
  staggerStep,
  surfaceContexts,
  typeRoles,
} from "../src/tokens/index";

const HEADER = `/*
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source:    packages/ui/src/tokens/*.ts
 * Regenerate: pnpm --filter @sam-group/ui tokens:build
 *
 * Tier 1 (primitives) and the light-context tier 2 (semantics) live in @theme so Tailwind
 * generates utilities from them. Tier 3 re-maps the same semantic properties inside
 * [data-surface] blocks, which is how a selective midnight section inverts every descendant
 * without a theme provider, a colour-scheme query, or a single byte of JavaScript.
 */
`;

type Line = string;

const decl = (name: string, value: string): Line => `  ${name}: ${value};`;

function block(selector: string, lines: readonly Line[]): string {
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

function section(title: string): Line {
  return `\n  /* ${title} */`;
}

function primitiveColorLines(): Line[] {
  const lines: Line[] = [];
  for (const [rampName, ramp] of Object.entries(colorPrimitives)) {
    lines.push(section(`primitive · ${rampName}`));
    for (const [step, value] of Object.entries(ramp)) {
      lines.push(decl(`--color-${rampName}-${step}`, value));
    }
  }
  return lines;
}

function semanticColorLines(context: Readonly<Record<string, string>>): Line[] {
  return Object.entries(context).map(([token, value]) => decl(`--color-${token}`, value));
}

function typographyLines(): Line[] {
  const lines: Line[] = [section("families")];
  for (const [name, stack] of Object.entries(fontFamilies)) {
    lines.push(decl(`--font-${name}`, stack));
  }
  lines.push(section("roles"));
  for (const [name, role] of Object.entries(typeRoles)) {
    lines.push(decl(`--text-${name}`, role.fontSize));
    lines.push(decl(`--text-${name}--line-height`, role.lineHeight));
    lines.push(decl(`--text-${name}--letter-spacing`, role.letterSpacing));
    lines.push(decl(`--text-${name}--font-weight`, role.fontWeight));
  }
  return lines;
}

function layoutLines(): Line[] {
  const lines: Line[] = [section("spacing")];
  lines.push(decl("--spacing", spacingBase));
  for (const [name, value] of Object.entries(namedSpacing)) {
    lines.push(decl(`--spacing-${name}`, value));
  }
  lines.push(section("containers"));
  for (const [name, value] of Object.entries(containers)) {
    lines.push(decl(`--container-${name}`, value));
  }
  lines.push(section("breakpoints"));
  for (const [name, value] of Object.entries(breakpoints)) {
    lines.push(decl(`--breakpoint-${name}`, value));
  }
  lines.push(section("radii"));
  for (const [name, value] of Object.entries(radii)) {
    lines.push(decl(`--radius-${name}`, value));
  }
  lines.push(section("elevation"));
  for (const [name, value] of Object.entries(shadows)) {
    lines.push(decl(`--shadow-${name}`, value));
  }
  lines.push(section("glass · media"));
  lines.push(decl("--blur-glass", glassBlur));
  for (const [name, value] of Object.entries(mediaRatios)) {
    lines.push(decl(`--aspect-${name}`, value));
  }
  return lines;
}

function easingLines(): Line[] {
  const lines: Line[] = [section("easing")];
  for (const [name, value] of Object.entries(easings)) {
    lines.push(decl(`--ease-${name}`, value));
  }
  return lines;
}

/**
 * Motion timings, reveal range, grid geometry, gradients and the two global switches.
 * Plain custom properties: these are consumed by authored CSS, not by generated utilities,
 * so they live outside @theme where Tailwind cannot tree-shake them away.
 */
function rootLines(): Line[] {
  const lines: Line[] = ["  /* durations */"];
  for (const [name, value] of Object.entries(durations)) {
    lines.push(decl(`--duration-${name}`, value));
  }
  lines.push(decl("--stagger-step", staggerStep));
  lines.push(section("reveal range · see styles/motion.css"));
  lines.push(decl("--reveal-start", revealRange.start));
  lines.push(decl("--reveal-end", revealRange.end));
  lines.push(section("motion switches · see styles/base.css for the reduced-motion override"));
  lines.push(decl("--motion-scale", motionSwitches.scale.default));
  lines.push(decl("--motion-dir", motionSwitches.direction.ltr));
  lines.push(section("editorial grid · see styles/grid.css"));
  lines.push(decl("--grid-columns", String(editorialGrid.columns)));
  lines.push(decl("--grid-gutter", editorialGrid.gutter));
  lines.push(section("industrial gradients · surface treatments and hairlines only"));
  for (const [name, value] of Object.entries(gradients)) {
    lines.push(decl(`--gradient-${name}`, value));
  }
  return lines;
}

function rtlLines(): Line[] {
  const lines: Line[] = ["  /* provisional families — pending the RTL typeface decision */"];
  for (const [name, stack] of Object.entries(rtlFontFamilies)) {
    lines.push(decl(`--font-${name}`, stack));
  }
  lines.push(section("leading · Persian and Arabic need more than Latin"));
  for (const [name, role] of Object.entries(typeRoles)) {
    if (role.rtlLineHeight !== undefined) {
      lines.push(decl(`--text-${name}--line-height`, role.rtlLineHeight));
    }
  }
  lines.push(section("directional transforms flip sign"));
  lines.push(decl("--motion-dir", motionSwitches.direction.rtl));
  return lines;
}

function buildCss(): string {
  const theme = block("@theme", [
    ...primitiveColorLines(),
    section("semantic · light is the default context"),
    ...semanticColorLines(surfaceContexts.light),
    ...typographyLines(),
    ...layoutLines(),
    ...easingLines(),
  ]);

  const surfaceBlocks = Object.entries(surfaceContexts)
    .map(([name, context]) => block(`[data-surface="${name}"]`, semanticColorLines(context)))
    .join("\n");

  return [
    HEADER,
    theme,
    block(":root", rootLines()),
    `/* Tier 3 — surface contexts. Light is repeated here so a light island can be nested\n   inside a midnight section and still resolve correctly. */\n${surfaceBlocks}`,
    block('[dir="rtl"]', rtlLines()),
  ].join("\n");
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, "../src/tokens/theme.generated.css");
  writeFileSync(outPath, buildCss(), "utf8");
  process.stdout.write(`tokens: wrote ${outPath}\n`);
}

main();
