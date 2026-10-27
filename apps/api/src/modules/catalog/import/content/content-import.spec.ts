import {
  applyAuthorizationErrors,
  applyPlan,
  IMPORT_ENABLE_ENV,
  parseArgs,
  planImport,
  validateContentFile,
} from "./content-import";

import type {
  EditableSeoShape,
  ImportArgs,
  ImportDatabase,
  ImportEntry,
  ProductState,
} from "./content-import";

const seo = {
  metaTitle: "CK-4 10W-40 | SAM Group",
  metaDescription: "Diesel engine oil.",
  robotsIndex: true,
  robotsFollow: true,
  keywords: ["CK-4"],
};
const block = (
  description: string,
  translationStatus = "machine_draft",
): Record<string, unknown> => ({
  description,
  applications: [{ title: "Engines", description: "Diesel engines." }],
  features: [],
  faq: [{ question: "Which API category?", answer: "CK-4." }],
  seo,
  translationStatus,
});
const file = (
  locales: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  schemaVersion: 1,
  products: [
    {
      slug: "ck-4-10w-40",
      sourceRef: "SAMCAT-W1-R003",
      name: "CK-4 10W-40",
      locales,
      ...overrides,
    },
  ],
});
const emptySeo: EditableSeoShape = {
  metaTitle: "",
  metaDescription: "",
  ogTitle: "",
  ogDescription: "",
  twitterTitle: "",
  twitterDescription: "",
  twitterCardType: "summary_large_image",
  robotsIndex: true,
  robotsFollow: true,
  keywords: [],
};

function database(product: ProductState | null): ImportDatabase {
  return {
    currentDatabase: async () => "sam_platform",
    locales: async () => ({ codes: ["en", "fa"], defaultCode: "en" }),
    readProduct: async () => product,
  };
}
function state(overrides: Partial<ProductState> = {}): ProductState {
  return {
    id: "p1",
    name: "CK-4 10W-40",
    sourceRef: "SAMCAT-W1-R003",
    locales: new Map([
      ["en", { revision: 0, publishedSections: null, description: "Base.", seo: emptySeo }],
      [
        "fa",
        {
          revision: 0,
          publishedSections: null,
          description: "",
          seo: emptySeo,
          translationStatus: "machine_draft" as const,
        },
      ],
    ]),
    ...overrides,
  };
}

describe("content import arguments", () => {
  it("requires --file and rejects unknown flags", () => {
    expect(parseArgs([])).toEqual({ error: "--file is required." });
    expect(parseArgs(["--file", "x.json", "--force"])).toEqual({
      error: "Unknown argument: --force",
    });
  });
  it("collects repeated --replace and --locale values", () => {
    const args = parseArgs(["--file", "x", "--replace", "a", "--replace", "b", "--locale", "fa"]);
    expect("error" in args).toBe(false);
    const parsed = args as ImportArgs;
    expect([...parsed.replace]).toEqual(["a", "b"]);
    expect([...(parsed.locales ?? [])]).toEqual(["fa"]);
  });
  it("authorizes an apply only with every guard satisfied", () => {
    const hash = "a".repeat(64);
    const args = parseArgs([
      "--file",
      "x",
      "--apply",
      "--confirm-target",
      "sam_platform",
      "--expect-sha256",
      hash,
      "--operator",
      "ops",
    ]) as ImportArgs;
    expect(
      applyAuthorizationErrors(args, { [IMPORT_ENABLE_ENV]: "true" }, hash, "sam_platform"),
    ).toEqual([]);
    expect(applyAuthorizationErrors(args, {}, hash, "sam_platform")).toHaveLength(1);
    expect(
      applyAuthorizationErrors(
        args,
        { [IMPORT_ENABLE_ENV]: "true" },
        "b".repeat(64),
        "sam_platform",
      ),
    ).toHaveLength(1);
    expect(
      applyAuthorizationErrors(args, { [IMPORT_ENABLE_ENV]: "true" }, hash, "sam_cms"),
    ).toHaveLength(1);
    expect(applyAuthorizationErrors({ ...args, apply: false }, {}, "", "")).toEqual([]);
  });
});

describe("content file validation", () => {
  it("accepts a well-formed file", async () => {
    const result = await validateContentFile(file({ en: block("English."), fa: block("فارسی.") }));
    expect(result.errors).toEqual([]);
    expect(result.entries[0]?.locales.size).toBe(2);
  });
  it("refuses placeholders, unknown fields, bad statuses and over-long text", async () => {
    for (const bad of [
      file({ en: block("Viscosity [TO CONFIRM].") }),
      file({ en: { ...block("x"), specifications: [] } }),
      file({ en: block("x", "approved") }),
      file({ en: block("x".repeat(10001)) }),
      file({ en: block("x") }, { name: " " }),
      { schemaVersion: 2, products: [] },
    ])
      expect((await validateContentFile(bad)).errors.length).toBeGreaterThan(0);
  });
});

describe("content import plan", () => {
  const entries = async (locales: Record<string, unknown>): Promise<ImportEntry[]> =>
    (await validateContentFile(file(locales))).entries;

  it("plans a first publication in each locale", async () => {
    const items = await planImport(
      await entries({ en: block("English."), fa: block("فارسی.") }),
      database(state()),
      { replace: new Set() },
    );
    expect(items.map((item) => item.action)).toEqual(["create", "create"]);
    expect(items[0]?.edit?.content.name).toBe("CK-4 10W-40");
    expect(items[1]?.edit?.translationStatus).toBe("machine_draft");
  });

  it("is a no-op when the published content is identical", async () => {
    const sections = {
      applications: [{ title: "Engines", description: "Diesel engines." }],
      features: [],
      faq: [{ question: "Which API category?", answer: "CK-4." }],
    };
    const published = state({
      locales: new Map([
        [
          "fa",
          {
            revision: 1,
            publishedSections: sections,
            description: "فارسی.",
            seo: { ...emptySeo, ...seo },
            translationStatus: "machine_draft" as const,
          },
        ],
      ]),
    });
    const items = await planImport(await entries({ fa: block("فارسی.") }), database(published), {
      replace: new Set(),
    });
    expect(items.map((item) => item.action)).toEqual(["noop"]);
  });

  it("refuses to overwrite differing published content unless that slug is named", async () => {
    const published = state({
      locales: new Map([
        [
          "fa",
          {
            revision: 2,
            publishedSections: { applications: [], features: [], faq: [] },
            description: "ویرایش شده",
            seo: emptySeo,
            translationStatus: "human_reviewed" as const,
          },
        ],
      ]),
    });
    const input = await entries({ fa: block("فارسی.") });
    expect((await planImport(input, database(published), { replace: new Set() }))[0]?.action).toBe(
      "refused",
    );
    const replaced = await planImport(input, database(published), {
      replace: new Set(["ck-4-10w-40"]),
    });
    expect(replaced[0]?.action).toBe("replace");
    expect(replaced[0]?.edit?.revision).toBe(2);
  });

  it("refuses a product whose identity does not match", async () => {
    const input = await entries({ en: block("English.") });
    for (const product of [null, state({ sourceRef: "OTHER" }), state({ name: "SN Grade " })])
      expect((await planImport(input, database(product), { replace: new Set() }))[0]?.action).toBe(
        "error",
      );
  });

  it("writes nothing when any item is refused or in error", async () => {
    const publish = jest.fn();
    expect(
      await applyPlan(
        [
          { slug: "a", locale: "en", action: "create", productId: "p", edit: {} as never },
          { slug: "b", locale: "en", action: "refused" },
        ],
        publish,
      ),
    ).toEqual({ written: 0, blocked: true });
    expect(publish).not.toHaveBeenCalled();
  });
});
