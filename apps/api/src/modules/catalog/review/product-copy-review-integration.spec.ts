/**
 * The third review subject, end to end against a clone of the imported catalogue (ADR-019).
 *
 * ── Why this is a separate file ─────────────────────────────────────────────
 *
 * `catalog-review-integration.spec.ts` proves the subsystem over rows the IMPORTER wrote — 1,402
 * subjects that already exist, which is what makes its assertions about counts meaningful. Product
 * copy has no importer and no rows: every fixture here is constructed by the test, so the two files
 * are answering different questions and merging them would blur which is which.
 *
 * ── What it is actually proving ─────────────────────────────────────────────
 *
 * That the widened audit table did not weaken anything. Each assertion below has a matching one in
 * the older file for one of the first two subjects, and the point of writing them again for the
 * third is that a constraint relaxed from "one of two" to "one of three" is exactly the kind of
 * change that holds for the new case and quietly stops holding for the old ones.
 *
 * ── Opt-in, on the same terms ───────────────────────────────────────────────
 *
 *     NODE_OPTIONS=--experimental-vm-modules \
 *     CATALOG_APPLY_TEST_ADMIN_URL=postgresql://<superuser>:<pw>@localhost:5432/postgres \
 *     pnpm --filter @sam-group/api exec jest src/modules/catalog/review
 */

import { randomUUID } from "node:crypto";

import { ApiException } from "../../../common/http/api.exception";
import { PrismaService } from "../../../prisma/prisma.service";

import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readDatabaseConfig,
  withDisposableClient,
} from "../import/apply/__tests__/disposable-database";
import { CatalogReviewService } from "./catalog-review.service";
import { productCopyEvidenceSetHash } from "./evidence-set-hash";
import { REVIEW_SUBJECT_TYPES } from "./review-subject";

import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { DatabaseConfig } from "../import/apply/__tests__/disposable-database";
import type { ConfigService } from "@nestjs/config";

const config = readDatabaseConfig();
const suite = config === null ? describe.skip : describe;
const TIMEOUT_MS = 180_000;

const REVIEWER_ID = "cccc2222-0000-4000-8000-00000000cafe";
const REVIEWER_EMAIL = "copy-review-probe@samgp.test";

const ACTOR: AuthenticatedUser = { id: REVIEWER_ID, email: REVIEWER_EMAIL, role: "ADMIN" };

/** A source fact whose document HAS a captured asset, and one whose document has none. */
const BOUND_FACT_SQL = `
  SELECT sf."id" FROM "source_facts" sf
    JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
    JOIN "source_assets" sa    ON sa."id" = sd."source_asset_id"
   WHERE sa."sha256" ~ '^[0-9a-f]{64}$' AND sa."byte_size" > 0
   ORDER BY sf."id" LIMIT 1`;

const UNCAPTURED_FACT_SQL = `
  SELECT sf."id" FROM "source_facts" sf
    JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
   WHERE sd."source_asset_id" IS NULL
   ORDER BY sf."id" LIMIT 1`;

async function scalar(url: string, sql: string, ...values: unknown[]): Promise<string | null> {
  return withDisposableClient(url, async (client) => {
    const rows = await client.$queryRawUnsafe<Record<string, string>[]>(sql, ...values);
    const row = rows[0];
    return row === undefined ? null : (Object.values(row)[0] ?? null);
  });
}

async function refused(run: () => Promise<unknown>): Promise<ApiException> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error("Expected the decision to be refused, and it was not.");
}

/** A locale this file owns, created inactive so no shared locale row is switched off. */
const INACTIVE_LOCALE = "zz";

suite("product copy as a review subject", () => {
  let url = "";
  let prisma: PrismaService;
  let review: CatalogReviewService;

  /*
   * A POOL of products that have NO copy of their own, not one product, and not the first N.
   *
   * Two lessons are baked into this, both learned by failing:
   *
   * 1. `product_copy` is unique on (product, locale) — the schema saying a product has one piece of
   *    copy per language rather than a pile of competing drafts. A fixture reusing a single product
   *    collides on its second `en` row.
   *
   * 2. The template is local DEV `sam_platform`, and `load-product-copy-drafts.ts` may legitimately
   *    have been run against it (ADR-019 §6 sanctions exactly that). Taking "the first 40 products"
   *    therefore collides with copy that is ALREADY there. A suite that only passes before a
   *    sanctioned script has run is a suite that will fail for the wrong reason.
   *
   * So the pool is products with no `product_copy` row at all, whatever the template's state.
   */
  let productIds: string[] = [];
  let nextProduct = 0;
  let boundFactId = "";
  let uncapturedFactId = "";

  beforeAll(async () => {
    url = await createDisposableDatabase(
      config as DatabaseConfig,
      `copyreview_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
    );

    prisma = new PrismaService({ getOrThrow: () => url } as unknown as ConfigService);
    review = new CatalogReviewService(prisma);

    await withDisposableClient(url, (client) =>
      client.$executeRawUnsafe(
        `INSERT INTO "users" ("id", "email", "password_hash", "role")
         VALUES ($1::uuid, $2, $3, 'admin')`,
        REVIEWER_ID,
        REVIEWER_EMAIL,
        "not-a-credential",
      ),
    );

    productIds = await withDisposableClient(url, async (client) => {
      const rows = await client.$queryRawUnsafe<{ id: string }[]>(
        `SELECT p."id" FROM "products" p
          WHERE NOT EXISTS (SELECT 1 FROM "product_copy" pc WHERE pc."product_id" = p."id")
          ORDER BY p."id" LIMIT 40`,
      );
      return rows.map((row) => row.id);
    });
    boundFactId = (await scalar(url, BOUND_FACT_SQL)) ?? "";
    uncapturedFactId = (await scalar(url, UNCAPTURED_FACT_SQL)) ?? "";
  }, TIMEOUT_MS);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (url) await dropDisposableDatabase(config as DatabaseConfig, url);
  }, TIMEOUT_MS);

  /**
   * The fixture check, for the same reason the older file opens with one: a clone of an empty
   * catalogue would let most of this pass by having nothing to bind evidence to.
   */
  it(
    "starts from a catalogue with products and captured sources",
    () => {
      expect(productIds.length).toBeGreaterThanOrEqual(20);
      expect(boundFactId).not.toBe("");
      expect(uncapturedFactId).not.toBe("");
    },
    TIMEOUT_MS,
  );

  it("carries exactly three subject types, and product_copy is the third", () => {
    expect([...REVIEW_SUBJECT_TYPES]).toEqual(["specification", "product_claim", "product_copy"]);
  });

  /* ---------------------------------------------------------------------- */
  /* One draft, walked from insert to approval                               */
  /* ---------------------------------------------------------------------- */

  /** Inserts a draft at `source_recorded`, on a product no other draft in this file has used. */
  async function draft(locale: string, summary: string): Promise<string> {
    const id = randomUUID();
    const product = productIds[nextProduct++];
    if (product === undefined) throw new Error("The product pool is exhausted.");

    await withDisposableClient(url, (client) =>
      client.$executeRawUnsafe(
        `INSERT INTO "product_copy" ("id", "product_id", "locale", "summary", "selection_note")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        id,
        product,
        locale,
        summary,
        "Choose this grade where the OEM asks for it.",
      ),
    );
    return id;
  }

  /**
   * The unique key, asserted rather than only worked around.
   *
   * One product has one piece of copy per language. Two competing drafts for the same product and
   * locale would make "the approved row" ambiguous, and `v_product_copy_public` would serve
   * whichever the planner reached first.
   */
  it(
    "allows one row per product and locale, and refuses a second",
    async () => {
      const product = productIds[productIds.length - 1];
      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `INSERT INTO "product_copy" ("id", "product_id", "locale", "summary")
           VALUES (gen_random_uuid(), $1::uuid, 'en', 'The first draft.')`,
          product,
        ),
      );

      // A different locale for the same product is fine — that is the whole point of the key.
      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `INSERT INTO "product_copy" ("id", "product_id", "locale", "summary")
           VALUES (gen_random_uuid(), $1::uuid, 'fa', 'پیش‌نویس نخست.')`,
          product,
        ),
      );

      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `INSERT INTO "product_copy" ("id", "product_id", "locale", "summary")
             VALUES (gen_random_uuid(), $1::uuid, 'en', 'A competing second draft.')`,
            product,
          ),
        ),
      ).rejects.toThrow(/product_copy_product_id_locale_key/u);
    },
    TIMEOUT_MS,
  );

  async function bind(copyId: string, factId: string): Promise<void> {
    await withDisposableClient(url, (client) =>
      client.$executeRawUnsafe(
        `INSERT INTO "copy_evidence" ("product_copy_id", "source_fact_id", "role")
         VALUES ($1::uuid, $2::uuid, 'primary')`,
        copyId,
        factId,
      ),
    );
  }

  /** The slug of the product one copy row belongs to — the queue's own filter vocabulary. */
  async function productSlug(copyId: string): Promise<string> {
    const slug = await scalar(
      url,
      `SELECT p."slug" FROM "product_copy" pc
         JOIN "products" p ON p."id" = pc."product_id"
        WHERE pc."id" = $1::uuid`,
      copyId,
    );
    if (slug === null) throw new Error(`No product for product_copy ${copyId}.`);
    return slug;
  }

  async function copyStatus(id: string): Promise<string | null> {
    return scalar(
      url,
      `SELECT "review_status"::text AS s FROM "product_copy" WHERE "id" = $1::uuid`,
      id,
    );
  }

  it(
    "refuses a draft with no evidence, naming both defects rather than one",
    async () => {
      const id = await draft("en", "A multigrade engine oil for mixed fleets.");
      const detail = await review.detail("product_copy", id);

      expect(detail.subjectType).toBe("product_copy");
      expect(detail.copy?.summary).toBe("A multigrade engine oil for mixed fleets.");
      expect(detail.copy?.locale).toBe("en");
      expect(detail.specification).toBeNull();
      expect(detail.claim).toBeNull();
      // Copy is written about a Product, never about one grade of it.
      expect(detail.grade).toBeNull();
      expect(detail.mappings).toEqual([]);
      expect(detail.eligibleForApproval).toBe(false);

      const codes = detail.approvalBlockers.map((blocker) => blocker.code);
      expect(codes).toContain("EVIDENCE_ABSENT");
      // Both, deliberately: binding a link to an uncaptured document would otherwise look like the
      // fix for the only reported defect, and then meet the database gate.
      expect(codes).toContain("SOURCE_ASSET_ABSENT");

      // No new vocabulary was invented for the third subject.
      expect(codes).not.toContain("PROPERTY_MAPPING_UNRESOLVED");
      expect(codes).not.toContain("REQUIRED_METHOD_ABSENT");
      expect(codes).not.toContain("CLAIM_IDENTITY_ABSENT");
    },
    TIMEOUT_MS,
  );

  it(
    "refuses an approval whose bound document was never captured",
    async () => {
      const id = await draft("en", "A hydraulic fluid for mobile equipment.");
      await bind(id, uncapturedFactId);

      const detail = await review.detail("product_copy", id);
      const codes = detail.approvalBlockers.map((blocker) => blocker.code);

      expect(codes).toContain("SOURCE_ASSET_ABSENT");
      expect(codes).not.toContain("EVIDENCE_ABSENT");

      const error = await refused(() =>
        review.decide(
          "product_copy",
          id,
          {
            decision: "approve",
            expectedReviewStatus: "source_recorded",
            expectedEvidenceSetHash: detail.evidenceSetHash,
          },
          ACTOR,
        ),
      );

      expect(error.getStatus()).toBe(409);
      expect(await copyStatus(id)).toBe("source_recorded");
    },
    TIMEOUT_MS,
  );

  it(
    "approves a draft bound to a captured source, and records one immutable review",
    async () => {
      const id = await draft("en", "A gear oil for heavily loaded industrial drives.");
      await bind(id, boundFactId);

      const detail = await review.detail("product_copy", id);
      expect(detail.approvalBlockers).toEqual([]);
      expect(detail.eligibleForApproval).toBe(true);
      expect(detail.evidence).toHaveLength(1);
      // The evidence projection is the SAME shape the other two subjects serve.
      expect(detail.evidence[0]?.document.assetSha256).toMatch(/^[0-9a-f]{64}$/);

      const result = await review.decide(
        "product_copy",
        id,
        {
          decision: "approve",
          expectedReviewStatus: "source_recorded",
          expectedEvidenceSetHash: detail.evidenceSetHash,
        },
        ACTOR,
      );

      expect(result.reviewStatus).toBe("approved");
      expect(result.reviewerEmail).toBe(REVIEWER_EMAIL);
      expect(await copyStatus(id)).toBe("approved");

      // The audit row names the third subject and carries the third hash version.
      const version = await scalar(
        url,
        `SELECT "evidence_hash_version" FROM "technical_reviews" WHERE "product_copy_id" = $1::uuid`,
        id,
      );
      expect(version).toBe("copy-review-v2");

      // And the hash stored is the one the DATABASE computes, not one the client supplied.
      const stored = await scalar(
        url,
        `SELECT "evidence_set_hash" FROM "technical_reviews" WHERE "product_copy_id" = $1::uuid`,
        id,
      );
      const computed = await withDisposableClient(url, (client) =>
        productCopyEvidenceSetHash(client, id),
      );
      expect(stored).toBe(computed);
    },
    TIMEOUT_MS,
  );

  it(
    "publishes an approved row through the sanctioned view and nothing before it",
    async () => {
      const id = await draft("en", "A turbine oil for steam and gas turbines.");
      await bind(id, boundFactId);

      const beforeApproval = await scalar(
        url,
        `SELECT count(*)::text FROM "v_product_copy_public" WHERE "id" = $1::uuid`,
        id,
      );
      expect(beforeApproval).toBe("0");

      const detail = await review.detail("product_copy", id);
      await review.decide(
        "product_copy",
        id,
        {
          decision: "approve",
          expectedReviewStatus: "source_recorded",
          expectedEvidenceSetHash: detail.evidenceSetHash,
        },
        ACTOR,
      );

      const afterApproval = await scalar(
        url,
        `SELECT count(*)::text FROM "v_product_copy_public" WHERE "id" = $1::uuid`,
        id,
      );
      expect(afterApproval).toBe("1");
    },
    TIMEOUT_MS,
  );

  /**
   * An inactive locale is a visible fact, not an approval blocker.
   *
   * Ratified 1 September 2026: copy for an inactive locale may be reviewed and approved, stays out
   * of the public read model while that locale is inactive, and becomes public under the view's
   * existing rule if the locale is reactivated — no second decision.
   *
   * This is the case the public-transition check used to abort on. It asserts the decision
   * SUCCEEDS and the row is absent from the view, which is the pair that distinguishes "correctly
   * withheld" from "failed to publish".
   */
  it(
    "approves copy in an inactive locale, and the view withholds it without failing the decision",
    async () => {
      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `INSERT INTO "locales"
             ("id", "code", "name", "native_name", "direction", "is_active", "sort_order")
           VALUES (gen_random_uuid(), $1, 'Retired', 'Retired', 'ltr', false, 900)
           ON CONFLICT ("code") DO UPDATE SET "is_active" = false`,
          INACTIVE_LOCALE,
        ),
      );

      const id = await draft(INACTIVE_LOCALE, "A gear oil for enclosed industrial gearboxes.");
      await bind(id, boundFactId);

      const detail = await review.detail("product_copy", id);

      // Reported on the subject, and not among the blockers.
      expect(detail.copy?.localeActive).toBe(false);
      expect(detail.approvalBlockers).toEqual([]);
      expect(detail.eligibleForApproval).toBe(true);

      const decided = await review.decide(
        "product_copy",
        id,
        {
          decision: "approve",
          expectedReviewStatus: "source_recorded",
          expectedEvidenceSetHash: detail.evidenceSetHash,
        },
        ACTOR,
      );

      expect(decided.reviewStatus).toBe("approved");

      const visible = await scalar(
        url,
        `SELECT count(*)::text FROM "v_product_copy_public" WHERE "id" = $1::uuid`,
        id,
      );
      expect(visible).toBe("0");

      // Reactivating publishes it through the view's own rule, with no second decision.
      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `UPDATE "locales" SET "is_active" = true WHERE "code" = $1`,
          INACTIVE_LOCALE,
        ),
      );

      const afterReactivation = await scalar(
        url,
        `SELECT count(*)::text FROM "v_product_copy_public" WHERE "id" = $1::uuid`,
        id,
      );
      expect(afterReactivation).toBe("1");

      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `UPDATE "locales" SET "is_active" = false WHERE "code" = $1`,
          INACTIVE_LOCALE,
        ),
      );
    },
    TIMEOUT_MS,
  );

  /* ---------------------------------------------------------------------- */
  /* Invalidation — the guarantee that makes approval mean something         */
  /* ---------------------------------------------------------------------- */

  it(
    "retires an approval when the approved TEXT is edited",
    async () => {
      const id = await draft("en", "A compressor oil for rotary screw compressors.");
      await bind(id, boundFactId);

      const detail = await review.detail("product_copy", id);
      await review.decide(
        "product_copy",
        id,
        {
          decision: "approve",
          expectedReviewStatus: "source_recorded",
          expectedEvidenceSetHash: detail.evidenceSetHash,
        },
        ACTOR,
      );
      expect(await copyStatus(id)).toBe("approved");

      /*
       * The rule this subject needed and the other two did not.
       *
       * A Specification's approval rests on a value; copy's rests on the SENTENCE. Editing an
       * approved sentence without moving the row out of `approved` would let anyone republish
       * arbitrary prose under a reviewer's name — so the text is inside the hash, and this is the
       * proof that it is.
       */
      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `UPDATE "product_copy" SET "summary" = $2 WHERE "id" = $1::uuid`,
          id,
          "A compressor oil for rotary screw compressors, and something nobody reviewed.",
        ),
      );

      expect(await copyStatus(id)).toBe("needs_review");

      const after = await review.detail("product_copy", id);
      expect(after.invalidations).toHaveLength(1);
      expect(after.invalidations[0]?.reasonCode).toBe("SUBJECT_STATE_CHANGED");

      // The retired decision is still in the history — the audit trail is append-only.
      expect(after.history).toHaveLength(1);
      expect(after.history[0]?.decision).toBe("approved");
      expect(after.history[0]?.evidenceCurrent).toBe(false);

      // And it is no longer published.
      const published = await scalar(
        url,
        `SELECT count(*)::text FROM "v_product_copy_public" WHERE "id" = $1::uuid`,
        id,
      );
      expect(published).toBe("0");
    },
    TIMEOUT_MS,
  );

  it(
    "retires an approval when its evidence is unbound",
    async () => {
      const id = await draft("en", "A way oil for machine tool slideways.");
      await bind(id, boundFactId);

      const detail = await review.detail("product_copy", id);
      await review.decide(
        "product_copy",
        id,
        {
          decision: "approve",
          expectedReviewStatus: "source_recorded",
          expectedEvidenceSetHash: detail.evidenceSetHash,
        },
        ACTOR,
      );

      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `DELETE FROM "copy_evidence" WHERE "product_copy_id" = $1::uuid`,
          id,
        ),
      );

      expect(await copyStatus(id)).toBe("needs_review");
      const after = await review.detail("product_copy", id);
      expect(after.invalidations[0]?.reasonCode).toBe("EVIDENCE_CHANGED");
    },
    TIMEOUT_MS,
  );

  /* ---------------------------------------------------------------------- */
  /* The queue                                                               */
  /* ---------------------------------------------------------------------- */

  it(
    "serves copy in the queue, labelled as itself and carrying its locale",
    async () => {
      const id = await draft("ar", "زيت محرك متعدد الدرجات للأساطيل المختلطة.");

      /*
       * Filtered to this product, not just to the subject type. The template may already hold
       * dozens of loaded drafts, and a page of 100 is not a promise that this row is on it.
       */
      const page = await review.queue({
        subjectType: "product_copy",
        productSlug: await productSlug(id),
        page: 1,
        limit: 100,
      });

      const item = page.items.find((row) => row.id === id);
      expect(item).toBeDefined();
      expect(item?.subjectType).toBe("product_copy");
      expect(item?.locale).toBe("ar");
      expect(item?.propertyKey).toBeNull();
      expect(item?.claimKind).toBeNull();
      // Every row in a subject-filtered page is that subject — the third arm did not leak.
      expect(page.items.every((row) => row.subjectType === "product_copy")).toBe(true);
    },
    TIMEOUT_MS,
  );

  it(
    "still filters the other two subjects out of each other's pages",
    async () => {
      const [specs, claims] = await Promise.all([
        review.queue({ subjectType: "specification", page: 1, limit: 25 }),
        review.queue({ subjectType: "product_claim", page: 1, limit: 25 }),
      ]);

      expect(specs.items.every((row) => row.subjectType === "specification")).toBe(true);
      expect(specs.items.every((row) => row.locale === null)).toBe(true);
      expect(claims.items.every((row) => row.subjectType === "product_claim")).toBe(true);
      expect(claims.items.every((row) => row.locale === null)).toBe(true);
    },
    TIMEOUT_MS,
  );

  /* ---------------------------------------------------------------------- */
  /* What the widened audit table must still refuse                          */
  /* ---------------------------------------------------------------------- */

  it(
    "refuses a technical review naming two subjects at once",
    async () => {
      const id = await draft("en", "A slideway lubricant, for a constraint probe.");
      const claimId = await scalar(url, `SELECT "id" FROM "product_claims" ORDER BY "id" LIMIT 1`);

      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `INSERT INTO "technical_reviews"
               ("id", "product_copy_id", "product_claim_id", "reviewer_email_snapshot",
                "decision", "evidence_set_hash", "evidence_hash_version")
             VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'approved', $4, 'copy-review-v2')`,
            id,
            claimId,
            REVIEWER_EMAIL,
            "a".repeat(64),
          ),
        ),
      ).rejects.toThrow(/technical_reviews_exactly_one_target/u);
    },
    TIMEOUT_MS,
  );

  it(
    "refuses a technical review carrying another subject's hash version",
    async () => {
      const id = await draft("en", "A quench oil, for a hash-version probe.");

      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `INSERT INTO "technical_reviews"
               ("id", "product_copy_id", "reviewer_email_snapshot",
                "decision", "evidence_set_hash", "evidence_hash_version")
             VALUES (gen_random_uuid(), $1::uuid, $2, 'approved', $3, 'claim-review-v2')`,
            id,
            REVIEWER_EMAIL,
            "a".repeat(64),
          ),
        ),
      ).rejects.toThrow(/technical_reviews_hash_version_matches_subject/u);
    },
    TIMEOUT_MS,
  );

  it(
    "refuses a row created already approved",
    async () => {
      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `INSERT INTO "product_copy" ("id", "product_id", "locale", "summary", "review_status")
             VALUES (gen_random_uuid(), $1::uuid, 'en', 'Approved on arrival.', 'approved')`,
            productIds[0],
          ),
        ),
      ).rejects.toThrow(/cannot be created already approved/u);
    },
    TIMEOUT_MS,
  );

  /**
   * The gate is the enforcement, and the eligibility blockers are the explanation.
   *
   * A caller that never reads a detail page — a script, a retry, a second tab — must still be
   * unable to approve unbound copy. This bypasses the service entirely and goes at the row.
   */
  it(
    "refuses a direct SQL approval of copy with no bound source",
    async () => {
      const id = await draft("en", "Unbound prose, approved by nobody.");

      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `UPDATE "product_copy" SET "review_status" = 'approved' WHERE "id" = $1::uuid`,
            id,
          ),
        ),
      ).rejects.toThrow(/without a bound, captured source document/u);
    },
    TIMEOUT_MS,
  );

  it(
    "refuses a direct SQL approval even with evidence, when no review was recorded",
    async () => {
      const id = await draft("en", "Bound prose, still approved by nobody.");
      await bind(id, boundFactId);

      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `UPDATE "product_copy" SET "review_status" = 'approved' WHERE "id" = $1::uuid`,
            id,
          ),
        ),
      ).rejects.toThrow(/without a matching TechnicalReview recorded in this transaction/u);
    },
    TIMEOUT_MS,
  );

  /* ---------------------------------------------------------------------- */
  /* The other two subjects, after the widening                              */
  /* ---------------------------------------------------------------------- */

  /**
   * The regression this whole file exists to catch.
   *
   * `technical_reviews_exactly_one_target` went from "one of two" to "one of three". A widened
   * constraint that accidentally became "at most one" — or "at least one" — would still accept
   * every row this suite writes, and would silently accept a review naming NO subject at all.
   */
  it(
    "still refuses a technical review naming no subject at all",
    async () => {
      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `INSERT INTO "technical_reviews"
               ("id", "reviewer_email_snapshot", "decision",
                "evidence_set_hash", "evidence_hash_version")
             VALUES (gen_random_uuid(), $1, 'approved', $2, 'copy-review-v2')`,
            REVIEWER_EMAIL,
            "a".repeat(64),
          ),
        ),
      ).rejects.toThrow(/technical_reviews_exactly_one_target/u);
    },
    TIMEOUT_MS,
  );

  it(
    "still refuses a specification approval with no review, exactly as before",
    async () => {
      const specId = await scalar(
        url,
        `SELECT "id" FROM "specifications"
          WHERE "deleted_at" IS NULL AND "review_status" = 'source_recorded'
          ORDER BY "id" LIMIT 1`,
      );
      expect(specId).not.toBeNull();

      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `UPDATE "specifications" SET "review_status" = 'approved' WHERE "id" = $1::uuid`,
            specId,
          ),
        ),
      ).rejects.toThrow(/without a matching TechnicalReview recorded in this transaction/u);
    },
    TIMEOUT_MS,
  );
});
