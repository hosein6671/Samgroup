import { STRUCTURAL_IMAGES } from "@sam-group/types/structural-content";
import { STRUCTURAL_LISTS } from "@sam-group/types/structural-lists";
import type { BlogPostListItemResponse, StructuralFields } from "@sam-group/types";
import { describe, expect, it, vi } from "vitest";

import { structuralEditorDefaults } from "@/features/content/structural-copy";
import { renderHtml } from "@test/rendered-links";

import { CUSTOM_STEPS, FAMILIES, HERO_SPEC, HUBS, NETWORK_STATS } from "./home-data";
import { CustomFormulation } from "./sections/custom-formulation";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Industries } from "./sections/industries";
import { Insights } from "./sections/insights";
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

  it("hides the hero facts when every fact is removed, and keeps the rest of the player bar", () => {
    expect(renderHtml(<Hero locale="en" />)).toContain("fs-cine-facts");
    const html = renderHtml(<Hero locale="en" editorial={editorial({ hero_facts: [] })} />);
    expect(html).not.toContain("fs-cine-facts");
    expect(html).toContain("fs-cine-explore");
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
        who_we_are_2: photo("Who alt 2"),
        who_we_are_3: photo("Who alt 3"),
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
    expect(html).toContain('alt="Who alt 3"');
    expect(html).not.toContain("story-product-portfolio");
    expect(html).not.toContain("lab-refrigerator-compressor-oil");
    expect(html).not.toContain("journey-requirement-to-supply");
    expect(html).not.toContain("network-export-logistics");
    expect(html).not.toContain("customized-solutions-requirement-review");
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
    expect(form.images).toMatchObject({ who_we_are: null, custom_formulation: null, network: 5 });
    // Every slot the Home page declares is in the form, so a pick is never dropped on save.
    expect(Object.keys(form.images as object).sort()).toEqual(
      Object.keys(STRUCTURAL_IMAGES.home).sort(),
    );
    expect(structuralEditorDefaults("header", {}).images).toBeUndefined();
  });
});

describe("Insights: the newest article large, the next two small", () => {
  const post = (n: number, image = true): BlogPostListItemResponse =>
    ({
      id: `post-${n}`,
      title: `Article ${n}`,
      slug: `article-${n}`,
      publishedAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      category: { name: "Industry Insights", slug: "industry-insights" },
      featuredImage: image ? { url: `/media/cms/post-${n}.webp`, altText: `Photo ${n}` } : null,
    }) as BlogPostListItemResponse;

  it("sets the lead article on its photograph, with its text over the scrim and the SAM GROUP badge", () => {
    const html = renderHtml(<Insights locale="en" recentPosts={[post(1)]} />);
    // The design's layout even with one article: the free side column becomes the way to the rest.
    expect(html).toContain('class="fs-ins-side" data-posts="0"');
    expect(html).toContain('class="fs-ins-more" href="/en/insights"');
    expect(html).toContain(
      '<div class="fs-ins-overlay"><p class="fs-ins-meta"><b>Industry Insights</b>',
    );
    expect(html).toContain("Article 1");
    expect(html).toContain('href="/en/insights/article-1"');
    // The badge sits in the photograph's top corner, before the text block at the bottom.
    expect(html.match(/class="fs-photo-brand"/g)).toHaveLength(1);
    expect(html.indexOf("fs-photo-brand")).toBeLessThan(html.indexOf("fs-ins-overlay"));
  });

  it("puts the next two beside it and never more", () => {
    const html = renderHtml(
      <Insights locale="en" recentPosts={[post(1), post(2), post(3), post(4)]} />,
    );
    expect(html.match(/class="fs-ins-mini"/g)).toHaveLength(2);
    expect(html).not.toContain("fs-ins-more");
    expect(html).not.toContain("Article 4");
    // Only the lead photograph carries the badge; the small thumbnails stay plain.
    expect(html.match(/class="fs-photo-brand"/g)).toHaveLength(1);
  });

  it("keeps the text readable when an article has no photograph", () => {
    const html = renderHtml(
      <Insights locale="en" recentPosts={[post(1, false), post(2, false)]} />,
    );
    expect(html).toContain('data-image="false"');
    expect(html).toContain("Article 1");
    expect(html).not.toContain("fs-ins-thumb");
    // Two articles: one small row, and the card takes the second slot.
    expect(html).toContain('data-posts="1"');
    expect(html).toContain("fs-ins-more");
  });

  it("shows only the heading and its action when nothing is published", () => {
    const html = renderHtml(<Insights locale="en" recentPosts={[]} />);
    expect(html).not.toContain("fs-ins-grid");
    expect(html).toContain('href="/en/insights"');
  });
});

describe("the Concept 03 sections read their photographs and names from /admin", () => {
  const photo = { url: "/media/cms/picked.webp", alt: "Picked alt", width: 1600, height: 900 };

  it("plays the edited shot names and the picked shot photograph in the hero reel", () => {
    const html = renderHtml(
      <Hero
        locale="en"
        editorial={
          {
            ...editorial({ hero_shots: [{ source: "1", name: "Edited shot" }] }),
            images: { hero_shot_2: photo },
          } as unknown as StructuralFields
        }
      />,
    );
    // One shot left: the reel holds still, so no timeline is drawn, and its photograph is the pick.
    expect(html).toContain("picked.webp");
    expect(html).not.toContain("base-oils-lab-samples");
    expect(html).not.toContain("fs-cine-reel-bars");
  });

  it("shows the default four-shot reel with its names when nothing is edited", () => {
    const html = renderHtml(<Hero locale="en" />);
    expect(html.match(/class="fs-cine-shot"/g)).toHaveLength(4);
    expect(html).toContain("Base Oils");
  });

  it("uses the Who We Are and Industries photograph slots, each falling back on its own", () => {
    const fields = {
      ...editorial({}),
      images: { who_we_are_2: photo, industry_3: photo },
    } as unknown as StructuralFields;
    const who = renderHtml(<WhoWeAre locale="en" editorial={fields} />);
    expect(who).toContain("picked.webp");
    expect(who).toContain("story-product-portfolio");
    expect(who).not.toContain("lab-refrigerator-compressor-oil");
    const industries = renderHtml(<Industries editorial={fields} />);
    expect(industries).toContain("picked.webp");
    expect(industries).not.toContain("lubricant-additives-lab-samples");
    expect(industries.match(/class="fs-acc-item"/g)?.length).toBe(5);
  });
});
