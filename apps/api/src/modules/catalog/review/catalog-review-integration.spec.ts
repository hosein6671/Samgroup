/**
 * The review service against PostgreSQL, on a disposable clone of the imported catalogue.
 *
 * ── What only this file can prove ───────────────────────────────────────────
 *
 * `catalog-review.service.spec.ts` fakes Prisma and proves the ORDER of the checks. It cannot
 * prove that `FOR UPDATE` serialises two reviewers, that the evidence-set hash is what the
 * database computes, that an approval actually reaches `v_specification_public`, or that a refused
 * decision leaves zero rows behind. Every one of those is a claim about PostgreSQL, and every one
 * of them is made here against real imported rows.
 *
 * ── Nothing here touches live DEV ───────────────────────────────────────────
 *
 * Every write goes to a `sam_platform_disposable_*` database created by
 * `createDisposableDatabase`, which refuses any other name and drops exactly what it created. The
 * clone is `CREATE DATABASE ... TEMPLATE`, which READS the template and never writes to it — so
 * the imported catalogue in `sam_platform` is the source of the fixture and is not modified by
 * being one.
 *
 * ── Opt-in, and it says so when it skips ────────────────────────────────────
 *
 * `pnpm test` must pass on a machine with no PostgreSQL, so the suite reads its configuration from
 * the environment and skips by name when it is absent. No workbook is needed: the template is
 * already imported, which is the whole reason this gate can clone rather than re-import.
 *
 * ── The template must be the IMPORTED catalogue ─────────────────────────────
 *
 * `CATALOG_APPLY_TEST_TEMPLATE` must name a database holding the 100 imported Products — local DEV
 * `sam_platform`, which is the default. Pointed at anything else, the first test FAILS rather than
 * skips, and that is deliberate: a review suite that quietly passed against an empty catalogue
 * would prove nothing while looking green.
 *
 *     NODE_OPTIONS=--experimental-vm-modules \
 *     CATALOG_APPLY_TEST_ADMIN_URL=postgresql://<superuser>:<pw>@localhost:5432/postgres \
 *     pnpm --filter @sam-group/api exec jest src/modules/catalog/review
 */

import { randomUUID } from "node:crypto";

import { ContentTranslationService } from "../../../common/content/content-translation.service";
import { ApiException } from "../../../common/http/api.exception";
import { PrismaService } from "../../../prisma/prisma.service";
import { MediaService } from "../../media/media.service";
import { SeoService } from "../../seo/seo.service";
import { ProductsService } from "../products.service";

import { resolveProperty } from "../import/spec-property-dictionary";
import {
  createDisposableDatabase,
  dropDisposableDatabase,
  readDatabaseConfig,
  withDisposableClient,
} from "../import/apply/__tests__/disposable-database";
import { CatalogReviewService } from "./catalog-review.service";
import { specificationEvidenceSetHash } from "./evidence-set-hash";
import {
  PRODUCT_CLAIM_ELIGIBILITY_SQL,
  REVIEW_BLOCKER_CODES,
  REVIEW_WARNING_CODES,
  SPECIFICATION_ELIGIBILITY_SQL,
  productClaimApprovalBlockers,
  resolvedMappingSqlOver,
  specificationApprovalBlockers,
} from "./review-eligibility";

import type { ResolvedLocale } from "../../../common/locale/resolved-locale";
import type { AuthenticatedUser } from "../../identity/authenticated-user";
import type { DatabaseConfig } from "../import/apply/__tests__/disposable-database";
import type { ConfigService } from "@nestjs/config";
import type { ReviewDetailResponse, ReviewQueueItemResponse } from "./dto/review.response";
import type { ProductClaimEligibilityRow, SpecificationEligibilityRow } from "./review-eligibility";

const config = readDatabaseConfig();
const suite = config === null ? describe.skip : describe;
const TIMEOUT_MS = 180_000;

const EN: ResolvedLocale = { code: "en", defaultCode: "en", isDefault: true };

const REVIEWER_ID = "cccc1111-0000-4000-8000-00000000cafe";
const REVIEWER_EMAIL = "review-probe@samgp.test";

const ACTOR: AuthenticatedUser = {
  id: REVIEWER_ID,
  email: REVIEWER_EMAIL,
  role: "ADMIN",
};

/**
 * Every internal word that must never appear in a public response, checked as SUBSTRINGS of the
 * serialized payload so a nested object or a renamed wrapper cannot hide one. The same list
 * `public-boundary.spec.ts` uses, which is deliberate: this gate must not widen it.
 */
const FORBIDDEN_PUBLIC_KEYS: readonly string[] = [
  "sourceRef",
  "source_ref",
  "reviewStatus",
  "review_status",
  "evidenceSetHash",
  "evidence_set_hash",
  "sourceFact",
  "source_fact",
  "sourceDocument",
  "source_document",
  "locatorValue",
  "locator_value",
  "rawValue",
  "raw_value",
  "propertyKey",
  "property_key",
  "technicalReview",
  "technical_review",
  "reviewerEmail",
  "approvalBlockers",
  "NEEDS_REVIEW",
  "needs_review",
  "source_recorded",
];

/**
 * Candidate rows for the two new fail-closed rules — a PRE-FILTER, never the rule itself.
 *
 * These narrow 1,402 Specifications to the handful worth probing so the finder does not walk the
 * whole table through the API. The verdict is still the service's: `findBlockedSpecification` loads
 * each candidate's real detail response and keeps the first one whose `approvalBlockers` actually
 * carries the code. A wrong pre-filter therefore makes the test FAIL to find a subject; it can
 * never make it pass against a row the service does not block.
 *
 * Only undecided rows, so the decision reaches the eligibility step rather than being refused
 * earlier for being non-decidable.
 */
const UNDECIDED = `"deleted_at" IS NULL AND "review_status" IN ('source_recorded', 'needs_review')`;

const BLOCKED_CANDIDATE_SQL = {
  SOURCE_ASSET_ABSENT: `
    SELECT s."id" FROM "specifications" s
     WHERE s.${UNDECIDED}
       AND EXISTS (
         SELECT 1 FROM "specification_evidence" se
           LEFT JOIN "source_facts" sf     ON sf."id" = se."source_fact_id"
           LEFT JOIN "source_documents" sd ON sd."id" = sf."source_document_id"
          WHERE se."specification_id" = s."id"
            AND se."role" <> 'superseded'
            AND sd."source_asset_id" IS NULL)
     ORDER BY s."id" LIMIT 20`,

  REQUIRED_METHOD_ABSENT: `
    SELECT s."id" FROM "specifications" s
      JOIN "spec_properties" sp ON sp."key" = s."property_key"
     WHERE s.${UNDECIDED}
       AND sp."method_requirement" = 'required'
       AND (s."method" IS NULL OR length(btrim(s."method")) = 0)
     ORDER BY s."id" LIMIT 20`,
} as const;

/**
 * One manually transcribed Specification on a captured document, and one on an uncaptured one.
 *
 * Manual transcription is 716 of the catalogue's source facts, and the ratified rule is that it is
 * acceptable exactly when the bytes it was transcribed FROM are captured. Both halves need a real
 * row to be proved, and both exist in the imported catalogue.
 */
const MANUAL_TRANSCRIPTION_SAMPLE_SQL = `
  (SELECT s."id",
          (sd."source_asset_id" IS NOT NULL) AS "captured"
     FROM "specifications" s
     JOIN "specification_evidence" se ON se."specification_id" = s."id" AND se."role" <> 'superseded'
     JOIN "source_facts" sf      ON sf."id" = se."source_fact_id"
     JOIN "source_documents" sd  ON sd."id" = sf."source_document_id"
    WHERE sf."extraction_method" = 'manual_transcription'
      AND sd."source_asset_id" IS NOT NULL
    ORDER BY s."id" LIMIT 1)
  UNION ALL
  (SELECT s."id",
          (sd."source_asset_id" IS NOT NULL) AS "captured"
     FROM "specifications" s
     JOIN "specification_evidence" se ON se."specification_id" = s."id" AND se."role" <> 'superseded'
     JOIN "source_facts" sf      ON sf."id" = se."source_fact_id"
     JOIN "source_documents" sd  ON sd."id" = sf."source_document_id"
    WHERE sf."extraction_method" = 'manual_transcription'
      AND sd."source_asset_id" IS NULL
    ORDER BY s."id" LIMIT 1)`;

async function status(url: string, table: string, id: string): Promise<string | null> {
  return withDisposableClient(url, async (client) => {
    const rows = await client.$queryRawUnsafe<{ s: string }[]>(
      `SELECT "review_status"::text AS s FROM "${table}" WHERE "id" = $1::uuid`,
      id,
    );
    return rows[0]?.s ?? null;
  });
}

async function counts(url: string): Promise<Record<string, number>> {
  return withDisposableClient(url, async (client) => {
    const rows = await client.$queryRawUnsafe<{ t: string; n: number }[]>(
      `SELECT 'technical_reviews' t, count(*)::int n FROM technical_reviews
       UNION ALL SELECT 'source_facts', count(*)::int FROM source_facts
       UNION ALL SELECT 'specification_evidence', count(*)::int FROM specification_evidence
       UNION ALL SELECT 'specifications_approved', count(*)::int FROM specifications WHERE review_status = 'approved'
       UNION ALL SELECT 'claims_approved', count(*)::int FROM product_claims WHERE review_status = 'approved'
       UNION ALL SELECT 'v_specification_public', count(*)::int FROM v_specification_public
       UNION ALL SELECT 'v_product_claim_public', count(*)::int FROM v_product_claim_public`,
    );
    return Object.fromEntries(rows.map((row) => [row.t, Number(row.n)]));
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

suite("the catalog review service over the imported catalogue", () => {
  let url = "";
  let prisma: PrismaService;
  let review: CatalogReviewService;
  let products: ProductsService;

  beforeAll(async () => {
    url = await createDisposableDatabase(
      config as DatabaseConfig,
      `review_${randomUUID().slice(0, 8).replace(/-/g, "")}`,
    );

    prisma = new PrismaService({ getOrThrow: () => url } as unknown as ConfigService);
    const translations = new ContentTranslationService(prisma);
    review = new CatalogReviewService(prisma);
    products = new ProductsService(
      prisma,
      translations,
      new SeoService(prisma, translations),
      new MediaService(prisma),
    );

    /*
     * The reviewer. `technical_reviews.reviewer_id` is a real foreign key, so the audit trail
     * cannot be written by an identity that does not exist — which is the point of the column.
     *
     * Written with raw SQL rather than `prisma.user.create`, deliberately: `identity.module.spec.ts`
     * fails any file outside `identity/` that names `prisma.user.`, because authenticating by
     * reading `users` from another module is exactly the cross-module access the modular-monolith
     * rule forbids. This is disposable-database FIXTURE SETUP and not application code, and the
     * boundary test is right to keep the Catalog module away from that repository regardless.
     */
    await withDisposableClient(url, (client) =>
      client.$executeRawUnsafe(
        `INSERT INTO "users" ("id", "email", "password_hash", "role")
         VALUES ($1::uuid, $2, $3, 'admin')`,
        REVIEWER_ID,
        REVIEWER_EMAIL,
        // Not a credential and never used to authenticate: this suite calls the SERVICE, and the
        // guards it runs behind are proved separately in the controller spec.
        "not-a-credential",
      ),
    );
  }, TIMEOUT_MS);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (url) await dropDisposableDatabase(config as DatabaseConfig, url);
  }, TIMEOUT_MS);

  /**
   * The fixture is the imported catalogue, and every assertion below depends on that. Checked
   * first and loudly: a clone of an EMPTY database would make most of this file pass by having
   * nothing to test.
   */
  it(
    "starts from the imported catalogue with nothing approved",
    async () => {
      const before = await counts(url);

      expect(await prisma.product.count()).toBe(100);
      expect(await prisma.specification.count()).toBe(1402);
      expect(await prisma.productClaim.count()).toBe(148);
      expect(before["technical_reviews"]).toBe(0);
      expect(before["specifications_approved"]).toBe(0);
      expect(before["claims_approved"]).toBe(0);
      expect(before["v_specification_public"]).toBe(0);
      expect(before["v_product_claim_public"]).toBe(0);
    },
    TIMEOUT_MS,
  );

  /* ---------------------------------------------------------------- */
  /* Queue                                                             */
  /* ---------------------------------------------------------------- */

  describe("the queue", () => {
    /**
     * The two IMPORTER-written subject counts are fixed; the third is not.
     *
     * 1,402 Specifications — 1,398 from the ratified first import plus the four the ADR-018
     * coolant patch added — and 148 ProductClaims are the committed catalogue, and asserting them
     * exactly is the point of this file. ProductCopy has no importer: its rows arrive from
     * `load-product-copy-drafts.ts`, an explicitly armed editorial script that may or may not have
     * been run against the template this suite clones.
     *
     * So the copy count is READ rather than asserted, and the relationship is what is checked.
     * Baking today's number in would make this suite fail for anyone who ran a script ADR-019 §6
     * sanctions — a test failing because a sanctioned operation was performed is a test that has
     * stopped describing the system.
     */
    it(
      "paginates every subject type as one list",
      async () => {
        const copy = await review.queue({ subjectType: "product_copy", limit: 1 });
        const first = await review.queue({ limit: 10, sort: "createdAt" });
        const second = await review.queue({ limit: 10, page: 2, sort: "createdAt" });

        expect(first.total).toBe(1402 + 148 + copy.total);
        expect(first.items).toHaveLength(10);
        expect(second.items).toHaveLength(10);

        // No row on two pages: the ordering carries `id` as a tiebreaker precisely for this.
        const ids = new Set(first.items.map((item) => item.id));
        for (const item of second.items) expect(ids.has(item.id)).toBe(false);
      },
      TIMEOUT_MS,
    );

    it(
      "filters by subject type",
      async () => {
        const specs = await review.queue({ subjectType: "specification", limit: 5 });
        const claims = await review.queue({ subjectType: "product_claim", limit: 5 });

        expect(specs.total).toBe(1402);
        expect(claims.total).toBe(148);
        expect(specs.items.every((item) => item.subjectType === "specification")).toBe(true);
        expect(claims.items.every((item) => item.subjectType === "product_claim")).toBe(true);
      },
      TIMEOUT_MS,
    );

    it(
      "filters by review status",
      async () => {
        const needsReview = await review.queue({ reviewStatus: "needs_review", limit: 1 });
        const sourceRecorded = await review.queue({ reviewStatus: "source_recorded", limit: 1 });

        /*
         * The importer's own verdicts, exactly. Loaded product copy lands at `source_recorded` and
         * never at `needs_review`, so only the second total is offset by it — read rather than
         * assumed, for the reason the pagination test states.
         */
        const copy = await review.queue({ subjectType: "product_copy", limit: 1 });

        expect(needsReview.total).toBe(67 + 67);
        expect(sourceRecorded.total).toBe(1335 + 81 + copy.total);
      },
      TIMEOUT_MS,
    );

    it(
      "filters by Product, sourceRef, Family and ProductType",
      async () => {
        const sample = (await review.queue({ subjectType: "specification", limit: 1 })).items[0];
        expect(sample).toBeDefined();
        const item = sample as ReviewQueueItemResponse;

        const bySlug = await review.queue({ productSlug: item.product.slug, limit: 1 });
        expect(bySlug.total).toBeGreaterThan(0);

        const byRef = await review.queue({ sourceRef: item.product.sourceRef ?? "", limit: 1 });
        expect(byRef.total).toBe(bySlug.total);

        if (item.product.family !== null) {
          const byFamily = await review.queue({ family: item.product.family, limit: 1 });
          expect(byFamily.total).toBeGreaterThanOrEqual(bySlug.total);
        }

        const byUnknownFamily = await review.queue({ family: "no-such-family", limit: 1 });
        expect(byUnknownFamily.total).toBe(0);

        const byUnknownType = await review.queue({ productType: "no-such-type", limit: 1 });
        expect(byUnknownType.total).toBe(0);
      },
      TIMEOUT_MS,
    );

    /** A property key names Specifications only; a claim kind names ProductClaims only. */
    it(
      "keeps the two subject vocabularies apart",
      async () => {
        const byProperty = await review.queue({ propertyKey: "kv_100c", limit: 5 });
        expect(byProperty.total).toBeGreaterThan(0);
        expect(byProperty.items.every((item) => item.subjectType === "specification")).toBe(true);

        const byKind = await review.queue({ claimKind: "reference_only", limit: 10 });
        expect(byKind.total).toBe(5);
        expect(byKind.items.every((item) => item.subjectType === "product_claim")).toBe(true);
      },
      TIMEOUT_MS,
    );

    it(
      "filters by the document the evidence came from",
      async () => {
        const locator = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ v: string }[]>(
            `SELECT sd."locator_value" AS v
               FROM "source_documents" sd
               JOIN "source_facts" sf ON sf."source_document_id" = sd."id"
               JOIN "specification_evidence" se ON se."source_fact_id" = sf."id"
              GROUP BY sd."locator_value" ORDER BY count(*) DESC LIMIT 1`,
          );
          return rows[0]?.v ?? "";
        });

        const matched = await review.queue({ documentLocator: locator, limit: 1 });
        const unmatched = await review.queue({ documentLocator: "no-such-document", limit: 1 });

        expect(matched.total).toBeGreaterThan(0);
        expect(unmatched.total).toBe(0);
      },
      TIMEOUT_MS,
    );

    /**
     * The two halves of the filter must partition the queue exactly. If they did not, one of them
     * would be hiding rows rather than narrowing them.
     */
    it(
      "partitions the queue by unresolved findings",
      async () => {
        const all = await review.queue({ limit: 1 });
        const unresolved = await review.queue({ unresolvedFindings: true, limit: 1 });
        const resolved = await review.queue({ unresolvedFindings: false, limit: 1 });

        expect(unresolved.total + resolved.total).toBe(all.total);
        // The importer flagged 67 specifications and 67 claims, plus the specifications whose
        // property mapping does not resolve.
        expect(unresolved.total).toBeGreaterThanOrEqual(67 + 67);
      },
      TIMEOUT_MS,
    );

    it(
      "returns curated rows and never a whole database row",
      async () => {
        const item = (await review.queue({ limit: 1 })).items[0] as ReviewQueueItemResponse;

        expect(Object.keys(item).sort()).toEqual(
          [
            "claimKind",
            "createdAt",
            "evidenceCount",
            "grade",
            "hasUnresolvedFindings",
            "id",
            // ADR-019: null for a Specification and a claim, the locale for ProductCopy.
            "locale",
            "product",
            "propertyKey",
            "reviewCount",
            "reviewStatus",
            "subjectType",
            "summary",
          ].sort(),
        );
        expect(Object.keys(item.product).sort()).toEqual(
          ["family", "name", "productType", "slug", "sourceRef"].sort(),
        );
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* Detail                                                            */
  /* ---------------------------------------------------------------- */

  describe("the review detail", () => {
    it(
      "carries the evidence, the document and the mapping a reviewer needs",
      async () => {
        const item = (await review.queue({ subjectType: "specification", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("specification", item.id);

        expect(detail.subjectType).toBe("specification");
        expect(detail.specification).not.toBeNull();
        expect(detail.claim).toBeNull();
        expect(detail.evidenceSetHash).toMatch(/^[0-9a-f]{64}$/);
        expect(detail.evidence.length).toBeGreaterThan(0);

        const evidence = detail.evidence[0];
        expect(evidence).toBeDefined();
        expect(typeof evidence?.rawValue).toBe("string");
        expect(evidence?.document.title.length).toBeGreaterThan(0);
        expect(evidence?.document.locatorValue.length).toBeGreaterThan(0);
        expect(detail.mappings.length).toBeGreaterThan(0);
        expect(detail.mappings.some((mapping) => mapping.confidence === "high")).toBe(true);
      },
      TIMEOUT_MS,
    );

    /** No credential, no filesystem path, no stored bytes — see the DTO module note. */
    it(
      "serves the document's identity and never its content",
      async () => {
        const item = (await review.queue({ subjectType: "specification", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("specification", item.id);
        const serialized = JSON.stringify(detail);

        for (const forbidden of [
          "passwordHash",
          "password_hash",
          "bytes",
          "downloadUrl",
          "signedUrl",
        ]) {
          expect(serialized).not.toContain(forbidden);
        }
        expect(Object.keys(detail.evidence[0]?.document ?? {}).sort()).toEqual(
          [
            "assetByteSize",
            "assetMediaType",
            "assetSha256",
            "documentDate",
            "id",
            "locatorType",
            "locatorValue",
            "publisher",
            "retrievedAt",
            "revisionLabel",
            "supersededById",
            "title",
          ].sort(),
        );
      },
      TIMEOUT_MS,
    );

    it(
      "answers 404 for a subject that does not exist",
      async () => {
        const error = await refused(() =>
          review.detail("specification", "00000000-0000-4000-8000-000000000000"),
        );
        expect(error.getStatus()).toBe(404);
      },
      TIMEOUT_MS,
    );

    /* -------------------------------------------------------------- */
    /* The dictionary metadata, and the contract separation            */
    /* -------------------------------------------------------------- */

    /**
     * `valueKind` and `methodRequirement` come from the `SpecProperty` row, and they are two axes.
     *
     * What matters is not that the fields exist but that they are INDEPENDENT of `valueType`: the
     * response must be able to say "this property is numeric" and "this recorded value is a range"
     * at the same time, without either being computed from the other.
     */
    it(
      "serves both dictionary axes on a Specification, independently of the value shape",
      async () => {
        const item = (await review.queue({ subjectType: "specification", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("specification", item.id);
        const value = detail.specification;

        expect(value).not.toBeNull();
        expect(["numeric", "textual", "coded"]).toContain(value?.valueKind);
        expect(["required", "optional", "not_applicable"]).toContain(value?.methodRequirement);

        /* The shape axis is served as it always was, and is not the kind axis. */
        expect(value?.valueType).not.toBe(value?.valueKind);
      },
      TIMEOUT_MS,
    );

    /**
     * The shape of the Specification projection, asserted as an EXACT key set.
     *
     * An exact set rather than a presence check: it is what stops a later gate from folding the
     * kind axis into the shape axis, or from adding a third derived field nobody asked for.
     */
    it(
      "serves an exact Specification value shape carrying both new axes",
      async () => {
        const item = (await review.queue({ subjectType: "specification", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("specification", item.id);

        expect(Object.keys(detail.specification ?? {}).sort()).toEqual(
          [
            "displayValue",
            "method",
            "methodRequirement",
            "numericMax",
            "numericMin",
            "pairFirst",
            "pairSecond",
            "propertyKey",
            "qualifier",
            "resultBasis",
            "unit",
            "valueKind",
            "valueType",
          ].sort(),
        );
      },
      TIMEOUT_MS,
    );

    /**
     * A ProductClaim has no property key, so it has no dictionary record and must invent neither
     * axis. Asserted as an exact key set on the claim projection, and as an absence anywhere in the
     * serialized response.
     */
    it(
      "never invents dictionary metadata on a ProductClaim",
      async () => {
        const item = (await review.queue({ subjectType: "product_claim", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("product_claim", item.id);
        const serialized = JSON.stringify(detail);

        expect(detail.specification).toBeNull();
        expect(Object.keys(detail.claim ?? {}).sort()).toEqual(
          ["contextNote", "kind", "standardBody", "standardCode"].sort(),
        );
        expect(serialized).not.toContain("valueKind");
        expect(serialized).not.toContain("methodRequirement");
      },
      TIMEOUT_MS,
    );

    /* -------------------------------------------------------------- */
    /* Structured blockers and warnings                                */
    /* -------------------------------------------------------------- */

    /**
     * Every blocker the live catalogue produces is a `{code, message}` pair drawn from the closed
     * vocabulary — no bare string survives anywhere.
     *
     * Swept over a page of each subject type rather than one row, because the point is that the
     * conversion was COMPLETE, not that one path was converted.
     */
    it(
      "serves only structured blockers and warnings, over both subject types",
      async () => {
        for (const subjectType of ["specification", "product_claim"] as const) {
          const page = await review.queue({ subjectType, limit: 25 });

          for (const item of page.items) {
            const detail = await review.detail(subjectType, item.id);

            for (const entry of detail.approvalBlockers) {
              expect(typeof entry).toBe("object");
              expect(REVIEW_BLOCKER_CODES).toContain(entry.code);
              expect(entry.message.length).toBeGreaterThan(0);
            }
            for (const entry of detail.warnings) {
              expect(typeof entry).toBe("object");
              expect(REVIEW_WARNING_CODES).toContain(entry.code);
              expect(entry.message.length).toBeGreaterThan(0);
            }

            expect(detail.eligibleForApproval).toBe(detail.approvalBlockers.length === 0);
          }
        }
      },
      TIMEOUT_MS,
    );

    /**
     * All 69 imported source documents record neither a date nor a revision label, so every subject
     * carries both warnings — and NONE of them is made ineligible by that.
     *
     * This is the assertion that proves the warning channel does what it was separated out to do.
     */
    it(
      "warns about every document's missing date and revision without blocking anything",
      async () => {
        const page = await review.queue({ subjectType: "specification", limit: 25 });
        let eligibleSeen = 0;

        for (const item of page.items) {
          const detail = await review.detail("specification", item.id);
          const warningCodes = detail.warnings.map((entry) => entry.code);
          const blockerCodes = detail.approvalBlockers.map((entry) => entry.code);

          expect(warningCodes).toContain("DOCUMENT_DATE_UNKNOWN");
          expect(warningCodes).toContain("DOCUMENT_REVISION_UNKNOWN");
          expect(blockerCodes).not.toContain("DOCUMENT_DATE_UNKNOWN");
          expect(blockerCodes).not.toContain("DOCUMENT_REVISION_UNKNOWN");

          if (detail.eligibleForApproval) eligibleSeen += 1;
        }

        /* If the warnings had frozen eligibility, this would be zero. */
        expect(eligibleSeen).toBeGreaterThan(0);
      },
      TIMEOUT_MS,
    );

    /** A blocker and a warning both name the RULE. Neither ever names a source. */
    it(
      "leaks no locator or asset identity through a blocker or a warning",
      async () => {
        const page = await review.queue({ limit: 25 });

        for (const item of page.items) {
          const detail = await review.detail(item.subjectType, item.id);
          const serialized = JSON.stringify({
            approvalBlockers: detail.approvalBlockers,
            warnings: detail.warnings,
          });

          expect(serialized).not.toMatch(/https?:\/\//);
          expect(serialized).not.toMatch(/[0-9a-f]{64}/);
          expect(serialized).not.toMatch(/\.(pdf|xlsx|xls|docx?|csv)/i);
        }
      },
      TIMEOUT_MS,
    );

    /* -------------------------------------------------------------- */
    /* The fail-closed rules, counted over the whole catalogue         */
    /* -------------------------------------------------------------- */

    /**
     * The ratified figures, recomputed from the PRODUCTION SQL and the PRODUCTION builders.
     *
     * `eligibilityCensus` runs `SPECIFICATION_ELIGIBILITY_SQL` and `PRODUCT_CLAIM_ELIGIBILITY_SQL`
     * — the exact strings the service runs inside the decision transaction — over every subject,
     * and feeds each row to `specificationApprovalBlockers` / `productClaimApprovalBlockers`. It is
     * therefore not a second implementation that could agree with the numbers while the service
     * disagrees.
     *
     * Counting rather than sampling is the whole point: a rule that fired on 500 rows instead of 5
     * would look identical on any single row.
     */
    it(
      "blocks exactly the ratified rows on the required-method and capture rules",
      async () => {
        expect(await eligibilityCensus()).toEqual({
          specifications: 1402,
          specificationsEligible: 1342,
          specificationsRequiredMethodAbsent: 5,
          specificationsMethodNotEvidenced: 0,
          specificationsSourceAssetAbsent: 60,
          specificationsMethodOrSourceUnion: 60,
          specificationsMappingUnresolved: 0,
          specificationsMethodAbsentAndUncaptured: 5,
          productClaims: 148,
          productClaimsEligible: 102,
          productClaimsSourceAssetAbsent: 46,
          productClaimsNeverApprovable: 5,
        });
      },
      TIMEOUT_MS,
    );

    /**
     * **The gate may never be stricter than the importer that produced the rows.**
     *
     * This is the invariant a real defect violated, and the reason it is asserted as a rule rather
     * than only as a count. `RESOLVED_MAPPING` compared `raw_property` raw — exact,
     * case-sensitive, whitespace-sensitive — while `resolveProperty` resolves through
     * `mappingLookupKey`, which is `replace(/\s+/g, " ").trim().toLowerCase()`. Three
     * specifications whose sources spell it "Flash point" against a dictionary holding "Flash Point"
     * were reported PROPERTY_MAPPING_UNRESOLVED although the importer had resolved them — which is
     * why they carry a normalized `property_key` at all.
     *
     * The census caught the number changing; only this catches the two implementations drifting
     * apart again, which is the thing that actually goes wrong. It reports the offending labels
     * rather than a count, so a failure names what to fix.
     *
     * Note the direction: this asserts the gate is never STRICTER. It may be more permissive, and
     * in one ratified case it is — see the tier cases below, where an unapprovable unit-specific
     * mapping is filtered out before the tier is chosen and a HIGH generic one resolves instead.
     */
    it(
      "never reports a mapping unresolved that the importer itself resolves",
      async () => {
        const offenders = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<
            { id: string; rawProperty: string | null; rawUnit: string | null }[]
          >(`
            SELECT DISTINCT s."id"            AS "id",
                            sf."raw_property" AS "rawProperty",
                            sf."raw_unit"     AS "rawUnit"
              FROM "specifications" s
              JOIN "specification_evidence" se ON se."specification_id" = s."id"
              JOIN "source_facts" sf           ON sf."id" = se."source_fact_id"
             WHERE s."deleted_at" IS NULL
          `);

          const resolvedByImporter = rows.filter(
            (row) =>
              row.rawProperty !== null &&
              resolveProperty(row.rawProperty, row.rawUnit ?? "").outcome === "resolved",
          );

          expect(resolvedByImporter.length).toBeGreaterThan(0);

          const found = new Set<string>();

          for (const row of resolvedByImporter) {
            const [eligibility] = await client.$queryRawUnsafe<SpecificationEligibilityRow[]>(
              SPECIFICATION_ELIGIBILITY_SQL,
              row.id,
            );

            const row_ = eligibility as SpecificationEligibilityRow;
            const codes = specificationApprovalBlockers({
              ...row_,
              evidenceLinks: Number(row_.evidenceLinks),
              evidenceOrphans: Number(row_.evidenceOrphans),
            }).map((entry) => entry.code);

            if (codes.includes("PROPERTY_MAPPING_UNRESOLVED")) {
              found.add(`${row.rawProperty ?? ""} | ${row.rawUnit ?? ""}`);
            }
          }

          return [...found];
        });

        expect(offenders).toEqual([]);
      },
      TIMEOUT_MS,
    );

    /**
     * Which tier wins, pinned combination by combination against a real PostgreSQL.
     *
     * The SQL under test is `resolvedMappingSqlOver` — the SAME text production runs, pointed at a
     * `VALUES` relation instead of `spec_property_mappings`. Nothing is inserted: these are pure
     * `SELECT`s, so the clone is read but never written, and the cases can describe shapes the
     * live table does not contain (unit-specific, rejected and superseded mappings are all absent
     * from it today).
     *
     * The first three cases are the ones worth stating out loud, because they are where the gate
     * and `resolveProperty` DIFFER. The importer selects `specific ?? generic` before it looks at
     * confidence, so a LOW unit-specific mapping shadows a HIGH generic one and nothing resolves.
     * The gate filters for approvability first, so the unusable specific mapping never claims the
     * tier and the generic one resolves. That is the reviewer contract — the specific tier among
     * mappings eligible for approval — and it is what the previous `ORDER BY … LIMIT 1` did too.
     */
    const mappingCase = (
      rows: readonly (readonly [string, string | null, string | null, string, string])[],
    ): string => {
      const quote = (value: string | null): string =>
        value === null ? "NULL::text" : `'${value.replace(/'/g, "''")}'::text`;
      const values = rows
        .map((row) => `(${row.map((column) => quote(column)).join(", ")})`)
        .join(", ");

      return `
        WITH sf("raw_property", "raw_unit") AS (VALUES ('Flash point'::text, '°C'::text)),
             candidates("raw_property", "raw_unit", "spec_property_key",
                        "confidence", "review_status") AS (VALUES ${values})
        SELECT (${resolvedMappingSqlOver("candidates")}) AS "key" FROM sf`;
    };

    const SPECIFIC = (confidence: string, status = "source_recorded") =>
      ["Flash Point", "°C", "specific_key", confidence, status] as const;
    const GENERIC = (confidence: string, key: string | null = "generic_key") =>
      ["Flash Point", null, key, confidence, "source_recorded"] as const;

    it.each([
      [
        "a LOW unit-specific mapping never shadows a HIGH generic one",
        [SPECIFIC("low"), GENERIC("high")],
        "generic_key",
      ],
      [
        "a REJECTED unit-specific mapping never shadows a HIGH generic one",
        [SPECIFIC("high", "rejected"), GENERIC("high")],
        "generic_key",
      ],
      [
        "a SUPERSEDED unit-specific mapping never shadows a HIGH generic one",
        [SPECIFIC("high", "superseded"), GENERIC("high")],
        "generic_key",
      ],
      [
        "a HIGH unit-specific mapping beats a HIGH generic one",
        [SPECIFIC("high"), GENERIC("high")],
        "specific_key",
      ],
      [
        "agreeing duplicates in the winning tier resolve to their shared key",
        [
          GENERIC("high", "same_key"),
          ["Flash  point", null, "same_key", "high", "source_recorded"] as const,
        ],
        "same_key",
      ],
      [
        "conflicting HIGH mappings in the winning tier resolve to nothing",
        [
          GENERIC("high", "key_one"),
          ["Flash  point", null, "key_two", "high", "source_recorded"] as const,
        ],
        null,
      ],
      ["a HIGH mapping naming no key resolves to nothing", [GENERIC("high", null)], null],
      ["a LOW generic mapping alone resolves to nothing", [GENERIC("low")], null],
    ])(
      "%s",
      async (_label, rows, expected) => {
        const [row] = await withDisposableClient(url, (client) =>
          client.$queryRawUnsafe<{ key: string | null }[]>(
            mappingCase(
              rows as readonly (readonly [string, string | null, string | null, string, string])[],
            ),
          ),
        );

        expect(row?.key ?? null).toBe(expected);
      },
      TIMEOUT_MS,
    );

    /**
     * A subject the capture rule blocks refuses a DIRECT approval, with the code, writing nothing.
     *
     * "Direct" is the load-bearing word: this call never rendered a page, so no UI wording took
     * part in refusing it. The subject is found by the rule rather than hard-coded, so the test
     * survives a re-import.
     */
    it(
      "refuses a direct approval of an uncaptured subject with 409 and the code, writing nothing",
      async () => {
        const before = await counts(url);
        const blocked = await findBlockedSpecification("SOURCE_ASSET_ABSENT");

        const error = await refused(() =>
          review.decide(
            "specification",
            blocked.id,
            {
              decision: "approve",
              expectedReviewStatus: blocked.reviewStatus,
              expectedEvidenceSetHash: blocked.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(409);
        expect(error.details?.map((detail) => detail.code)).toContain("SOURCE_ASSET_ABSENT");

        /* No TechnicalReview, no status change, no publication. */
        expect(await counts(url)).toEqual(before);
        expect(await status(url, "specifications", blocked.id)).toBe(blocked.reviewStatus);
      },
      TIMEOUT_MS,
    );

    /** The same, for the required-method rule. */
    it(
      "refuses a direct approval of a required-method-absent subject with 409 and the code",
      async () => {
        const before = await counts(url);
        const blocked = await findBlockedSpecification("REQUIRED_METHOD_ABSENT");

        const error = await refused(() =>
          review.decide(
            "specification",
            blocked.id,
            {
              decision: "approve",
              expectedReviewStatus: blocked.reviewStatus,
              expectedEvidenceSetHash: blocked.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(409);
        expect(error.details?.map((detail) => detail.code)).toContain("REQUIRED_METHOD_ABSENT");
        expect(await counts(url)).toEqual(before);
        expect(await status(url, "specifications", blocked.id)).toBe(blocked.reviewStatus);
      },
      TIMEOUT_MS,
    );

    /**
     * The refusal carries no provenance beyond the approved Admin DTO.
     *
     * `SOURCE_ASSET_ABSENT` is the blocker most tempted to say WHICH document is uncaptured, and it
     * must not. The whole serialized refusal is checked, not only the message.
     */
    it(
      "leaks no source locator through a refusal",
      async () => {
        const blocked = await findBlockedSpecification("SOURCE_ASSET_ABSENT");

        const error = await refused(() =>
          review.decide(
            "specification",
            blocked.id,
            {
              decision: "approve",
              expectedReviewStatus: blocked.reviewStatus,
              expectedEvidenceSetHash: blocked.evidenceSetHash,
            },
            ACTOR,
          ),
        );
        const serialized = JSON.stringify({ message: error.message, details: error.details });

        expect(serialized).not.toMatch(/https?:\/\//);
        expect(serialized).not.toMatch(/[0-9a-f]{64}/);
        expect(serialized).not.toMatch(/\.(pdf|xlsx|xls|docx?|csv)/i);
        expect(serialized).not.toContain("locatorValue");
      },
      TIMEOUT_MS,
    );

    /**
     * A manual transcription is judged on capture and on nothing else.
     *
     * 716 of the catalogue's source facts were transcribed by hand. Those whose document names a
     * captured asset are approvable; those whose document does not get exactly ONE blocker, not a
     * second one restating the same condition from the transcription's side.
     */
    it(
      "accepts a captured manual transcription and blocks an uncaptured one exactly once",
      async () => {
        const rows = await withDisposableClient(url, (client) =>
          client.$queryRawUnsafe<{ id: string; captured: boolean }[]>(
            MANUAL_TRANSCRIPTION_SAMPLE_SQL,
          ),
        );
        const captured = rows.find((row) => row.captured);
        const uncaptured = rows.find((row) => !row.captured);

        expect(captured).toBeDefined();
        expect(uncaptured).toBeDefined();

        const capturedDetail = await review.detail("specification", captured!.id);
        const uncapturedDetail = await review.detail("specification", uncaptured!.id);

        expect(capturedDetail.approvalBlockers.map((entry) => entry.code)).not.toContain(
          "SOURCE_ASSET_ABSENT",
        );

        const codes = uncapturedDetail.approvalBlockers.map((entry) => entry.code);
        expect(codes).toContain("SOURCE_ASSET_ABSENT");
        expect(codes.filter((code) => code === "SOURCE_ASSET_ABSENT")).toHaveLength(1);
        expect(uncapturedDetail.eligibleForApproval).toBe(false);
      },
      TIMEOUT_MS,
    );

    /**
     * `product_claims` in the imported catalogue includes five `reference_only` rows — the kind
     * that can never be approved. The detail must SAY so rather than let a reviewer discover it as
     * a constraint violation.
     */
    it(
      "reports a forbidden claim kind as an approval blocker",
      async () => {
        const item = (await review.queue({ claimKind: "reference_only", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("product_claim", item.id);

        expect(detail.eligibleForApproval).toBe(false);
        expect(detail.approvalBlockers.map((entry) => entry.code)).toContain(
          "CLAIM_KIND_NEVER_APPROVABLE",
        );
        expect(detail.approvalBlockers.map((entry) => entry.message).join(" ")).toContain(
          "LICENSED_BY and REFERENCE_ONLY",
        );
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* The evidence-set hash                                             */
  /* ---------------------------------------------------------------- */

  describe("the evidence-set hash", () => {
    it(
      "is deterministic across repeated computation",
      async () => {
        const item = (await review.queue({ subjectType: "specification", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;

        const first = await specificationEvidenceSetHash(prisma, item.id);
        const second = await specificationEvidenceSetHash(prisma, item.id);
        const viaDetail = (await review.detail("specification", item.id)).evidenceSetHash;

        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(second).toBe(first);
        expect(viaDetail).toBe(first);
      },
      TIMEOUT_MS,
    );

    /**
     * Order independence, proved by CONSTRUCTION rather than by reasoning: two throwaway
     * Specifications on the same product get the same two evidence links inserted in opposite
     * orders, and must hash identically.
     */
    it(
      "does not depend on the order the evidence was linked",
      async () => {
        /*
         * ONE subject, linked twice in opposite orders.
         *
         * This used to build TWO throwaway Specifications on two Products and compare their
         * hashes, which worked while the hash covered evidence links and nothing else. It cannot
         * work against `spec-review-v2`: the payload carries `subjectId` and `productId`, so two
         * different subjects are REQUIRED to hash differently and the old shape would have been
         * asserting the opposite of a property this gate deliberately added.
         *
         * Isolating insertion order therefore means holding everything else identical, and the
         * only way to do that is to use the same row: link, hash, unlink, relink in the reverse
         * order, hash again. That is a strictly sharper test of the actual claim — nothing but the
         * order changed between the two measurements.
         */
        const { first: hashFirst, second: hashSecond } = await withDisposableClient(
          url,
          async (client) => {
            const facts = await client.$queryRawUnsafe<{ id: string }[]>(
              `SELECT "id" FROM "source_facts" ORDER BY "id" LIMIT 2`,
            );
            const [a, b] = [facts[0]?.id ?? "", facts[1]?.id ?? ""];

            const products = await client.$queryRawUnsafe<{ id: string }[]>(
              `SELECT "id" FROM "products" ORDER BY "id" LIMIT 1`,
            );
            const rows = await client.$queryRawUnsafe<{ id: string }[]>(
              `INSERT INTO "specifications" ("id", "product_id", "key", "value")
               VALUES (gen_random_uuid(), $1::uuid, 'zz_hash_probe', 'probe') RETURNING "id"`,
              products[0]?.id ?? "",
            );
            const id = rows[0]?.id ?? "";

            const link = async (order: readonly string[]): Promise<string | null> => {
              for (const factId of order) {
                await client.$executeRawUnsafe(
                  `INSERT INTO "specification_evidence"
                     ("specification_id", "source_fact_id", "role")
                   VALUES ($1::uuid, $2::uuid, 'primary')`,
                  id,
                  factId,
                );
              }
              const hash = await specificationEvidenceSetHash(client, id);
              await client.$executeRawUnsafe(
                `DELETE FROM "specification_evidence" WHERE "specification_id" = $1::uuid`,
                id,
              );
              return hash;
            };

            return { first: await link([a, b]), second: await link([b, a]) };
          },
        );

        expect(hashFirst).not.toBeNull();
        expect(hashFirst).toBe(hashSecond);
      },
      TIMEOUT_MS,
    );

    /**
     * The other half of the same property, and the one v2 added: two different subjects with
     * IDENTICAL evidence must NOT hash the same.
     *
     * Under the v1 definition they did, because the hash was the evidence set and nothing else —
     * so a Specification and its neighbour could share a fingerprint, and a review of one quoted a
     * value that described the other equally well. `subjectId` and `productId` in the payload are
     * what ended that, and this is the assertion that says so.
     */
    it(
      "gives two subjects with identical evidence two different hashes",
      async () => {
        const { a, b } = await withDisposableClient(url, async (client) => {
          const facts = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "id" FROM "source_facts" ORDER BY "id" LIMIT 2`,
          );
          /*
           * TWO products, one probe each. `specifications_import_identity_key` is
           * `(product_id, product_grade_id, property_key) NULLS NOT DISTINCT WHERE deleted_at IS
           * NULL` (ADR-015 §2), so two probes on ONE product — both with a NULL grade and a NULL
           * property key — are the same import identity and the second insert is refused.
           */
          const products = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "id" FROM "products" ORDER BY "id" DESC LIMIT 2`,
          );

          const make = async (productId: string): Promise<string> => {
            const rows = await client.$queryRawUnsafe<{ id: string }[]>(
              `INSERT INTO "specifications" ("id", "product_id", "key", "value")
               VALUES (gen_random_uuid(), $1::uuid, 'zz_identity_probe', 'probe') RETURNING "id"`,
              productId,
            );
            const id = rows[0]?.id ?? "";
            for (const fact of facts) {
              await client.$executeRawUnsafe(
                `INSERT INTO "specification_evidence" ("specification_id", "source_fact_id", "role")
                 VALUES ($1::uuid, $2::uuid, 'primary')`,
                id,
                fact.id,
              );
            }
            return id;
          };

          return { a: await make(products[0]?.id ?? ""), b: await make(products[1]?.id ?? "") };
        });

        expect(await specificationEvidenceSetHash(prisma, a)).not.toBe(
          await specificationEvidenceSetHash(prisma, b),
        );
      },
      TIMEOUT_MS,
    );

    it(
      "changes when evidence is added and again when it is removed",
      async () => {
        const probe = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "id" FROM "specifications" WHERE "key" = 'zz_hash_probe' ORDER BY "id" LIMIT 1`,
          );
          return rows[0]?.id ?? "";
        });

        const before = await specificationEvidenceSetHash(prisma, probe);

        const extra = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "id" FROM "source_facts" ORDER BY "id" OFFSET 5 LIMIT 1`,
          );
          const factId = rows[0]?.id ?? "";
          await client.$executeRawUnsafe(
            `INSERT INTO "specification_evidence" ("specification_id", "source_fact_id", "role")
             VALUES ($1::uuid, $2::uuid, 'corroborating')`,
            probe,
            factId,
          );
          return factId;
        });

        const added = await specificationEvidenceSetHash(prisma, probe);
        expect(added).not.toBe(before);

        await withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `DELETE FROM "specification_evidence"
              WHERE "specification_id" = $1::uuid AND "source_fact_id" = $2::uuid`,
            probe,
            extra,
          ),
        );

        expect(await specificationEvidenceSetHash(prisma, probe)).toBe(before);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* Approval, and the public transition                               */
  /* ---------------------------------------------------------------- */

  describe("approving one specification", () => {
    let subject: ReviewDetailResponse;
    let productSlug = "";

    beforeAll(async () => {
      // The first eligible Specification on a product, found through the API rather than assumed.
      const page = await review.queue({ subjectType: "specification", limit: 50 });
      for (const item of page.items) {
        const detail = await review.detail("specification", item.id);
        if (detail.eligibleForApproval) {
          subject = detail;
          productSlug = item.product.slug;
          break;
        }
      }
      expect(subject).toBeDefined();
    }, TIMEOUT_MS);

    it(
      "publishes nothing before the decision",
      async () => {
        const { product } = await products.findBySlug(productSlug, EN);
        expect(product.specifications).toEqual([]);
      },
      TIMEOUT_MS,
    );

    it(
      "approves, and the public Product detail then carries exactly that one specification",
      async () => {
        const result = await review.decide(
          "specification",
          subject.id,
          {
            decision: "approve",
            expectedReviewStatus: subject.reviewStatus,
            expectedEvidenceSetHash: subject.evidenceSetHash,
          },
          ACTOR,
        );

        expect(result.reviewStatus).toBe("approved");
        expect(result.evidenceSetHash).toBe(subject.evidenceSetHash);
        expect(result.reviewerEmail).toBe(REVIEWER_EMAIL);

        const { product } = await products.findBySlug(productSlug, EN);
        expect(product.specifications).toHaveLength(1);
        expect(product.specifications[0]?.id).toBe(subject.id);

        const after = await counts(url);
        expect(after["v_specification_public"]).toBe(1);
        expect(after["specifications_approved"]).toBe(1);
      },
      TIMEOUT_MS,
    );

    /** The curated legacy DTO, unchanged by this gate: four fields and no internal one. */
    it(
      "leaks no internal field through the public response",
      async () => {
        const { product } = await products.findBySlug(productSlug, EN);
        const specification = product.specifications[0];

        expect(Object.keys(specification ?? {}).sort()).toEqual(["id", "key", "unit", "value"]);

        const serialized = JSON.stringify(product);
        for (const forbidden of FORBIDDEN_PUBLIC_KEYS) {
          expect(serialized).not.toContain(forbidden);
        }
      },
      TIMEOUT_MS,
    );

    it(
      "records one immutable review row naming exactly this subject",
      async () => {
        const history = (await review.detail("specification", subject.id)).history;

        expect(history).toHaveLength(1);
        expect(history[0]?.decision).toBe("approved");
        expect(history[0]?.reviewerEmail).toBe(REVIEWER_EMAIL);
        expect(history[0]?.reviewerId).toBe(REVIEWER_ID);
        expect(history[0]?.evidenceSetHash).toBe(subject.evidenceSetHash);
        expect(history[0]?.evidenceCurrent).toBe(true);
      },
      TIMEOUT_MS,
    );

    /** The caller's expectation was `needs_review`/`source_recorded`; it is `approved` now. */
    it(
      "answers 409 when the same request is replayed, and writes nothing",
      async () => {
        const before = await counts(url);

        const error = await refused(() =>
          review.decide(
            "specification",
            subject.id,
            {
              decision: "approve",
              expectedReviewStatus: subject.reviewStatus,
              expectedEvidenceSetHash: subject.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(409);
        expect(await counts(url)).toEqual(before);
      },
      TIMEOUT_MS,
    );

    it(
      "answers 409 for a stale evidence hash, and writes nothing",
      async () => {
        const target = await firstEligibleOtherThan(subject.id);
        const before = await counts(url);

        const error = await refused(() =>
          review.decide(
            "specification",
            target.id,
            {
              decision: "approve",
              expectedReviewStatus: target.reviewStatus,
              expectedEvidenceSetHash: "f".repeat(64),
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(409);
        expect(error.message).toContain("evidence");
        expect(await counts(url)).toEqual(before);
        expect(await status(url, "specifications", target.id)).toBe(target.reviewStatus);
      },
      TIMEOUT_MS,
    );

    it(
      "answers 409 for a stale status, and writes nothing",
      async () => {
        const target = await firstEligibleOtherThan(subject.id);
        const before = await counts(url);

        const error = await refused(() =>
          review.decide(
            "specification",
            target.id,
            {
              decision: "approve",
              // A status the row does not hold — the shape of a second reviewer's stale screen.
              expectedReviewStatus:
                target.reviewStatus === "approved" ? "needs_review" : "approved",
              expectedEvidenceSetHash: target.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(409);
        expect(await counts(url)).toEqual(before);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* Rejection                                                         */
  /* ---------------------------------------------------------------- */

  describe("rejecting a specification", () => {
    it(
      "moves it to REJECTED and keeps it out of both the view and the public API",
      async () => {
        const target = await firstEligibleOtherThan("");
        const detail = await review.detail("specification", target.id);

        const result = await review.decide(
          "specification",
          target.id,
          {
            decision: "reject",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
            note: "The source figure could not be confirmed against the supplier TDS.",
          },
          ACTOR,
        );

        expect(result.reviewStatus).toBe("rejected");
        expect(await status(url, "specifications", target.id)).toBe("rejected");

        const visible = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ n: number }[]>(
            `SELECT count(*)::int AS n FROM "v_specification_public" WHERE "id" = $1::uuid`,
            target.id,
          );
          return Number(rows[0]?.n ?? 0);
        });
        expect(visible).toBe(0);

        const { product } = await products.findBySlug(detail.product.slug, EN);
        expect(product.specifications.some((spec) => spec.id === target.id)).toBe(false);
      },
      TIMEOUT_MS,
    );

    it(
      "refuses a rejection with no note, and writes nothing",
      async () => {
        const target = await firstEligibleOtherThan("");
        const before = await counts(url);

        const error = await refused(() =>
          review.decide(
            "specification",
            target.id,
            {
              decision: "reject",
              expectedReviewStatus: target.reviewStatus,
              expectedEvidenceSetHash: target.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(400);
        expect(await counts(url)).toEqual(before);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* History, supersession of an approval by new evidence              */
  /* ---------------------------------------------------------------- */

  describe("review history and evidence revision", () => {
    it(
      "keeps every prior decision, newest first, across a sequence",
      async () => {
        const target = await firstEligibleOtherThan("");
        let detail = await review.detail("specification", target.id);

        await review.decide(
          "specification",
          target.id,
          {
            decision: "reject",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
            note: "First pass: rejected.",
          },
          ACTOR,
        );

        detail = await review.detail("specification", target.id);
        await review.decide(
          "specification",
          target.id,
          {
            decision: "return_to_needs_review",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
            note: "Second pass: reopened after the supplier confirmed the figure.",
          },
          ACTOR,
        );

        detail = await review.detail("specification", target.id);
        await review.decide(
          "specification",
          target.id,
          {
            decision: "approve",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
          },
          ACTOR,
        );

        const history = (await review.detail("specification", target.id)).history;

        expect(history.map((entry) => entry.decision)).toEqual([
          "approved",
          "needs_review",
          "rejected",
        ]);
        expect(history.every((entry) => entry.reviewerEmail === REVIEWER_EMAIL)).toBe(true);
        expect(history[2]?.note).toBe("First pass: rejected.");
      },
      TIMEOUT_MS,
    );

    /**
     * The reason the hash exists. New evidence arrives after an approval; the approval no longer
     * describes what the row rests on, the history says so, and a decision quoting the old hash is
     * refused.
     */
    it(
      "invalidates an approval when the evidence is revised, and keeps the old fact",
      async () => {
        const target = await firstEligibleOtherThan("");
        const detail = await review.detail("specification", target.id);

        await review.decide(
          "specification",
          target.id,
          {
            decision: "approve",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
          },
          ACTOR,
        );

        const originalFactId = detail.evidence[0]?.sourceFactId ?? "";
        const factsBefore = (await counts(url))["source_facts"] ?? 0;

        // A corrected reading is a NEW SourceFact plus a SUPERSEDED role on the old link — never
        // an UPDATE, which the `source_facts_immutable_guard` trigger refuses outright.
        await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "source_facts"
               ("id", "source_document_id", "import_run_id", "raw_property", "raw_value",
                "extraction_method", "unit_classification")
             SELECT gen_random_uuid(), sf."source_document_id", sf."import_run_id",
                    sf."raw_property", sf."raw_value" || ' (corrected)',
                    'manual_transcription', sf."unit_classification"
               FROM "source_facts" sf WHERE sf."id" = $1::uuid
             RETURNING "id"`,
            originalFactId,
          );
          await client.$executeRawUnsafe(
            `UPDATE "specification_evidence" SET "role" = 'superseded'
              WHERE "specification_id" = $1::uuid AND "source_fact_id" = $2::uuid`,
            target.id,
            originalFactId,
          );
          await client.$executeRawUnsafe(
            `INSERT INTO "specification_evidence" ("specification_id", "source_fact_id", "role")
             VALUES ($1::uuid, $2::uuid, 'primary')`,
            target.id,
            rows[0]?.id ?? "",
          );
        });

        const after = await review.detail("specification", target.id);

        expect(after.evidenceSetHash).not.toBe(detail.evidenceSetHash);
        // The approval is still recorded, and it is now visibly stale.
        expect(after.history[0]?.decision).toBe("approved");
        expect(after.history[0]?.evidenceSetHash).toBe(detail.evidenceSetHash);
        expect(after.history[0]?.evidenceCurrent).toBe(false);

        // The old immutable fact is still there — corrections add, they never erase.
        expect((await counts(url))["source_facts"]).toBe(factsBefore + 1);
        const stillThere = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ n: number }[]>(
            `SELECT count(*)::int AS n FROM "source_facts" WHERE "id" = $1::uuid`,
            originalFactId,
          );
          return Number(rows[0]?.n ?? 0);
        });
        expect(stillThere).toBe(1);

        // A decision quoting the hash the reviewer saw is now refused.
        const error = await refused(() =>
          review.decide(
            "specification",
            target.id,
            {
              decision: "reject",
              expectedReviewStatus: "approved",
              expectedEvidenceSetHash: detail.evidenceSetHash,
              note: "Quoting the pre-revision evidence.",
            },
            ACTOR,
          ),
        );
        expect(error.getStatus()).toBe(409);
      },
      TIMEOUT_MS,
    );

    /**
     * ── What "immutable review history" actually means, measured ────────────
     *
     * It does **not** mean the database refuses `DELETE FROM technical_reviews`. That was assumed
     * when this suite was first written and it is false: a probe deleted six review rows and
     * PostgreSQL accepted it. `source_facts` has a `BEFORE UPDATE` trigger; `technical_reviews`
     * has none, and ADR-014 §7 never claimed one. Recorded here rather than quietly dropped,
     * because an assertion that passes for the wrong reason is worse than none.
     *
     * What IS enforced, and what this test asserts:
     *
     *   1. A reviewed subject cannot be hard-deleted out from under its own history — both subject
     *      foreign keys on `technical_reviews` are `ON DELETE RESTRICT`.
     *   2. A review names exactly one subject — `technical_reviews_exactly_one_target`.
     *   3. A review names a reviewer — `technical_reviews_reviewer_named`.
     *   4. **The service never issues an UPDATE or a DELETE against the table.** It has exactly one
     *      write, `technicalReview.create`, and that is the property immutability rests on here.
     */
    it(
      "refuses to hard-delete a subject that carries review history",
      async () => {
        const reviewed = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "specification_id" AS "id" FROM "technical_reviews"
              WHERE "specification_id" IS NOT NULL LIMIT 1`,
          );
          return rows[0]?.id ?? "";
        });
        expect(reviewed).not.toBe("");

        await expect(
          withDisposableClient(url, (client) =>
            client.$executeRawUnsafe(
              `DELETE FROM "specifications" WHERE "id" = $1::uuid`,
              reviewed,
            ),
          ),
        ).rejects.toThrow();
      },
      TIMEOUT_MS,
    );

    it(
      "refuses a review that names two subjects, none, or no reviewer",
      async () => {
        const ids = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ spec: string; claim: string }[]>(
            `SELECT (SELECT "id"::text FROM "specifications" LIMIT 1) AS "spec",
                    (SELECT "id"::text FROM "product_claims" LIMIT 1) AS "claim"`,
          );
          return rows[0] ?? { spec: "", claim: "" };
        });

        const insert = (
          spec: string | null,
          claim: string | null,
          email: string,
        ): Promise<unknown> =>
          withDisposableClient(url, (client) =>
            client.$executeRawUnsafe(
              `INSERT INTO "technical_reviews"
                 ("id", "specification_id", "product_claim_id", "reviewer_id",
                  "reviewer_email_snapshot", "decision", "evidence_set_hash")
               VALUES (gen_random_uuid(), $1::uuid, $2::uuid, NULL, $3, 'approved', $4)`,
              spec,
              claim,
              email,
              "0".repeat(64),
            ),
          );

        await expect(insert(ids.spec, ids.claim, REVIEWER_EMAIL)).rejects.toThrow();
        await expect(insert(null, null, REVIEWER_EMAIL)).rejects.toThrow();
        await expect(insert(ids.spec, null, "   ")).rejects.toThrow();
      },
      TIMEOUT_MS,
    );

    /** The one write this service makes to the audit table. There is no second one. */
    it(
      "never updates or deletes a review row from the service",
      () => {
        const source: string = require("node:fs").readFileSync(
          require.resolve("./catalog-review.service.ts"),
          "utf8",
        );

        expect(source).toContain("technicalReview.create");
        expect(source).not.toContain("technicalReview.update");
        expect(source).not.toContain("technicalReview.delete");
        expect(source).not.toContain("technicalReview.upsert");
        expect(source).not.toMatch(/DELETE FROM "?technical_reviews/i);
        expect(source).not.toMatch(/UPDATE "?technical_reviews/i);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* Concurrency and rollback                                          */
  /* ---------------------------------------------------------------- */

  describe("two reviewers at once", () => {
    it(
      "lets exactly one win and answers the other 409",
      async () => {
        const target = await firstEligibleOtherThan("");
        const detail = await review.detail("specification", target.id);

        const request = {
          decision: "approve" as const,
          expectedReviewStatus: detail.reviewStatus,
          expectedEvidenceSetHash: detail.evidenceSetHash,
        };

        const outcomes = await Promise.allSettled([
          review.decide("specification", target.id, request, ACTOR),
          review.decide("specification", target.id, request, ACTOR),
        ]);

        const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
        const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        const reason = (rejected[0] as PromiseRejectedResult).reason as ApiException;
        expect(reason.getStatus()).toBe(409);

        // One decision, one history row. The loser wrote nothing.
        const history = (await review.detail("specification", target.id)).history;
        expect(history).toHaveLength(1);
        expect(await status(url, "specifications", target.id)).toBe("approved");
      },
      TIMEOUT_MS,
    );

    /**
     * The rule that makes the case above hold in every combination rather than most of them: a
     * second approval of a row that is already approved is refused as a no-op, so it can never
     * add a decision that decided nothing.
     */
    it(
      "refuses a decision that would not change the status",
      async () => {
        const approved = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "id" FROM "specifications" WHERE "review_status" = 'approved' LIMIT 1`,
          );
          return rows[0]?.id ?? "";
        });
        expect(approved).not.toBe("");

        const detail = await review.detail("specification", approved);
        const before = await counts(url);

        const error = await refused(() =>
          review.decide(
            "specification",
            approved,
            {
              decision: "approve",
              expectedReviewStatus: "approved",
              expectedEvidenceSetHash: detail.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(400);
        expect(await counts(url)).toEqual(before);
      },
      TIMEOUT_MS,
    );
  });

  /**
   * ── Why the rollback proof is shaped like this ────────────────────────────
   *
   * Every refusal the API can produce happens BEFORE the `TechnicalReview` insert, and the tests
   * above assert that each one leaves the counts untouched. There is deliberately no seam through
   * which a caller can make the service fail AFTER the insert — that is the design, not a gap.
   *
   * So the rollback is proved on the exact write pair the service performs: insert the review, move
   * the status, then abort. Both must vanish together. A shape where one survived would mean an
   * approved row with no review, or a review describing a status that was never set.
   */
  describe("the transaction boundary", () => {
    it(
      "leaves the subject and its history unchanged when the transaction aborts",
      async () => {
        const target = await firstEligibleOtherThan("");
        const before = await counts(url);
        const beforeStatus = await status(url, "specifications", target.id);

        await expect(
          prisma.$transaction(async (tx) => {
            await tx.technicalReview.create({
              data: {
                specificationId: target.id,
                reviewerId: REVIEWER_ID,
                reviewerEmailSnapshot: REVIEWER_EMAIL,
                decision: "APPROVED",
                evidenceSetHash: target.evidenceSetHash,
                evidenceHashVersion: "spec-review-v2",
              },
            });
            await tx.specification.update({
              where: { id: target.id },
              data: { reviewStatus: "APPROVED" },
            });
            throw new Error("Deliberate abort inside the review transaction.");
          }),
        ).rejects.toThrow("Deliberate abort");

        expect(await counts(url)).toEqual(before);
        expect(await status(url, "specifications", target.id)).toBe(beforeStatus);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* The database guards, seen from the service                        */
  /* ---------------------------------------------------------------- */

  /**
   * Migration 20260825120000 moved two invariants out of this service and into the database
   * (ADR-016). `verify-catalog-technical-data.sh` proves them exhaustively in SQL; what these
   * add is the pairing — that the SERVICE's write sequence is one the gate accepts, and that
   * the shortcut the service deliberately does not take is one the gate refuses.
   *
   * Without both halves a green suite would be ambiguous: a service that never approves anything
   * also never trips the gate.
   */
  describe("the database approval gate", () => {
    it(
      "refuses a direct UPDATE into approved, from application code like any other caller",
      async () => {
        const target = await firstEligibleOtherThan("");
        const before = await counts(url);

        await expect(
          withDisposableClient(url, (client) =>
            client.$executeRawUnsafe(
              `UPDATE "specifications" SET "review_status" = 'approved' WHERE "id" = $1::uuid`,
              target.id,
            ),
          ),
        ).rejects.toThrow(/without a matching TechnicalReview recorded in this transaction/);

        expect(await counts(url)).toEqual(before);
        expect(await status(url, "specifications", target.id)).toBe(target.reviewStatus);
      },
      TIMEOUT_MS,
    );

    it(
      "refuses a Specification inserted already approved",
      async () => {
        const productId = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT "id" FROM "products" ORDER BY "id" LIMIT 1`,
          );
          return rows[0]?.id ?? "";
        });

        await expect(
          withDisposableClient(url, (client) =>
            client.$executeRawUnsafe(
              `INSERT INTO "specifications" ("id","product_id","key","value","review_status")
               VALUES (gen_random_uuid(), $1::uuid, 'zz_gate', 'v', 'approved')`,
              productId,
            ),
          ),
        ).rejects.toThrow(/cannot be created already approved/);
      },
      TIMEOUT_MS,
    );

    /**
     * The pairing. The service inserts the `TechnicalReview` and then updates the status, both
     * inside one interactive transaction — which is exactly the shape the gate requires. If that
     * order were ever reversed, or the two split across transactions, this fails.
     */
    it(
      "accepts the review service's own sequence, and commits both rows together",
      async () => {
        const target = await firstEligibleOtherThan("");
        const detail = await review.detail("specification", target.id);

        const result = await review.decide(
          "specification",
          target.id,
          {
            decision: "approve",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
          },
          ACTOR,
        );

        const committed = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ st: string; n: number }[]>(
            `SELECT s."review_status"::text AS st,
                    (SELECT count(*)::int FROM "technical_reviews" tr
                      WHERE tr."specification_id" = s."id" AND tr."decision" = 'approved') AS n
               FROM "specifications" s WHERE s."id" = $1::uuid`,
            target.id,
          );
          return rows[0];
        });

        expect(result.reviewStatus).toBe("approved");
        expect(committed?.st).toBe("approved");
        expect(Number(committed?.n)).toBe(1);
      },
      TIMEOUT_MS,
    );

    /**
     * The attribution boundary, case by case. Each attempt writes a review in the SAME
     * transaction as the status change — so the only thing separating it from a valid approval is
     * the single field under test, and a refusal can only be attributed to that field.
     */
    describe("a same-transaction review that is wrong in exactly one way", () => {
      /** Runs `INSERT review; UPDATE status` in one transaction and returns the error, if any. */
      async function attempt(
        specId: string,
        review: {
          subjectId: string;
          decision: string;
          hash: string;
          email: string;
          /** ADR-017. Defaults to the correct one, so only a case that means to get it wrong does. */
          version?: string;
        },
      ): Promise<string | null> {
        try {
          await withDisposableClient(url, (client) =>
            client.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(
                `INSERT INTO "technical_reviews"
                   ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision",
                    "evidence_set_hash","evidence_hash_version")
                 VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3,
                         $4::technical_review_decision, $5, $6)`,
                review.subjectId,
                REVIEWER_ID,
                review.email,
                review.decision,
                review.hash,
                review.version ?? "spec-review-v2",
              );
              await tx.$executeRawUnsafe(
                `UPDATE "specifications" SET "review_status" = 'approved' WHERE "id" = $1::uuid`,
                specId,
              );
            }),
          );
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }

      it(
        "refuses every wrong shape, and accepts the one right one",
        async () => {
          const subject = await firstEligibleOtherThan("");
          const other = await firstEligibleOtherThan(subject.id);
          const good = subject.evidenceSetHash;

          // Wrong subject.
          expect(
            await attempt(subject.id, {
              subjectId: other.id,
              decision: "approved",
              hash: other.evidenceSetHash,
              email: REVIEWER_EMAIL,
            }),
          ).toMatch(/without a matching TechnicalReview recorded in this transaction/);

          // Stale evidence hash.
          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "approved",
              hash: "f".repeat(64),
              email: REVIEWER_EMAIL,
            }),
          ).toMatch(/without a matching TechnicalReview recorded in this transaction/);

          // Decision REJECTED.
          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "rejected",
              hash: good,
              email: REVIEWER_EMAIL,
            }),
          ).toMatch(/without a matching TechnicalReview recorded in this transaction/);

          // Decision NEEDS_REVIEW.
          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "needs_review",
              hash: good,
              email: REVIEWER_EMAIL,
            }),
          ).toMatch(/without a matching TechnicalReview recorded in this transaction/);

          // Blank reviewer snapshot — caught by `technical_reviews_reviewer_named` at INSERT,
          // and the gate's own `length(btrim(...)) > 0` is the second lock behind it.
          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "approved",
              hash: good,
              email: "   ",
            }),
          ).toMatch(/reviewer_named|violates check constraint/i);

          /*
           * ADR-017 — the hash VERSION, wrong in each of the two ways it can be.
           *
           * A Specification review quoting `claim-review-v2` is refused by
           * `technical_reviews_hash_version_matches_subject`: the row is inconsistent with its own
           * subject and never reaches the gate.
           *
           * A review quoting a version this build does not implement passes that CHECK — the
           * constraint only relates the column to the subject — and is refused by the GATE, which
           * requires the version to equal the definition it just used. The two tests are not
           * redundant: they diverge exactly when a hash definition changes, which is the moment
           * they have to hold.
           */
          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "approved",
              hash: good,
              email: REVIEWER_EMAIL,
              version: "claim-review-v2",
            }),
          ).toMatch(/hash_version_matches_subject|violates check constraint/i);

          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "approved",
              hash: good,
              email: REVIEWER_EMAIL,
              version: "spec-review-v3",
            }),
          ).toMatch(
            /hash_version_matches_subject|violates check constraint|without a matching TechnicalReview recorded in this transaction/i,
          );

          // Nothing above moved the row.
          expect(await status(url, "specifications", subject.id)).toBe(subject.reviewStatus);

          // The one correct shape. Same transaction, right subject, approve, live hash, named
          // reviewer — accepted.
          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "approved",
              hash: good,
              email: REVIEWER_EMAIL,
            }),
          ).toBeNull();
          expect(await status(url, "specifications", subject.id)).toBe("approved");
        },
        TIMEOUT_MS,
      );

      /**
       * The limit, asserted so it cannot be mistaken for enforcement.
       *
       * The gate requires a non-blank `reviewer_email_snapshot`; it does NOT require that the
       * snapshot names the authenticated caller, because PostgreSQL cannot see the HTTP session.
       * A review naming a different real person is therefore ACCEPTED by the database. What makes
       * that unreachable through the API is structural, not a database check: the decision DTO
       * declares no reviewer field, and the service writes the identity from the guard-supplied
       * `AuthenticatedUser`. See ADR-016 §16.
       */
      it(
        "accepts a differently-attributed review — the DB cannot know the caller (ADR-016 §16)",
        async () => {
          const subject = await firstEligibleOtherThan("");

          expect(
            await attempt(subject.id, {
              subjectId: subject.id,
              decision: "approved",
              hash: subject.evidenceSetHash,
              email: "someone.else@samgp.test",
            }),
          ).toBeNull();

          // Recorded, attributable and evidence-current — which is the invariant the database
          // guarantees. WHO it names is the API's responsibility, and it is proved separately by
          // the DTO and service tests.
          const named = await withDisposableClient(url, async (client) => {
            const rows = await client.$queryRawUnsafe<{ e: string }[]>(
              `SELECT "reviewer_email_snapshot" AS e FROM "technical_reviews"
                WHERE "specification_id" = $1::uuid ORDER BY "reviewed_at" DESC LIMIT 1`,
              subject.id,
            );
            return rows[0]?.e;
          });
          expect(named).toBe("someone.else@samgp.test");
        },
        TIMEOUT_MS,
      );
    });

    it(
      "refuses to reuse the review it just wrote to re-approve after a rejection",
      async () => {
        // Take the row approved by the previous test back out of `approved` — ungated — and then
        // try to walk it back in with no NEW review. The historical one must not count.
        const approved = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ id: string }[]>(
            `SELECT s."id" FROM "specifications" s
              WHERE s."review_status" = 'approved'
                AND EXISTS (SELECT 1 FROM "technical_reviews" tr WHERE tr."specification_id" = s."id")
              LIMIT 1`,
          );
          return rows[0]?.id ?? "";
        });
        expect(approved).not.toBe("");

        await withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(
            `UPDATE "specifications" SET "review_status" = 'rejected' WHERE "id" = $1::uuid`,
            approved,
          ),
        );

        await expect(
          withDisposableClient(url, (client) =>
            client.$executeRawUnsafe(
              `UPDATE "specifications" SET "review_status" = 'approved' WHERE "id" = $1::uuid`,
              approved,
            ),
          ),
        ).rejects.toThrow(/without a matching TechnicalReview recorded in this transaction/);

        expect(await status(url, "specifications", approved)).toBe("rejected");
      },
      TIMEOUT_MS,
    );
  });

  describe("the database immutability guard", () => {
    it.each([
      ["note", `SET "note" = 'rewritten'`],
      ["decision", `SET "decision" = 'rejected'`],
      ["evidence hash", `SET "evidence_set_hash" = repeat('0',64)`],
      ["reviewer snapshot", `SET "reviewer_email_snapshot" = 'someone@example.invalid'`],
    ])("refuses to rewrite the %s of a recorded review", async (_field, clause) => {
      await expect(
        withDisposableClient(url, (client) =>
          client.$executeRawUnsafe(`UPDATE "technical_reviews" ${clause}`),
        ),
      ).rejects.toThrow(/immutable review history/);
    });

    it(
      "refuses to delete a recorded review",
      async () => {
        const before = (await counts(url))["technical_reviews"] ?? 0;
        expect(before).toBeGreaterThan(0);

        await expect(
          withDisposableClient(url, (client) =>
            client.$executeRawUnsafe(`DELETE FROM "technical_reviews"`),
          ),
        ).rejects.toThrow(/immutable review history/);

        expect((await counts(url))["technical_reviews"]).toBe(before);
      },
      TIMEOUT_MS,
    );

    /**
     * ADR-012 makes deleting a User this platform's strongest credential revocation, and ADR-014 §7
     * chose `ON DELETE SET NULL` so an approved specification could never block an off-boarding.
     * PostgreSQL implements SET NULL as an UPDATE on `technical_reviews` — so a blanket ban would
     * have broken it. It did, in the first version of this trigger; this is the test that says so.
     */
    it(
      "still lets a reviewer's account be deleted, and the snapshot survives it",
      async () => {
        /*
         * Self-contained on its OWN reviewer, deliberately. Deleting `ACTOR` would break every
         * later test in this file on the `technical_reviews.reviewer_id` foreign key — which is
         * itself a small demonstration of why that key exists.
         */
        const secondId = "dddd3333-0000-4000-8000-00000000feed";
        const secondEmail = "off-boarded@samgp.test";
        const reviewsBefore = (await counts(url))["technical_reviews"] ?? 0;

        const target = await firstEligibleOtherThan("");

        await withDisposableClient(url, async (client) => {
          await client.$executeRawUnsafe(
            `INSERT INTO "users" ("id","email","password_hash","role")
             VALUES ($1::uuid, $2, 'not-a-credential', 'admin')`,
            secondId,
            secondEmail,
          );
          // A REJECTION, so this needs no approval gate — the point here is the reviewer link.
          await client.$executeRawUnsafe(
            `INSERT INTO "technical_reviews"
               ("id","specification_id","reviewer_id","reviewer_email_snapshot","decision",
                "evidence_set_hash","evidence_hash_version")
             VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'rejected',
                     "specification_review_hash_v2"($1::uuid), 'spec-review-v2')`,
            target.id,
            secondId,
            secondEmail,
          );
          // ADR-012's strongest credential revocation. It must not be blocked by review history.
          await client.$executeRawUnsafe(`DELETE FROM "users" WHERE "id" = $1::uuid`, secondId);
        });

        const after = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ n: number; ids: number }[]>(
            `SELECT count(*)::int AS n,
                    count(*) FILTER (WHERE "reviewer_id" IS NOT NULL)::int AS ids
               FROM "technical_reviews" WHERE "reviewer_email_snapshot" = $1`,
            secondEmail,
          );
          return rows[0];
        });

        // The review survives, still names them, and holds no dangling id.
        expect(Number(after?.n)).toBe(1);
        expect(Number(after?.ids)).toBe(0);
        expect((await counts(url))["technical_reviews"]).toBe(reviewsBefore + 1);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* Forbidden claims                                                  */
  /* ---------------------------------------------------------------- */

  describe("product claims", () => {
    it(
      "refuses to approve a REFERENCE_ONLY claim, and writes nothing",
      async () => {
        const item = (await review.queue({ claimKind: "reference_only", limit: 1 }))
          .items[0] as ReviewQueueItemResponse;
        const detail = await review.detail("product_claim", item.id);
        const before = await counts(url);

        const error = await refused(() =>
          review.decide(
            "product_claim",
            item.id,
            {
              decision: "approve",
              expectedReviewStatus: detail.reviewStatus,
              expectedEvidenceSetHash: detail.evidenceSetHash,
            },
            ACTOR,
          ),
        );

        expect(error.getStatus()).toBe(409);
        expect(await counts(url)).toEqual(before);
        expect(await status(url, "product_claims", item.id)).toBe(detail.reviewStatus);
      },
      TIMEOUT_MS,
    );

    it(
      "approves an eligible claim without publishing it anywhere",
      async () => {
        const page = await review.queue({ subjectType: "product_claim", limit: 40 });
        let approved = false;

        for (const item of page.items) {
          const detail = await review.detail("product_claim", item.id);
          if (!detail.eligibleForApproval) continue;

          await review.decide(
            "product_claim",
            item.id,
            {
              decision: "approve",
              expectedReviewStatus: detail.reviewStatus,
              expectedEvidenceSetHash: detail.evidenceSetHash,
            },
            ACTOR,
          );
          expect(await status(url, "product_claims", item.id)).toBe("approved");
          approved = true;
          break;
        }

        expect(approved).toBe(true);

        /*
         * An approved claim reaches `v_product_claim_public`, and NOTHING READS THAT VIEW. There
         * is no public claim contract in this gate and none is created by it: the public Product
         * detail's shape is unchanged, and a claim never appears on it.
         */
        const { product } = await products.findBySlug(
          (await review.queue({ subjectType: "product_claim", limit: 1 })).items[0]?.product.slug ??
            "",
          EN,
        );
        expect(JSON.stringify(product)).not.toContain("claim");
      },
      TIMEOUT_MS,
    );

    it(
      "can reject a claim, and it stays out of the public view",
      async () => {
        const page = await review.queue({ subjectType: "product_claim", limit: 40 });
        const candidate = page.items.find((item) => item.reviewStatus !== "approved");
        expect(candidate).toBeDefined();
        const item = candidate as ReviewQueueItemResponse;
        const detail = await review.detail("product_claim", item.id);

        await review.decide(
          "product_claim",
          item.id,
          {
            decision: "reject",
            expectedReviewStatus: detail.reviewStatus,
            expectedEvidenceSetHash: detail.evidenceSetHash,
            note: "Not a statement this platform will publish.",
          },
          ACTOR,
        );

        const visible = await withDisposableClient(url, async (client) => {
          const rows = await client.$queryRawUnsafe<{ n: number }[]>(
            `SELECT count(*)::int AS n FROM "v_product_claim_public" WHERE "id" = $1::uuid`,
            item.id,
          );
          return Number(rows[0]?.n ?? 0);
        });
        expect(visible).toBe(0);
      },
      TIMEOUT_MS,
    );
  });

  /* ---------------------------------------------------------------- */
  /* Soft deletion and supersession stay non-public                    */
  /* ---------------------------------------------------------------- */

  it(
    "keeps an approved specification out of the public API once it is retired or superseded",
    async () => {
      const target = await firstEligibleOtherThan("");
      const detail = await review.detail("specification", target.id);

      await review.decide(
        "specification",
        target.id,
        {
          decision: "approve",
          expectedReviewStatus: detail.reviewStatus,
          expectedEvidenceSetHash: detail.evidenceSetHash,
        },
        ACTOR,
      );

      const publicAfterApproval = await products.findBySlug(detail.product.slug, EN);
      expect(publicAfterApproval.product.specifications.some((s) => s.id === target.id)).toBe(true);

      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `UPDATE "specifications" SET "deleted_at" = now() WHERE "id" = $1::uuid`,
          target.id,
        ),
      );

      const publicAfterRetire = await products.findBySlug(detail.product.slug, EN);
      expect(publicAfterRetire.product.specifications.some((s) => s.id === target.id)).toBe(false);

      await withDisposableClient(url, (client) =>
        client.$executeRawUnsafe(
          `UPDATE "specifications" SET "deleted_at" = NULL, "review_status" = 'superseded'
            WHERE "id" = $1::uuid`,
          target.id,
        ),
      );

      const publicAfterSupersede = await products.findBySlug(detail.product.slug, EN);
      expect(publicAfterSupersede.product.specifications.some((s) => s.id === target.id)).toBe(
        false,
      );
    },
    TIMEOUT_MS,
  );

  /**
   * The first eligible Specification that is not `excludeId` and has no decision yet.
   *
   * Found through the API on every call rather than cached: earlier tests approve and reject rows,
   * so a cached candidate would be stale and the failure would look like an eligibility bug.
   */
  /**
   * Every subject's eligibility, computed with the PRODUCTION SQL and the PRODUCTION builders.
   *
   * Not a second implementation of the rules: `SPECIFICATION_ELIGIBILITY_SQL` and
   * `PRODUCT_CLAIM_ELIGIBILITY_SQL` are the exact strings the decision transaction runs, and the
   * blockers are built by the same two exported functions the service calls. A divergence between
   * this census and the service is therefore impossible by construction, which is what makes the
   * ratified counts meaningful rather than merely reproduced.
   *
   * One statement per subject, run in bounded batches so 1,546 probes do not open 1,546
   * connections. Slow by design, and inside a 180 s timeout.
   */
  async function eligibilityCensus(): Promise<Record<string, number>> {
    return withDisposableClient(url, async (client) => {
      const specificationIds = (
        await client.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "specifications"`)
      ).map(({ id }) => id);
      const claimIds = (
        await client.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "product_claims"`)
      ).map(({ id }) => id);

      const census = {
        specifications: specificationIds.length,
        specificationsEligible: 0,
        specificationsRequiredMethodAbsent: 0,
        specificationsMethodNotEvidenced: 0,
        specificationsSourceAssetAbsent: 0,
        specificationsMethodOrSourceUnion: 0,
        specificationsMappingUnresolved: 0,
        specificationsMethodAbsentAndUncaptured: 0,
        productClaims: claimIds.length,
        productClaimsEligible: 0,
        productClaimsSourceAssetAbsent: 0,
        productClaimsNeverApprovable: 0,
      };

      const BATCH = 25;

      for (let index = 0; index < specificationIds.length; index += BATCH) {
        const batch = specificationIds.slice(index, index + BATCH);
        const rows = await Promise.all(
          batch.map(async (id) => {
            const [row] = await client.$queryRawUnsafe<SpecificationEligibilityRow[]>(
              SPECIFICATION_ELIGIBILITY_SQL,
              id,
            );
            return row as SpecificationEligibilityRow;
          }),
        );

        for (const row of rows) {
          const codes = specificationApprovalBlockers({
            ...row,
            evidenceLinks: Number(row.evidenceLinks),
            evidenceOrphans: Number(row.evidenceOrphans),
          }).map((entry) => entry.code);

          const method = codes.includes("REQUIRED_METHOD_ABSENT");
          const unevidenced = codes.includes("METHOD_NOT_EVIDENCED");
          const uncaptured = codes.includes("SOURCE_ASSET_ABSENT");

          if (codes.length === 0) census.specificationsEligible += 1;
          if (method) census.specificationsRequiredMethodAbsent += 1;
          if (unevidenced) census.specificationsMethodNotEvidenced += 1;
          if (uncaptured) census.specificationsSourceAssetAbsent += 1;
          if (method || unevidenced || uncaptured) census.specificationsMethodOrSourceUnion += 1;
          if (method && uncaptured) census.specificationsMethodAbsentAndUncaptured += 1;
          if (codes.includes("PROPERTY_MAPPING_UNRESOLVED")) {
            census.specificationsMappingUnresolved += 1;
          }
        }
      }

      for (let index = 0; index < claimIds.length; index += BATCH) {
        const batch = claimIds.slice(index, index + BATCH);
        const rows = await Promise.all(
          batch.map(async (id) => {
            const [row] = await client.$queryRawUnsafe<ProductClaimEligibilityRow[]>(
              PRODUCT_CLAIM_ELIGIBILITY_SQL,
              id,
            );
            return row as ProductClaimEligibilityRow;
          }),
        );

        for (const row of rows) {
          const codes = productClaimApprovalBlockers({
            ...row,
            evidenceLinks: Number(row.evidenceLinks),
            evidenceOrphans: Number(row.evidenceOrphans),
          }).map((entry) => entry.code);

          if (codes.length === 0) census.productClaimsEligible += 1;
          if (codes.includes("SOURCE_ASSET_ABSENT")) census.productClaimsSourceAssetAbsent += 1;
          if (codes.includes("CLAIM_KIND_NEVER_APPROVABLE")) {
            census.productClaimsNeverApprovable += 1;
          }
        }
      }

      return census;
    });
  }

  /**
   * The first UNDECIDED Specification whose detail carries `code`.
   *
   * Undecided so the decision reaches the eligibility step rather than being refused earlier for
   * being non-decidable, and found through the real detail response so the test cannot pass against
   * a row the service does not actually block.
   */
  async function findBlockedSpecification(
    code: keyof typeof BLOCKED_CANDIDATE_SQL,
  ): Promise<ReviewDetailResponse> {
    const rows = await withDisposableClient(url, (client) =>
      client.$queryRawUnsafe<{ id: string }[]>(BLOCKED_CANDIDATE_SQL[code]),
    );

    for (const { id } of rows) {
      const detail = await review.detail("specification", id);
      if (detail.approvalBlockers.some((entry) => entry.code === code)) return detail;
    }

    throw new Error(`No undecided Specification carried the blocker ${code}.`);
  }

  async function firstEligibleOtherThan(excludeId: string): Promise<ReviewDetailResponse> {
    const page = await review.queue({ subjectType: "specification", limit: 200 });

    for (const item of page.items) {
      if (item.id === excludeId || item.reviewCount > 0) continue;
      if (item.propertyKey === null) continue;
      // Only rows no decision has touched. `reviewCount` alone was not enough: an earlier version
      // of this suite deleted review rows, which reset the count while leaving the status moved.
      if (item.reviewStatus !== "source_recorded" && item.reviewStatus !== "needs_review") continue;
      const detail = await review.detail("specification", item.id);
      if (detail.eligibleForApproval) return detail;
    }

    throw new Error("No eligible, undecided Specification remained in the first 200 queue rows.");
  }
});
