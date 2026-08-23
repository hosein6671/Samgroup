/**
 * Builds the authoritative plan for a given disposable database.
 *
 * ── One planner, read from the database it is about to be applied to ────────
 *
 * There is no second planner here and no fixture standing in for one: this calls
 * `buildImportPlan` with the same three database-derived inputs the CLI passes it — the live
 * slug namespace, the slug claims' owners, and the `sourceRef`s already persisted. That is
 * what makes the same function say INSERT against an empty catalogue and SKIP against a
 * full one, and it is the property the replay tests exist to check.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { parseRatifiedLedger } from "../../identity-ledger";
import { buildImportPlan } from "../../import-planner";
import { buildManifest } from "../../manifest";
import { parseCatalogWorkbook } from "../../workbook-parser";

import { withDisposableClient } from "./disposable-database";

import type { ImportPlan } from "../../catalog-import.types";

const LEDGER_PATH = require.resolve("../../data/catalog-identity-ledger.json");

export interface PlannedInputs {
  readonly plan: ImportPlan;
  readonly manifestHash: string;
  readonly workbookSha256: string;
  readonly ledgerSha256: string;
}

export async function buildPlanFor(url: string, workbookPath: string): Promise<PlannedInputs> {
  const bytes = readFileSync(workbookPath);
  const workbookSha256 = createHash("sha256").update(bytes).digest("hex");
  const ledgerText = readFileSync(LEDGER_PATH, "utf8");
  const ledgerSha256 = createHash("sha256").update(ledgerText, "utf8").digest("hex");
  const ratified = parseRatifiedLedger(ledgerText, LEDGER_PATH);

  const observed = await withDisposableClient(url, async (client) => {
    const claims = await client.$queryRawUnsafe<{ slug_key: string; source_ref: string | null }[]>(
      `SELECT c.slug_key, p.source_ref FROM product_slug_claims c
         LEFT JOIN products p ON c.owner_type = 'Product' AND p.id = c.owner_id`,
    );
    const refs = await client.$queryRawUnsafe<{ source_ref: string }[]>(
      `SELECT source_ref FROM products WHERE source_ref IS NOT NULL`,
    );
    return {
      slugKeys: new Set(claims.map((row) => row.slug_key)),
      owners: new Map(claims.map((row) => [row.slug_key, row.source_ref ?? null])),
      refs: new Set(refs.map((row) => row.source_ref)),
    };
  });

  const plan = buildImportPlan({
    workbook: parseCatalogWorkbook(bytes),
    workbookFileName: workbookPath.split(/[\\/]/).pop() ?? "workbook.xlsx",
    workbookSha256,
    workbookByteSize: bytes.byteLength,
    workbookProvenance: "AUTHORITATIVE_WORKBOOK",
    existingSlugKeys: observed.slugKeys,
    existingSlugKeyOwners: observed.owners,
    existingSourceRefs: observed.refs,
    ledger: ratified.entries,
  });

  return {
    plan,
    manifestHash: buildManifest(plan).manifestHash,
    workbookSha256,
    ledgerSha256,
  };
}
