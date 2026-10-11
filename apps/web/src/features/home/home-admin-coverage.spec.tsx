import { STRUCTURAL_DEFAULTS, STRUCTURAL_IMAGES } from "@sam-group/types/structural-content";
import { STRUCTURAL_LISTS } from "@sam-group/types/structural-lists";
import type { StructuralFields } from "@sam-group/types";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { renderHtml } from "@test/rendered-links";

import { Advantages } from "./sections/advantages";
import { CustomFormulation } from "./sections/custom-formulation";
import { Ecosystem } from "./sections/ecosystem";
import { Hero } from "./sections/hero";
import { Industries } from "./sections/industries";
import { Insights } from "./sections/insights";
import { Network } from "./sections/network";
import { Trust } from "./sections/trust";
import { WhoWeAre } from "./sections/who-we-are";

/**
 * Every word and photograph on the home page is editable in /admin.
 *
 * Each text slot, list field and photograph slot of the Home page is replaced by a marker; any
 * visible text, alt or accessible label, or any photograph, that still renders WITHOUT the marker
 * is hardcoded and would be out of an editor's reach. The only allowed exception is the SAM GROUP
 * badge, which is the brand mark and stays code-owned on purpose. (Blog articles in Insights come
 * from the blog Admin and are covered by that module.)
 */
const M = "§";
type Row = Record<string, unknown>;
const mark = (value: Row): Row =>
  Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "source" ? v : `${M}${k}`]));

const editorial = {
  ...Object.fromEntries(
    Object.entries(STRUCTURAL_DEFAULTS.home).map(([section, fields]) => [section, mark(fields)]),
  ),
  lists: Object.fromEntries(
    Object.entries(STRUCTURAL_LISTS.home).map(([key, rows]) => [
      key,
      (rows as unknown as Row[]).map(mark),
    ]),
  ),
  images: Object.fromEntries(
    Object.keys(STRUCTURAL_IMAGES.home).map((slot) => [
      slot,
      { url: `/media/${M}${slot}.webp`, alt: `${M}alt`, width: 10, height: 10 },
    ]),
  ),
} as unknown as StructuralFields;

const SECTIONS: Record<string, ReactElement> = {
  hero: <Hero locale="en" editorial={editorial} />,
  "who we are": <WhoWeAre locale="en" editorial={editorial} />,
  trust: <Trust editorial={editorial} />,
  products: <Ecosystem locale="en" editorial={editorial} />,
  why: <Advantages editorial={editorial} />,
  industries: <Industries editorial={editorial} />,
  "customized solutions": <CustomFormulation locale="en" editorial={editorial} />,
  network: <Network editorial={editorial} />,
  insights: <Insights locale="en" editorial={editorial} recentPosts={[]} />,
};

const BRAND_MARK = "SAM GROUP";

describe("every word and photograph on the home page is editable in /admin", () => {
  it.each(Object.entries(SECTIONS))("%s", (_name, element) => {
    const html = renderHtml(element);
    const text = html
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t !== "" && !t.includes(M) && !/^[\d\s·.,/+-]*$/.test(t) && t !== BRAND_MARK);
    const attributes = [...html.matchAll(/(?:alt|aria-label)="([^"]+)"/g)]
      .map((m) => m[1]!)
      .filter((value) => !value.includes(M));
    const photographs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)]
      .map((m) => decodeURIComponent(m[1]!))
      .filter((src) => !src.includes(M) && !src.includes("sam-group-mark"));

    expect({ text, attributes, photographs }).toEqual({
      text: [],
      attributes: [],
      photographs: [],
    });
  });
});
