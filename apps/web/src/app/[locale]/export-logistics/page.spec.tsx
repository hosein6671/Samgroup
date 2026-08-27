import { describe, expect, it } from "vitest";
import { generateMetadata } from "./page";

describe("Export & Logistics metadata", () => {
  it("uses approved SEO copy and a locale-aware canonical", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(metadata.title).toBe("Petroleum Product Export & Logistics | SAM Group");
    expect(metadata.description).toContain("quantity, packaging, destination, and Incoterm");
    expect(metadata.alternates).toEqual({ canonical: "/en/export-logistics" });
  });
  it("does not advertise unreviewed language alternates", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "fa" }) });
    expect(metadata.alternates).not.toHaveProperty("languages");
  });
});
