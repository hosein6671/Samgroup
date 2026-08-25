/**
 * What `GET /products/:slug` is allowed to publish, proved against PostgreSQL.
 *
 * ── Why this cannot be a mocked test ────────────────────────────────────────
 *
 * `products.service.spec.ts` proves the SHAPE of the query object handed to Prisma. That is
 * worth having, and it is not the same claim: a mock cannot tell you whether
 * `{ reviewStatus: "APPROVED", deletedAt: null }` actually excludes a `NEEDS_REVIEW` row, only
 * that the object was passed. These tests write real rows at every review status and ask the
 * real service what comes back.
 *
 * ── Why it matters now ──────────────────────────────────────────────────────
 *
 * When this endpoint shipped, every `specifications` row was hand-seeded demo data and
 * "return them all" happened to equal "return the approved ones". The catalog import writes
 * 1,398 rows, none of them approved. Without the predicate the first successful import
 * publishes the entire unreviewed technical catalogue through a route nobody changed — so
 * the filter is a security control, and this file is what keeps it one.
 *
 * ── Nothing here approves anything ──────────────────────────────────────────
 *
 * The APPROVED rows below are written BY THE TEST, on its own throwaway product, on a
 * disposable database it created. No imported row is touched, and no fixture approves catalog
 * content to make an assertion pass.
 */

import { randomUUID } from "node:crypto";

import { ContentTranslationService } from "../../common/content/content-translation.service";
import { PrismaService } from "../../prisma/prisma.service";
import { MediaService } from "../media/media.service";
import { SeoService } from "../seo/seo.service";

import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readDatabaseConfig,
  withDisposableClient,
} from "./import/apply/__tests__/disposable-database";
import { ProductsService } from "./products.service";

import type { ResolvedLocale } from "../../common/locale/resolved-locale";
import type { DatabaseConfig } from "./import/apply/__tests__/disposable-database";
import type { ConfigService } from "@nestjs/config";

const config = readDatabaseConfig();
const suite = config === null ? describe.skip : describe;
const TIMEOUT_MS = 120_000;

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

/**
 * The probe product's slug. Outside the ratified namespace and outside `sam-demo-`, so it can
 * never be mistaken for a demo row by the import guard or for an imported row by anything else.
 */
const PROBE_SLUG = "zz-public-spec-probe";

/**
 * The probe reviewer. Needed only because migration 20260825120000 makes an approval require a
 * `TechnicalReview`, and that row carries a real foreign key to `users`.
 */
const REVIEWER_ID = "bbbb2222-0000-4000-8000-00000000beef";

/** One Specification per review status, plus the two cases status alone does not cover. */
interface ProbeSpec {
  readonly key: string;
  readonly status: string;
  readonly deleted: boolean;
  readonly grade: boolean;
  /** Whether a public response is allowed to contain it. */
  readonly public: boolean;
}

const PROBE_SPECS: readonly ProbeSpec[] = [
  { key: "probe_public_product", status: "approved", deleted: false, grade: false, public: true },
  { key: "probe_public_grade", status: "approved", deleted: false, grade: true, public: true },
  {
    key: "probe_source_recorded",
    status: "source_recorded",
    deleted: false,
    grade: false,
    public: false,
  },
  {
    key: "probe_needs_review",
    status: "needs_review",
    deleted: false,
    grade: false,
    public: false,
  },
  { key: "probe_rejected", status: "rejected", deleted: false, grade: false, public: false },
  { key: "probe_superseded", status: "superseded", deleted: false, grade: false, public: false },
  // Approved once, retired since. Status alone would publish it; `deletedAt` is why it stays out.
  { key: "probe_retired_row", status: "approved", deleted: true, grade: false, public: false },
];

suite("public Specification exposure", () => {
  let url = "";
  let prisma: PrismaService;
  let products: ProductsService;
  /**
   * How many Products the CLONED template already held, read rather than assumed.
   *
   * It was `10` when this suite was written and the template was a demo database; it is `100`
   * against the imported catalogue, and it would be `0` against a freshly migrated one. An absolute
   * expectation here is a statement about the whole catalogue, and this suite only ever makes a
   * statement about its OWN probe row — the same correction ADR-015 §19 made to the verification
   * script for exactly the same reason.
   */
  let productsBeforeProbe = 0;

  beforeAll(async () => {
    url = await createDisposableDatabase(
      config as DatabaseConfig,
      `specsec_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
    );

    await withDisposableClient(url, async (client) => {
      const productId = randomUUID();
      const gradeId = randomUUID();
      // Ids are generated here rather than by the database, because the approval
      // path below has to name each subject in its TechnicalReview.
      const specIdByKey = new Map<string, string>();

      const baseline = await client.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM products`,
      );
      productsBeforeProbe = Number(baseline[0]?.n ?? 0);

      await client.$executeRawUnsafe(
        `INSERT INTO products (id, name, slug, category_id)
         SELECT $1::uuid, 'ZZ Public Spec Probe', $2, id FROM categories ORDER BY slug LIMIT 1`,
        productId,
        PROBE_SLUG,
      );
      await client.$executeRawUnsafe(
        `INSERT INTO product_grades (id, product_id, label, sort_order)
         VALUES ($1::uuid, $2::uuid, 'PROBE GRADE', 0)`,
        gradeId,
        productId,
      );

      for (const spec of PROBE_SPECS) {
        // Each probe needs its OWN dictionary key. `specifications_import_identity_key` is
        // unique on (product_id, product_grade_id, property_key) with NULLS NOT DISTINCT, so
        // seven rows on one product sharing a NULL property key are seven collisions — the
        // constraint doing exactly its job, which is why the fixture works with it.
        await client.$executeRawUnsafe(
          `INSERT INTO spec_properties (key, canonical_meaning, quantity, value_kind,
                                        method_requirement)
           VALUES ($1, 'Verification probe property.', 'probe',
                   'textual'::spec_value_kind, 'not_applicable'::method_requirement)`,
          spec.key,
        );
        /*
         * ── Born unapproved, always ──────────────────────────────────────────
         *
         * Migration 20260825120000 refuses an INSERT that arrives already
         * approved, and refuses a bare UPDATE into `approved` (ADR-016). This
         * fixture used to write `review_status` directly, which is precisely the
         * write the database no longer permits anyone to make.
         *
         * So every probe is inserted unapproved. The ones that need to BE
         * approved are approved below through the legitimate path, and the ones
         * that need a NON-approved status are moved there afterwards — leaving
         * `approved` is deliberately ungated, so that still works.
         *
         * **No assertion in this file changed.** The seven probes still cover the
         * same seven states; only the way they reach them did.
         */
        const specId = randomUUID();
        specIdByKey.set(spec.key, specId);

        // The legacy triple is what the public DTO serves, so that is what is asserted on.
        await client.$executeRawUnsafe(
          `INSERT INTO specifications
             (id, product_id, product_grade_id, property_key, key, value, unit)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'cSt')`,
          specId,
          productId,
          spec.grade ? gradeId : null,
          spec.key,
          spec.key,
          `value-of-${spec.key}`,
        );
      }

      // A reviewer, because `technical_reviews.reviewer_id` is a real foreign key.
      await client.$executeRawUnsafe(
        `INSERT INTO users (id, email, password_hash, role)
         VALUES ($1::uuid, 'spec-sec-probe@samgp.test', 'not-a-credential', 'admin')`,
        REVIEWER_ID,
      );

      for (const spec of PROBE_SPECS) {
        const specId = specIdByKey.get(spec.key) as string;

        if (spec.status === "approved") {
          /*
           * The gate's exact requirement: a TechnicalReview inserted in the SAME
           * transaction as the status change, naming this subject, recording an
           * approve decision, with a non-blank reviewer snapshot and the
           * evidence-set hash the database computes for this subject right now.
           *
           * `$transaction` is what makes it the same transaction — a sequence of
           * `$executeRawUnsafe` calls is a sequence of autocommits, and the gate
           * would refuse the second one.
           */
          await client.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `INSERT INTO technical_reviews
                 (id, specification_id, reviewer_id, reviewer_email_snapshot, decision,
                  evidence_set_hash)
               VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'spec-sec-probe@samgp.test',
                       'approved', specification_evidence_set_hash($1::uuid))`,
              specId,
              REVIEWER_ID,
            );
            await tx.$executeRawUnsafe(
              `UPDATE specifications SET review_status = 'approved' WHERE id = $1::uuid`,
              specId,
            );
          });
        } else if (spec.status !== "source_recorded") {
          // Every other status is reachable by a plain UPDATE: only ENTRY into
          // `approved` is gated.
          await client.$executeRawUnsafe(
            `UPDATE specifications SET review_status = $2::technical_review_status
              WHERE id = $1::uuid`,
            specId,
            spec.status,
          );
        }

        if (spec.deleted) {
          // Retired AFTER approval, which is the real sequence and the one the
          // "approved once, retired since" probe is about.
          await client.$executeRawUnsafe(
            `UPDATE specifications SET deleted_at = now() WHERE id = $1::uuid`,
            specId,
          );
        }
      }
    });

    prisma = new PrismaService({ getOrThrow: () => url } as unknown as ConfigService);
    const translations = new ContentTranslationService(prisma);
    products = new ProductsService(
      prisma,
      translations,
      new SeoService(prisma, translations),
      new MediaService(prisma),
    );
  }, TIMEOUT_MS);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (url) await dropDisposableDatabase(config as DatabaseConfig, url);
  }, TIMEOUT_MS);

  it(
    "wrote all seven probe rows, so an empty response would mean the filter and not the fixture",
    async () => {
      const found = await withDisposableClient(url, (client) =>
        client.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM specifications WHERE key LIKE 'probe_%'`,
        ),
      );
      expect(Number(found[0]?.n)).toBe(PROBE_SPECS.length);
    },
    TIMEOUT_MS,
  );

  it(
    "returns ONLY the live APPROVED rows on the detail endpoint",
    async () => {
      const detail = await products.findBySlug(PROBE_SLUG, EN);
      const keys = detail.product.specifications.map((row) => row.key).sort();
      expect(keys).toEqual(
        PROBE_SPECS.filter((spec) => spec.public)
          .map((spec) => spec.key)
          .sort(),
      );
    },
    TIMEOUT_MS,
  );

  it.each(PROBE_SPECS.filter((spec) => !spec.public).map((spec) => [spec.key, spec] as const))(
    "excludes %s from the detail response",
    async (key) => {
      const detail = await products.findBySlug(PROBE_SLUG, EN);
      const body = JSON.stringify(detail);
      expect(detail.product.specifications.map((row) => row.key)).not.toContain(key);
      // Not merely absent from the array — absent from the response entirely, so a nested
      // copy or a stray spread cannot carry the value.
      expect(body).not.toContain(`value-of-${key}`);
    },
    TIMEOUT_MS,
  );

  it(
    "includes a Product-level approved Specification",
    async () => {
      const detail = await products.findBySlug(PROBE_SLUG, EN);
      expect(detail.product.specifications.map((row) => row.key)).toContain("probe_public_product");
    },
    TIMEOUT_MS,
  );

  it(
    "includes a Grade-level approved Specification, flattened into the existing DTO",
    async () => {
      // The shipped DTO is a flat `{id,key,value,unit}` list with no grade field. A grade-level
      // row therefore appears as an ordinary entry; the composite foreign key is what
      // guarantees the grade belongs to this Product, and it is not re-checked in code.
      const detail = await products.findBySlug(PROBE_SLUG, EN);
      expect(detail.product.specifications.map((row) => row.key)).toContain("probe_public_grade");
    },
    TIMEOUT_MS,
  );

  it(
    "applies the same filter to the partial-refresh route",
    async () => {
      const only = await products.findSpecificationsBySlug(PROBE_SLUG, EN);
      expect(only.map((row) => row.key).sort()).toEqual(
        PROBE_SPECS.filter((spec) => spec.public)
          .map((spec) => spec.key)
          .sort(),
      );
    },
    TIMEOUT_MS,
  );

  it(
    "keeps the DTO shape exactly as it shipped",
    async () => {
      const detail = await products.findBySlug(PROBE_SLUG, EN);
      for (const specification of detail.product.specifications) {
        expect(Object.keys(specification).sort()).toEqual(["id", "key", "unit", "value"]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "leaks no sourceRef, provenance, evidence or review field",
    async () => {
      const detail = await products.findBySlug(PROBE_SLUG, EN);
      const body = JSON.stringify(detail);
      for (const word of [
        "sourceRef",
        "source_ref",
        "reviewStatus",
        "review_status",
        "deletedAt",
        "deleted_at",
        "propertyKey",
        "displayValue",
        "evidence",
        "sourceFact",
        "sourceDocument",
        "locatorValue",
        "claimIdentityHash",
        "approved",
        "needs_review",
        "source_recorded",
      ]) {
        expect([word, body.includes(word)]).toEqual([word, false]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "does not let ?q= confirm an unapproved value, and still finds an approved one",
    async () => {
      // A search that can confirm a value is a way of reading it.
      const hidden = await products.findAll(EN, {
        page: 1,
        limit: 20,
        q: "value-of-probe_needs_review",
      } as never);
      expect(hidden.products).toHaveLength(0);

      const visible = await products.findAll(EN, {
        page: 1,
        limit: 20,
        q: "value-of-probe_public_product",
      } as never);
      expect(visible.products.map((row) => row.slug)).toContain(PROBE_SLUG);
    },
    TIMEOUT_MS,
  );

  it(
    "leaves the Product itself publicly discoverable, and the list unchanged",
    async () => {
      // Withholding unreviewed specifications is not the same as hiding the product. The list
      // contract is untouched: every Product the template held is still there, and the probe is
      // one more — a DELTA against the baseline, never an absolute count of the catalogue.
      const page = await products.findAll(EN, { page: 1, limit: 100 } as never);
      expect(page.products.map((row) => row.slug)).toContain(PROBE_SLUG);
      expect(page.total).toBe(productsBeforeProbe + 1);
      expect(Object.keys(page.products[0] ?? {}).sort()).toEqual([
        "categoryId",
        "createdAt",
        "description",
        "id",
        "name",
        "slug",
      ]);
    },
    TIMEOUT_MS,
  );

  it(
    "still 404s for a slug that names no Product",
    async () => {
      await expect(products.findBySlug("zz-no-such-product", EN)).rejects.toMatchObject({
        message: "Product not found.",
      });
      await expect(
        products.findSpecificationsBySlug("zz-no-such-product", EN),
      ).rejects.toMatchObject({ message: "Product not found." });
    },
    TIMEOUT_MS,
  );

  it(
    "publishes nothing through the two approved-only views for the unapproved probes",
    async () => {
      const found = await withDisposableClient(url, (client) =>
        client.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM v_specification_public s
             JOIN specifications x ON x.id = s.id
            WHERE x.key LIKE 'probe_%' AND x.review_status <> 'approved'`,
        ),
      );
      expect(Number(found[0]?.n)).toBe(0);
    },
    TIMEOUT_MS,
  );
});
