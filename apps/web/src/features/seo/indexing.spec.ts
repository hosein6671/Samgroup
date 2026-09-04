import { afterEach, describe, expect, it } from "vitest";

import { isIndexingEnabled, robotsMetadata } from "./indexing";

/**
 * The pre-launch indexing gate.
 *
 * One switch feeds both the `<meta name="robots">` on every canonical page and `/robots.txt`, which
 * is what makes the two incapable of disagreeing. The assertions below are mostly about the default
 * and about how hard it is to open by accident — the failure that matters here is not a site that
 * stays closed a day too long, it is one that opens a day too early.
 */

const ORIGINAL = process.env.SITE_SEO_INDEXING;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SITE_SEO_INDEXING;
  else process.env.SITE_SEO_INDEXING = ORIGINAL;
});

describe("the gate", () => {
  it("is closed when nothing is configured — the behaviour the layout always had", () => {
    delete process.env.SITE_SEO_INDEXING;

    expect(isIndexingEnabled()).toBe(false);
    expect(robotsMetadata()).toEqual({ index: false, follow: false });
  });

  it("opens only for the exact string `true`", () => {
    process.env.SITE_SEO_INDEXING = "true";

    expect(isIndexingEnabled()).toBe(true);
    expect(robotsMetadata()).toEqual({ index: true, follow: true });
  });

  /**
   * `1`, `yes` and `TRUE` are all plausible things to write in a `.env` while meaning "on". None of
   * them opens the site, because a near-miss must fail closed.
   */
  it.each(["1", "yes", "TRUE", "True", "on", "", "  ", "false"])("stays closed for %j", (value) => {
    process.env.SITE_SEO_INDEXING = value;

    expect(isIndexingEnabled()).toBe(false);
  });

  it("tolerates surrounding whitespace on the value that does open it", () => {
    process.env.SITE_SEO_INDEXING = "  true  ";

    expect(isIndexingEnabled()).toBe(true);
  });

  it("is read per call, so the deployed value wins over whatever was set at import", () => {
    delete process.env.SITE_SEO_INDEXING;
    expect(isIndexingEnabled()).toBe(false);

    process.env.SITE_SEO_INDEXING = "true";
    expect(isIndexingEnabled()).toBe(true);
  });
});
