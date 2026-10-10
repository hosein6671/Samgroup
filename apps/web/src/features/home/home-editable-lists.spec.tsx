import { STRUCTURAL_LISTS } from "@sam-group/types/structural-lists";
import type { StructuralFields } from "@sam-group/types";
import { describe, expect, it, vi } from "vitest";

import { structuralEditorDefaults } from "@/features/content/structural-copy";
import { renderHtml } from "@test/rendered-links";

import { CUSTOM_STEPS, FAMILIES, HERO_SPEC, HUBS, NETWORK_STATS } from "./home-data";
import { CustomFormulation } from "./sections/custom-formulation";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Network } from "./sections/network";
import { WhoWeAre } from "./sections/who-we-are";

/**
 * The Home page lists editable in /admin: `hero_facts`, `families`, `network_hubs`,
 * `network_stats`, and `input`/`output` on `custom_steps`.
 *
 * What these prove: the admin defaults are the same values the code renders without CMS content,
 * an edited row reaches the markup, rows can be reordered or removed without breaking a section,
 * and an emptied list hides its block instead of leaving a heading over nothing.
 */
type Row = Record<string, unknown>;
const LISTS = STRUCTURAL_LISTS.home as unknown as Record<string, Row[]>;
const pick = (rows: readonly unknown[], fields: readonly string[]): Row[] =>
  (rows as Row[]).map((row) => Object.fromEntries(fields.map((field) => [field, row[field]])));

/** A published Home document carrying only the lists under test. */
const editorial = (lists: Record<string, Row[]>): StructuralFields =>
  ({ lists: { ...LISTS, ...lists } }) as unknown as StructuralFields;

describe("admin defaults match what the page renders without CMS content", () => {
  it.each([
    ["families", FAMILIES, ["name", "short", "sub", "body", "supplied", "enquiry"]],
    ["hero_facts", HERO_SPEC, ["label", "value"]],
    ["network_stats", NETWORK_STATS, ["label", "value"]],
    ["network_hubs", HUBS, ["n"]],
    ["custom_steps", CUSTOM_STEPS, ["n", "title", "body", "input", "output"]],
  ] as const)("%s", (key, fixture, fields) => {
    expect(pick(LISTS[key]!, fields)).toEqual(pick(fixture, fields));
  });
});

describe("edited rows reach the markup", () => {
  it("renders an edited family name and detail rows", () => {
    const html = renderHtml(
      <Ecosystem
        locale="en"
        editorial={editorial({
          families: [{ ...LISTS.families![0], name: "Edited family", enquiry: "Edited enquiry" }],
        })}
      />,
    );
    expect(html).toContain("Edited family");
    expect(html).toContain("Edited enquiry");
  });

  it("renders edited hero facts, step facts and network stats", () => {
    const facts = renderHtml(
      <Hero
        locale="en"
        editorial={editorial({ hero_facts: [{ source: "0", label: "Edited fact", value: "7" }] })}
      />,
    );
    expect(facts).toContain("Edited fact");

    const steps = renderHtml(
      <CustomFormulation
        locale="en"
        editorial={editorial({ custom_steps: [{ ...LISTS.custom_steps![0], input: "Edited in" }] })}
      />,
    );
    expect(steps).toContain("Edited in");

    const stats = renderHtml(
      <Network
        editorial={editorial({
          network_stats: [{ source: "1", label: "Edited stat", value: "8" }],
        })}
      />,
    );
    expect(stats).toContain("Edited stat");
    expect(stats).not.toContain("Named Incoterms");
  });
});

describe("reordering, removing and emptying lists", () => {
  it("keeps each family's code-owned identity when rows are reordered", () => {
    const html = renderHtml(
      <Ecosystem
        locale="en"
        editorial={editorial({ families: [LISTS.families![5]!, LISTS.families![0]!] })}
      />,
    );
    // The first row selects by default, so the panel shows the moved family with its own route.
    expect(html.indexOf("Coolants")).toBeLessThan(html.indexOf("Base Oils"));
    expect(html).toContain("/en/products/antifreeze-coolants");
  });

  it("hides the hero facts panel when every fact is removed", () => {
    const html = renderHtml(<Hero locale="en" editorial={editorial({ hero_facts: [] })} />);
    expect(html).not.toContain("fs-hero-spec");
  });

  it("hides the stats row when every stat is removed", () => {
    const html = renderHtml(<Network editorial={editorial({ network_stats: [] })} />);
    expect(html).not.toContain("fs-globe-stats");
  });

  it("drops the products section when every family is removed", () => {
    expect(renderHtml(<Ecosystem locale="en" editorial={editorial({ families: [] })} />)).toBe("");
  });

  it("does not warn when an editor gives two rows the same label", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderHtml(
      <Hero
        locale="en"
        editorial={editorial({
          hero_facts: [
            { source: "0", label: "Same", value: "1" },
            { source: "1", label: "Same", value: "2" },
          ],
        })}
      />,
    );
    renderHtml(
      <Network
        editorial={editorial({
          network_stats: [
            { source: "0", label: "Same", value: "1" },
            { source: "1", label: "Same", value: "2" },
          ],
        })}
      />,
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("photographs chosen in /admin", () => {
  const photo = (alt: string | null): Record<string, unknown> => ({
    url: "/cms-media/picked.webp",
    alt,
    width: 1600,
    height: 900,
  });

  it("renders the picked photograph with its Media alt in all three slots", () => {
    const fields = {
      ...editorial({}),
      images: {
        who_we_are: photo("Who alt"),
        custom_formulation: photo("Custom alt"),
        network: photo("Network alt"),
      },
    } as unknown as StructuralFields;
    const html = [
      renderHtml(<WhoWeAre locale="en" editorial={fields} />),
      renderHtml(<CustomFormulation locale="en" editorial={fields} />),
      renderHtml(<Network editorial={fields} />),
    ].join("");
    expect(html).toContain("picked.webp");
    expect(html).toContain('alt="Who alt"');
    expect(html).toContain('alt="Custom alt"');
    expect(html).toContain('alt="Network alt"');
    expect(html).not.toContain("story-product-portfolio");
    expect(html).not.toContain("network-export-logistics");
    expect(html).not.toContain("journey-requirement-to-supply");
  });

  it("falls back to the layout's alt when the Media record has none", () => {
    const fields = { images: { who_we_are: photo(null) } } as unknown as StructuralFields;
    expect(renderHtml(<WhoWeAre locale="en" editorial={fields} />)).toContain(
      'alt="Industrial lubricant samples and packaging formats arranged in a clean warehouse"',
    );
  });

  it("keeps the built-in photograph when a slot is empty or missing", () => {
    const empty = { images: { who_we_are: null } } as unknown as StructuralFields;
    expect(renderHtml(<WhoWeAre locale="en" editorial={empty} />)).toContain(
      "story-product-portfolio",
    );
    expect(renderHtml(<Network />)).toContain("network-export-logistics");
  });

  it("keeps the current picks in the admin form", () => {
    const form = structuralEditorDefaults("home", { images: { network: 5 } });
    expect(form.images).toEqual({ who_we_are: null, custom_formulation: null, network: 5 });
    expect(structuralEditorDefaults("header", {}).images).toBeUndefined();
  });
});
