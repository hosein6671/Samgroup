/**
 * The public API, reading the imported catalogue on a disposable database.
 *
 * ── What this adds to `source-ref-boundary.spec.ts` ─────────────────────────
 *
 * That file reads the SOURCE and proves the words are absent from the selects and the response
 * types. This one runs the actual service against 100 real imported Products and proves the
 * BYTES are absent from what it returns — the difference between "no code names the column"
 * and "no response contains the value", and only the second survives a `select: *`, a spread,
 * or a raw query added later.
 *
 * ── No route and no DTO changes ─────────────────────────────────────────────
 *
 * PRODUCT-DATA-2C-B2A does not publish the technical catalogue. Nothing here asks for a new
 * field; the whole point is to run the endpoints EXACTLY as they ship and check what comes
 * back. The service is built by hand rather than through a Nest module so this file needs no
 * application config and cannot accidentally boot anything.
 */

import { randomUUID } from "node:crypto";

import { ContentTranslationService } from "../../../../common/content/content-translation.service";
import { PrismaService } from "../../../../prisma/prisma.service";
import { MediaService } from "../../../media/media.service";
import { SeoService } from "../../../seo/seo.service";
import { ProductsService } from "../../products.service";

import { runApplyOnDisposableDatabase } from "./disposable-harness";
import { buildPlanFor } from "./__tests__/build-plan";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readIntegrationConfig,
} from "./__tests__/disposable-database";

import type { ResolvedLocale } from "../../../../common/locale/resolved-locale";
import type { ConfigService } from "@nestjs/config";
import type { IntegrationConfig } from "./__tests__/disposable-database";

const config = readIntegrationConfig();
const suite = config === null ? describe.skip : describe;
const TIMEOUT_MS = 180_000;

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

/**
 * Every word that would mean the technical catalogue had leaked. Checked as SUBSTRINGS of the
 * serialized response, so a nested object, a spread or a renamed wrapper cannot hide one.
 *
 * `resultBasis`/`result_basis` is deliberately NOT in this list. It read that way when this file
 * was written, because PRODUCT-DATA-2C-B2A exposed nothing beyond the original four fields — but
 * `v_specification_public`'s own column list (migration `20260822120000_add_catalog_technical_data`)
 * has always named `result_basis` as part of the ADR-014 public allow-list, alongside `method`
 * and `qualifier`, which this file's list correctly never forbade. A later gate reads the rest of
 * that allow-list; this comment records that the removal is a correction to a stale entry, not a
 * boundary this gate is loosening.
 */
const FORBIDDEN_KEYS: readonly string[] = [
  "sourceRef",
  "source_ref",
  "reviewStatus",
  "review_status",
  "claimIdentityHash",
  "claim_identity_hash",
  "sourceFact",
  "source_fact",
  "sourceDocument",
  "source_document",
  "sourceAsset",
  "source_asset",
  "locatorValue",
  "locator_value",
  "evidence",
  "importRun",
  "import_run",
  "manifestHash",
  "manifest_hash",
  "rawValue",
  "raw_value",
  "extractionMethod",
  "extraction_method",
  "confidence",
  "propertyKey",
  "property_key",
  "SOURCE_RECORDED",
  "NEEDS_REVIEW",
  "source_recorded",
  "needs_review",
];

suite("the public Product endpoints over the imported catalogue", () => {
  let url = "";
  let prisma: PrismaService;
  let products: ProductsService;
  let sampleSlug = "";
  let sampleSourceRef = "";
  let allSlugs: readonly string[] = [];

  beforeAll(async () => {
    url = await createDisposableDatabase(
      config as IntegrationConfig,
      `api_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
    );
    const inputs = await buildPlanFor(url, (config as IntegrationConfig).workbookPath);
    await runApplyOnDisposableDatabase({
      connectionString: url,
      plan: inputs.plan,
      manifestHash: inputs.manifestHash,
      workbookSha256: inputs.workbookSha256,
      ledgerSha256: inputs.ledgerSha256,
      demoReplacementAuthorized: true,
    });

    prisma = new PrismaService({ getOrThrow: () => url } as unknown as ConfigService);
    const translations = new ContentTranslationService(prisma);
    products = new ProductsService(
      prisma,
      translations,
      new SeoService(prisma, translations),
      new MediaService(prisma),
    );

    const row = inputs.plan.products[0];
    sampleSlug = row?.proposedSlug ?? "";
    sampleSourceRef = row?.sourceRef ?? "";
    allSlugs = inputs.plan.products.map((product) => product.proposedSlug);
  }, TIMEOUT_MS);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (url) await dropDisposableDatabase(config as IntegrationConfig, url);
  }, TIMEOUT_MS);

  it(
    "lists the 100 imported Products through the unchanged endpoint",
    async () => {
      const page = await products.findAll(EN, { page: 1, limit: 100 } as never);
      expect(page.products).toHaveLength(100);
      expect(page.total).toBe(100);
    },
    TIMEOUT_MS,
  );

  it(
    "serves a Product detail for an imported slug",
    async () => {
      const detail = await products.findBySlug(sampleSlug, EN);
      expect(detail.product.slug).toBe(sampleSlug);
    },
    TIMEOUT_MS,
  );

  it(
    "leaks no ratified sourceRef in the list or the detail",
    async () => {
      const page = await products.findAll(EN, { page: 1, limit: 100 } as never);
      const detail = await products.findBySlug(sampleSlug, EN);
      const body = JSON.stringify(page) + JSON.stringify(detail);
      expect(sampleSourceRef.length).toBeGreaterThan(0);
      expect(body).not.toContain(sampleSourceRef);
      expect(body).not.toContain("SAMCAT-W1-");
    },
    TIMEOUT_MS,
  );

  it(
    "leaks no provenance, evidence, review or normalization field",
    async () => {
      const page = await products.findAll(EN, { page: 1, limit: 100 } as never);
      const detail = await products.findBySlug(sampleSlug, EN);
      const body = JSON.stringify(page) + JSON.stringify(detail);
      for (const word of FORBIDDEN_KEYS) {
        expect([word, body.includes(word)]).toEqual([word, false]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "returns the specification shape at the ADR-014 allow-list and nothing wider",
    async () => {
      const detail = await products.findBySlug(sampleSlug, EN);
      for (const specification of detail.product.specifications) {
        expect(Object.keys(specification).sort()).toEqual([
          "grade",
          "id",
          "key",
          "method",
          "numericMax",
          "numericMin",
          "pairFirst",
          "pairSecond",
          "qualifier",
          "resultBasis",
          "unit",
          "value",
          "valueType",
        ]);
      }
    },
    TIMEOUT_MS,
  );

  /**
   * The whole point of the public predicate, measured on the real catalogue.
   *
   * The import writes 1,402 Specifications and approves none of them. Every one is therefore
   * withheld, and a Product whose technical data has been imported but not reviewed answers
   * with an EMPTY array — which is the truthful answer, not a degraded one: the platform holds
   * no published specification for it yet.
   *
   * Checked across ALL 100 Products rather than a sample. One product leaking is the whole
   * leak, and a sample is exactly how that gets missed.
   */
  it(
    "exposes ZERO technical values for all 100 imported Products",
    async () => {
      const stored = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM specifications
          WHERE deleted_at IS NULL AND review_status <> 'approved'`,
      );
      // 1,402 rows are there to leak. None of them does.
      expect(Number(stored[0]?.n)).toBe(1402);

      const offenders: string[] = [];
      expect(allSlugs).toHaveLength(100);
      for (const slug of allSlugs) {
        const detail = await products.findBySlug(slug, EN);
        if (detail.product.specifications.length !== 0) offenders.push(slug);
      }
      expect(offenders).toEqual([]);
    },
    TIMEOUT_MS,
  );

  it(
    "withholds them from the partial-refresh route too",
    async () => {
      expect(await products.findSpecificationsBySlug(sampleSlug, EN)).toEqual([]);
    },
    TIMEOUT_MS,
  );

  it(
    "leaves all 100 Products publicly discoverable despite withholding their data",
    async () => {
      // Withholding unreviewed specifications is not the same as hiding the catalogue.
      const page = await products.findAll(EN, { page: 1, limit: 100 } as never);
      expect(page.products).toHaveLength(100);
      expect(page.total).toBe(100);
    },
    TIMEOUT_MS,
  );

  it(
    "does not let ?q= confirm an unapproved imported value",
    async () => {
      // A distinctive real value from the imported set. Matching it would prove the platform
      // holds a specification nobody published.
      const sample = await prisma.$queryRawUnsafe<{ value: string }[]>(
        `SELECT value FROM specifications WHERE length(value) >= 4 ORDER BY value LIMIT 1`,
      );
      const value = sample[0]?.value ?? "";
      expect(value.length).toBeGreaterThan(0);
      const page = await products.findAll(EN, { page: 1, limit: 100, q: value } as never);
      const bySpecificationOnly = page.products.filter(
        (row) => !row.name.includes(value) && !row.slug.includes(value),
      );
      expect(bySpecificationOnly).toEqual([]);
    },
    TIMEOUT_MS,
  );

  it(
    "publishes nothing through the two approved-only views",
    async () => {
      // ADR-014's public views filter on `review_status = 'approved'`, and the importer
      // approves nothing — so an import makes the catalogue readable to a reviewer and adds
      // not one row to what those views expose.
      const found = await prisma.$queryRawUnsafe<{ specs: bigint; claims: bigint }[]>(
        `SELECT (SELECT count(*) FROM v_specification_public) AS specs,
              (SELECT count(*) FROM v_product_claim_public) AS claims`,
      );
      expect(Number(found[0]?.specs)).toBe(0);
      expect(Number(found[0]?.claims)).toBe(0);
    },
    TIMEOUT_MS,
  );

  it(
    "filters by the eight imported ProductTypes without exposing anything new",
    async () => {
      const page = await products.findAll(EN, {
        page: 1,
        limit: 100,
        productType: "gear-oils",
      } as never);
      expect(page.products.length).toBeGreaterThan(0);
      const body = JSON.stringify(page);
      expect(body).not.toContain("SAMCAT-W1-");
    },
    TIMEOUT_MS,
  );
});
