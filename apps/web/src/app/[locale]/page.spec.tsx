import { describe, expect, it } from "vitest";

import { generateMetadata, HOME_SEO } from "./page";

describe("homepage SEO metadata", () => {
  it("publishes the approved English title and description", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(metadata.title).toBe(HOME_SEO.title);
    expect(metadata.description).toBe(HOME_SEO.description);
  });

  it("keeps the canonical on the current locale and does not claim unreviewed alternates", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "fa" }) });

    expect(metadata.alternates).toEqual({ canonical: "/fa" });
    expect(metadata.alternates).not.toHaveProperty("languages");
  });

  it("provides consistent Open Graph and Twitter cards", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(metadata.openGraph).toMatchObject({
      title: HOME_SEO.title,
      description: HOME_SEO.description,
      url: "/en",
      siteName: "SAM Group",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: HOME_SEO.title,
      description: HOME_SEO.description,
    });
  });
});
