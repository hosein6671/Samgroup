import { normalizeSeo } from "./seo.normalizer";

/**
 * The normalizer is the seam SEO_ARCHITECTURE.md §0 describes: whatever Payload stores, one shape
 * comes out. These tests are written against that promise — every case asserts either that a
 * documented default holds, or that something the CMS could plausibly return does not reach the
 * wire.
 *
 * The "malformed upstream" block matters most. Payload is a database with an admin UI in front of
 * it: a field can be null because nobody filled it, an array because a `hasMany` was toggled, a
 * string where an object was expected because a migration moved something. None of that should be
 * able to produce a response `apps/web` cannot render.
 */

const MEDIA = {
  id: 2,
  alt: "A grey rectangle.",
  prefix: "cms",
  url: "/media/cms/demo.png",
  filename: "demo.png",
  mimeType: "image/png",
  filesize: 3629,
  width: 1200,
  height: 630,
  focalX: 50,
  focalY: 50,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

const EN = [{ locale: "en", slug: "demo" }];

describe("normalizeSeo — an editor who never opened the SEO tab", () => {
  it("produces the full shape with documented defaults rather than a missing object", () => {
    // The whole point of always emitting the record: `generateMetadata` reads one shape and never
    // has to test whether `seo` exists before applying the fallback chain.
    expect(normalizeSeo(undefined, "en", [])).toEqual({
      locale: "en",
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      ogTitle: null,
      ogDescription: null,
      socialImage: null,
      twitterCardType: "summary_large_image",
      twitterTitle: null,
      twitterDescription: null,
      twitterImage: null,
      robotsIndex: true,
      robotsFollow: true,
      keywords: [],
      structuredDataOverride: null,
      alternates: [],
    });
  });

  it.each([null, undefined, "", 0, [], "not an object"])(
    "treats %p as an absent group rather than throwing",
    (raw) => {
      expect(normalizeSeo(raw, "en", []).robotsIndex).toBe(true);
    },
  );

  it("defaults robots to indexable and followable, never the reverse", () => {
    // Defaulting to false on a malformed value would deindex a page silently — a failure that looks
    // like nothing at all until the traffic goes.
    const seo = normalizeSeo({ robotsIndex: "false", robotsFollow: null }, "en", []);

    expect(seo.robotsIndex).toBe(true);
    expect(seo.robotsFollow).toBe(true);
  });

  it("honours an explicit false, which is the one thing that turns indexing off", () => {
    const seo = normalizeSeo({ robotsIndex: false, robotsFollow: false }, "en", []);

    expect(seo.robotsIndex).toBe(false);
    expect(seo.robotsFollow).toBe(false);
  });
});

describe("normalizeSeo — values an editor did supply", () => {
  it("carries the text fields through, trimmed", () => {
    const seo = normalizeSeo(
      {
        metaTitle: "  Terms of Use  ",
        metaDescription: "How we sell.",
        canonicalUrl: "https://example.test/en/terms",
        ogTitle: "Terms",
        ogDescription: "OG copy.",
      },
      "en",
      EN,
    );

    expect(seo.metaTitle).toBe("Terms of Use");
    expect(seo.metaDescription).toBe("How we sell.");
    expect(seo.canonicalUrl).toBe("https://example.test/en/terms");
    expect(seo.ogTitle).toBe("Terms");
    expect(seo.ogDescription).toBe("OG copy.");
  });

  it("collapses an empty or whitespace-only value to null, so one test drives the fallback", () => {
    const seo = normalizeSeo({ metaTitle: "", metaDescription: "   " }, "en", []);

    // §2's chain is written as "if empty". A consumer forced to check both null and "" will
    // eventually check one and ship an empty <title>.
    expect(seo.metaTitle).toBeNull();
    expect(seo.metaDescription).toBeNull();
  });

  it("accepts both card types and falls back to the §2 default for anything else", () => {
    expect(normalizeSeo({ twitterCardType: "summary" }, "en", []).twitterCardType).toBe("summary");
    expect(normalizeSeo({ twitterCardType: "summary_large_image" }, "en", []).twitterCardType).toBe(
      "summary_large_image",
    );

    for (const bogus of ["player", "", null, 7, {}]) {
      expect(normalizeSeo({ twitterCardType: bogus }, "en", []).twitterCardType).toBe(
        "summary_large_image",
      );
    }
  });

  it("cleans keywords and drops empties", () => {
    expect(
      normalizeSeo({ keywords: [" base oil ", "", "  ", "SN 150"] }, "en", []).keywords,
    ).toEqual(["base oil", "SN 150"]);
  });

  it.each([null, undefined, "one,two", 5, {}])("returns [] for keywords stored as %p", (raw) => {
    expect(normalizeSeo({ keywords: raw }, "en", []).keywords).toEqual([]);
  });
});

describe("normalizeSeo — the social image", () => {
  it("reduces an expanded media document to exactly the four public facts", () => {
    const seo = normalizeSeo({ socialImage: MEDIA }, "en", EN);

    // URL for the tag, alt for §Image SEO's og:image:alt, width/height for §6's layout stability.
    expect(seo.socialImage).toEqual({
      url: "/media/cms/demo.png",
      alt: "A grey rectangle.",
      width: 1200,
      height: 630,
    });

    // Exactly those keys — a fifth would mean the allow-list had turned into a spread.
    expect(Object.keys(seo.socialImage ?? {}).sort()).toEqual(["alt", "height", "url", "width"]);
  });

  it("lets nothing else Payload expanded reach the wire", () => {
    const seo = normalizeSeo({ socialImage: MEDIA, twitterImage: MEDIA }, "en", EN);

    // Everything omitted describes how the CMS stores the object. The id in particular is a CMS
    // primary key a consumer could do nothing with except guess an admin route from it.
    const serialized = JSON.stringify(seo);

    for (const leak of [
      "filename",
      "prefix",
      "focalX",
      "focalY",
      "mimeType",
      "filesize",
      "createdAt",
      "updatedAt",
      "thumbnailURL",
    ]) {
      expect(serialized).not.toContain(leak);
    }

    // The media id, specifically: `"id"` as a key, and the value it would have carried.
    expect(seo.socialImage).not.toHaveProperty("id");
    expect(serialized).not.toContain('"id"');
  });

  it("keeps the URL origin-relative — no host, no bucket, no object-store endpoint", () => {
    const url = normalizeSeo({ socialImage: MEDIA }, "en", []).socialImage?.url ?? "";

    expect(url.startsWith("/media/")).toBe(true);
    expect(url).not.toContain("://");
    expect(url).not.toContain("sam-public");
    expect(url).not.toContain("9000");
  });

  it("yields null for an unresolved reference rather than putting a CMS id on the wire", () => {
    // What `depth: 0` returns. An id is not an image, and emitting it would leak a primary key.
    expect(normalizeSeo({ socialImage: 2 }, "en", []).socialImage).toBeNull();
    expect(normalizeSeo({ socialImage: "2" }, "en", []).socialImage).toBeNull();
    expect(normalizeSeo({ socialImage: null }, "en", []).socialImage).toBeNull();
  });

  it("yields null for a media record with no usable url, whatever else it carries", () => {
    for (const broken of [
      {},
      { url: null },
      { url: "" },
      { url: 7 },
      { url: "   ", alt: "has alt", width: 1200, height: 630 },
    ]) {
      expect(normalizeSeo({ socialImage: broken }, "en", []).socialImage).toBeNull();
    }
  });

  it("carries a usable url even when alt and dimensions are missing", () => {
    // A required field can still be absent from a malformed upstream, and an SVG has no measured
    // width. Null is the honest answer; inventing an alt string or a dimension would be worse.
    expect(
      normalizeSeo({ socialImage: { url: "/media/cms/x.svg" } }, "en", []).socialImage,
    ).toEqual({ url: "/media/cms/x.svg", alt: null, width: null, height: null });
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY, "1200", null, {}])(
    "rejects %p as a dimension rather than passing it to next/image",
    (bogus) => {
      const image = normalizeSeo(
        { socialImage: { url: "/media/cms/x.png", width: bogus, height: bogus } },
        "en",
        [],
      ).socialImage;

      expect(image?.width).toBeNull();
      expect(image?.height).toBeNull();
    },
  );

  it("falls the whole twitter image back to the social image, per §2", () => {
    const seo = normalizeSeo({ socialImage: MEDIA }, "en", []);

    // The alt falls back with the URL. A Twitter image carrying a different picture's alt text
    // would describe the wrong image.
    expect(seo.twitterImage).toEqual(seo.socialImage);
  });

  it("prefers an explicit twitter image over the social image", () => {
    const seo = normalizeSeo(
      {
        socialImage: MEDIA,
        twitterImage: { ...MEDIA, url: "/media/cms/twitter.png", alt: "A card.", width: 800 },
      },
      "en",
      [],
    );

    expect(seo.socialImage?.url).toBe("/media/cms/demo.png");
    expect(seo.twitterImage).toEqual({
      url: "/media/cms/twitter.png",
      alt: "A card.",
      width: 800,
      height: 630,
    });
  });

  it("falls back when the twitter image is present but unusable", () => {
    const seo = normalizeSeo({ socialImage: MEDIA, twitterImage: { url: "" } }, "en", []);

    expect(seo.twitterImage?.url).toBe("/media/cms/demo.png");
  });
});

describe("normalizeSeo — untrusted alt text", () => {
  /**
   * Alt text is editor-supplied and reaches an HTML *attribute* (`og:image:alt`, `<img alt>`).
   *
   * The normalizer carries it as an opaque value: it is data, not markup, so escaping belongs to
   * the renderer that knows its own context — React and Next's Metadata API both escape attribute
   * values, which is what makes a stored `"><script>` render as text. Sanitizing here would corrupt
   * legitimate copy instead, since `<` and `&` are ordinary characters in a sentence.
   */
  const HOSTILE = '"><script>alert(1)</script>';

  it("neither executes nor mangles hostile alt text — it stays a plain string", () => {
    const image = normalizeSeo({ socialImage: { ...MEDIA, alt: HOSTILE } }, "en", []).socialImage;

    expect(typeof image?.alt).toBe("string");
    expect(image?.alt).toBe(HOSTILE);
  });

  it("emits alt as a JSON string value, so it can never break out into markup on the wire", () => {
    const serialized = JSON.stringify(
      normalizeSeo({ socialImage: { ...MEDIA, alt: HOSTILE } }, "en", []),
    );

    // The quote that would close an attribute is escaped by JSON encoding; the response is data.
    expect(serialized).toContain('\\"><script>');
    expect(JSON.parse(serialized).socialImage.alt).toBe(HOSTILE);
  });

  it("trims and nulls whitespace-only alt, so no empty og:image:alt is emitted", () => {
    expect(
      normalizeSeo({ socialImage: { ...MEDIA, alt: "   " } }, "en", []).socialImage?.alt,
    ).toBeNull();
    expect(
      normalizeSeo({ socialImage: { ...MEDIA, alt: 42 } }, "en", []).socialImage?.alt,
    ).toBeNull();
  });
});

describe("normalizeSeo — structured data override", () => {
  it("passes a JSON-LD object through", () => {
    const override = { "@context": "https://schema.org", "@type": "WebPage" };

    expect(
      normalizeSeo({ structuredDataOverride: override }, "en", []).structuredDataOverride,
    ).toEqual(override);
  });

  it.each([[[]], ["a string"], [7], [true], [null]])(
    "normalizes %p to null, because JSON-LD is always an object",
    (raw) => {
      // A scalar or array is not a usable override, and passing it toward a <script> tag would make
      // a data problem into a rendering bug.
      expect(
        normalizeSeo({ structuredDataOverride: raw }, "en", []).structuredDataOverride,
      ).toBeNull();
    },
  );
});

describe("normalizeSeo — locale and alternates", () => {
  it("reports the REQUESTED locale, not the one values may have fallen back to", () => {
    // API_CONTRACT_FINAL.md §3: an Arabic request that fell back to English is still an Arabic
    // record. `meta.localeFallback` is what says the values came from elsewhere.
    expect(normalizeSeo({ metaTitle: "English copy" }, "ar", EN).locale).toBe("ar");
  });

  it("carries alternates through and does not alias the caller's array", () => {
    const alternates = [{ locale: "en", slug: "demo" }];
    const seo = normalizeSeo({}, "en", alternates);

    expect(seo.alternates).toEqual(alternates);

    alternates.push({ locale: "fa", slug: "demo" });

    // A shared array would let a later mutation change a response already handed back.
    expect(seo.alternates).toHaveLength(1);
  });
});
