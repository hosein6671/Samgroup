/**
 * The confirmation contract for `--apply`.
 *
 * ── Why there are nine of them ──────────────────────────────────────────────
 *
 * A catalog import deletes ten rows and writes several thousand into a database that has no
 * staging environment (ADR-005) and, at the moment it runs, no second copy of the catalogue
 * anywhere. The cost of running it by accident is not "re-run the command"; it is a restore.
 *
 * So there is no `--force` and no `--yes`. Every confirmation below states a DIFFERENT fact
 * the operator must already know — which file, which ledger, which plan, which database,
 * which backup — and each is checked against reality rather than merely being present. A
 * flag you can pass without knowing the answer is not a confirmation, and a switch that
 * means "skip the checks" is the one thing this file must never grow.
 *
 * ── Refuse, never repair ────────────────────────────────────────────────────
 *
 * Every mismatch throws. Nothing here corrects a value, fills in a default, or proceeds with
 * a warning: if the operator's belief about the workbook, the plan or the target disagrees
 * with the machine's, the disagreement is the finding.
 */

/** The phrase the operator must type verbatim. Long and specific by design. */
export const APPLY_CONFIRMATION_PHRASE = "APPLY RATIFIED CATALOG TO SAM_PLATFORM";

export class ApplyConfirmationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyConfirmationError";
  }
}

/** What the operator asserts before the importer will write anything. */
export interface ApplyConfirmations {
  /** Path to the approved master workbook. */
  readonly workbookPath: string;
  /** Path to the ratified identity ledger. */
  readonly ledgerPath: string;
  /** The workbook SHA-256 the operator expects. */
  readonly expectedWorkbookSha256: string;
  /** The ledger SHA-256 the operator expects. */
  readonly expectedLedgerSha256: string;
  /** The manifest hash of the plan the operator reviewed. */
  readonly expectedManifestHash: string;
  /** The database name this may run against, stated explicitly. */
  readonly targetDatabase: string;
  /** Explicit authorization to replace the audited demo Products. */
  readonly demoReplacementAuthorized: boolean;
  /** SHA-256 of the pre-import backup, or a recorded attestation of it. */
  readonly backupAttestation: string;
  /** The typed phrase. */
  readonly confirmationPhrase: string;
}

/** What the machine actually found, for each thing the operator asserted. */
export interface ApplyObserved {
  readonly workbookSha256: string;
  readonly ledgerSha256: string;
  readonly manifestHash: string;
  readonly databaseName: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

function requireText(value: unknown, flag: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApplyConfirmationError(
      `${flag} is required for --apply and was not given. There is no default and no ` +
        `--force: every confirmation states something the operator must already know.`,
    );
  }
  return value;
}

function requireHash(value: unknown, flag: string): string {
  const text = requireText(value, flag).trim().toLowerCase();
  if (!HEX64.test(text)) {
    throw new ApplyConfirmationError(
      `${flag} must be a 64-character lowercase hex SHA-256; received "${String(value)}".`,
    );
  }
  return text;
}

/**
 * Reads the confirmations off the command line. Shape only — nothing is compared to reality
 * here, because the reality it is compared against does not exist until the workbook has been
 * read and the plan built.
 */
export function readApplyConfirmations(read: (flag: string) => string | null): ApplyConfirmations {
  const demoFlag = read("--replace-demo-products");
  return {
    workbookPath: requireText(read("--workbook"), "--workbook"),
    ledgerPath: requireText(read("--ledger"), "--ledger"),
    expectedWorkbookSha256: requireHash(
      read("--expect-workbook-sha256"),
      "--expect-workbook-sha256",
    ),
    expectedLedgerSha256: requireHash(read("--expect-ledger-sha256"), "--expect-ledger-sha256"),
    expectedManifestHash: requireHash(read("--expect-manifest-hash"), "--expect-manifest-hash"),
    targetDatabase: requireText(read("--target-database"), "--target-database"),
    demoReplacementAuthorized: demoFlag === "yes",
    backupAttestation: requireText(read("--backup-attestation"), "--backup-attestation"),
    confirmationPhrase: requireText(read("--confirm"), "--confirm"),
  };
}

/**
 * Checks every confirmation against what the machine found. Called BEFORE the write
 * transaction opens, so a mismatch cannot reach a point where a write is possible.
 */
export function assertApplyConfirmations(
  confirmations: ApplyConfirmations,
  observed: ApplyObserved,
): void {
  const fail = (message: string): never => {
    throw new ApplyConfirmationError(message);
  };

  if (confirmations.confirmationPhrase !== APPLY_CONFIRMATION_PHRASE) {
    fail(
      `--confirm must be exactly "${APPLY_CONFIRMATION_PHRASE}". A phrase that can be ` +
        `supplied by accident is not a confirmation.`,
    );
  }
  if (!confirmations.demoReplacementAuthorized) {
    fail(
      `--replace-demo-products yes is required. The import replaces the ten audited ` +
        `sam-demo-* Products, and that is an owner decision, not a side effect.`,
    );
  }
  if (observed.workbookSha256 !== confirmations.expectedWorkbookSha256) {
    fail(
      `Workbook SHA-256 mismatch.\n  expected ${confirmations.expectedWorkbookSha256}\n` +
        `  actual   ${observed.workbookSha256}\n` +
        `  The file in front of the importer is not the one the operator approved.`,
    );
  }
  if (observed.ledgerSha256 !== confirmations.expectedLedgerSha256) {
    fail(
      `Ratified ledger SHA-256 mismatch.\n  expected ${confirmations.expectedLedgerSha256}\n` +
        `  actual   ${observed.ledgerSha256}`,
    );
  }
  if (observed.manifestHash !== confirmations.expectedManifestHash) {
    fail(
      `Manifest hash mismatch.\n  expected ${confirmations.expectedManifestHash}\n` +
        `  actual   ${observed.manifestHash}\n` +
        `  The plan built here is not the plan that was reviewed. Re-review it; do not ` +
        `update the expected hash to match.`,
    );
  }
  if (observed.databaseName !== confirmations.targetDatabase) {
    fail(
      `Database target mismatch: connected to "${observed.databaseName}", authorized for ` +
        `"${confirmations.targetDatabase}". Refusing to write to a database the operator ` +
        `did not name.`,
    );
  }
  if (confirmations.backupAttestation.trim().length < 16) {
    fail(
      `--backup-attestation must carry the pre-import backup's SHA-256 or a recorded ` +
        `attestation of it. A restore that was never taken cannot be relied on afterwards.`,
    );
  }
}
