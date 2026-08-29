import { COOLANT_NORMALIZATION_PATCH_ID } from "./patch";

import type { IncrementalApplyResult, IncrementalInspection } from "../apply/incremental-executor";

const TARGET_DATABASE = "sam_platform";
export const INCREMENTAL_CONFIRMATION_PHRASE = "APPLY CATALOG INCREMENT TO SAM_PLATFORM";

export interface IncrementalArguments {
  readonly mode: "dry-run" | "apply";
  readonly patchId: typeof COOLANT_NORMALIZATION_PATCH_ID;
  readonly expectedPatchHash: string | null;
  readonly targetDatabase: string | null;
  readonly backupAttestation: string | null;
  readonly confirmationPhrase: string | null;
}

export interface IncrementalDatabase {
  inspect(): Promise<IncrementalInspection>;
  apply(expectedPatchHash: string, expectedDatabaseName: string): Promise<IncrementalApplyResult>;
}

function valueAfter(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseIncrementalArguments(argv: readonly string[]): IncrementalArguments {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) throw new Error("Pass exactly one of --dry-run or --apply.");

  const known = new Set([
    "--dry-run",
    "--apply",
    "--patch",
    "--expect-patch-hash",
    "--target-database",
    "--backup-attestation",
    "--confirm",
  ]);
  for (const argument of argv) {
    if (argument.startsWith("--") && !known.has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const patch = valueAfter(argv, "--patch");
  if (patch !== COOLANT_NORMALIZATION_PATCH_ID) {
    throw new Error(`--patch must be exactly ${COOLANT_NORMALIZATION_PATCH_ID}.`);
  }

  const expectedPatchHash = valueAfter(argv, "--expect-patch-hash")?.toLowerCase() ?? null;
  const targetDatabase = valueAfter(argv, "--target-database");
  const backupAttestation = valueAfter(argv, "--backup-attestation");
  const confirmationPhrase = valueAfter(argv, "--confirm");

  if (apply) {
    if (!expectedPatchHash || !/^[0-9a-f]{64}$/.test(expectedPatchHash)) {
      throw new Error("--apply requires --expect-patch-hash with a lowercase SHA-256 digest.");
    }
    if (targetDatabase !== TARGET_DATABASE) {
      throw new Error(`--apply requires --target-database ${TARGET_DATABASE}.`);
    }
    if (!backupAttestation || backupAttestation.trim().length < 16) {
      throw new Error("--apply requires a non-trivial --backup-attestation.");
    }
    if (confirmationPhrase !== INCREMENTAL_CONFIRMATION_PHRASE) {
      throw new Error(`--confirm must be exactly "${INCREMENTAL_CONFIRMATION_PHRASE}".`);
    }
  } else if (
    expectedPatchHash !== null ||
    targetDatabase !== null ||
    backupAttestation !== null ||
    confirmationPhrase !== null
  ) {
    throw new Error("Apply confirmations are accepted only with --apply.");
  }

  return {
    mode: apply ? "apply" : "dry-run",
    patchId: COOLANT_NORMALIZATION_PATCH_ID,
    expectedPatchHash,
    targetDatabase,
    backupAttestation,
    confirmationPhrase,
  };
}

export function renderIncrementalInspection(inspection: IncrementalInspection): string {
  const lines = [
    `patch                     ${inspection.patchId}`,
    `patch hash                ${inspection.patchHash}`,
    `database                  ${inspection.databaseName}`,
    `state                     ${inspection.state}`,
    `SpecProperties            ${String(inspection.planned.specProperties)}`,
    `mapping updates           ${String(inspection.planned.mappingUpdates)}`,
    `Specifications            ${String(inspection.planned.specifications)}`,
    `evidence links            ${String(inspection.planned.evidenceLinks)}`,
    `publications              0`,
    `source mutations          0`,
  ];
  for (const conflict of inspection.conflicts) lines.push(`conflict                  ${conflict}`);
  return lines.join("\n");
}

export async function runIncrementalCatalog(
  argv: readonly string[],
  database: IncrementalDatabase,
  log: (message: string) => void = console.log,
): Promise<number> {
  const args = parseIncrementalArguments(argv);
  const inspection = await database.inspect();
  log(renderIncrementalInspection(inspection));

  if (inspection.state === "CONFLICT") {
    throw new Error("Incremental patch preflight found conflicts; nothing was written.");
  }
  if (args.mode === "dry-run") {
    log("result                    dry run; nothing was written");
    return 0;
  }
  if (inspection.patchHash !== args.expectedPatchHash) {
    throw new Error("--expect-patch-hash does not match the inspected patch.");
  }
  if (inspection.databaseName !== args.targetDatabase) {
    throw new Error("The connected database does not match the confirmed target.");
  }

  const result = await database.apply(args.expectedPatchHash, args.targetDatabase);
  log(`result                    ${result.wrote ? "applied" : "already applied; no write"}`);
  log(`review hashes verified    ${String(result.reviewHashesVerified)}`);
  log(`public specifications     ${String(result.publicSpecifications)}`);
  log(`import run                ${result.importRunId ?? "none"}`);
  return 0;
}
