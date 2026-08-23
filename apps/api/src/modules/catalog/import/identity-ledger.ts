/**
 * The identity ledger: the sidecar record that decides which workbook row is which Product.
 *
 * ── Why row position cannot be identity ─────────────────────────────────────
 *
 * `SAMCAT-W1-R123` is derived from a worksheet row number, and a worksheet row number is
 * mutable. Inserting one row above the block, sorting the sheet, or restructuring the
 * workbook moves most of the 100 rows at once. An importer that re-derived identity from the
 * current position would, on such a save, silently reassign 100 identities — taking every
 * product's facts, evidence and approvals with them.
 *
 * Falling back to the name is not a repair. Names legitimately change; the workbook already
 * contains duplicate names (`SN Grade` twice, `SG Grade` twice); a rename and a move can
 * happen in the same save; and name-based matching attaches evidence to the wrong Product
 * exactly when it is least noticeable.
 *
 * ── The four things this file keeps apart ───────────────────────────────────
 *
 *   1. PROPOSED INITIAL IDENTITY — what the first authoritative generation suggests. The
 *      digits still come from the row, because on a first run there is nothing else, but a
 *      proposal is not an identity and nothing downstream may treat it as one.
 *   2. RATIFIED IMMUTABLE IDENTITY — a `sourceRef` in a ledger the owner has frozen. After
 *      ratification the string is OPAQUE: `R123` no longer means "row 123", nothing
 *      re-derives it, and no code path regenerates it from the current sheet.
 *   3. MATCHING EVIDENCE — sheet/row, exact name, normalized name, category. These re-find a
 *      row whose position or wording moved. They are evidence, never identity, and each is
 *      reported with whether it agreed.
 *   4. CONFLICT REQUIRING RECONCILIATION — an inferred match. Proposed, never accepted.
 *
 * ── The one authoritative path ──────────────────────────────────────────────
 *
 * Exact `sourceRef` reuse. It exists only when the workbook itself carries the ratified
 * reference in an identifier column, which `workbook-parser` reads when one is present. That
 * is the only way a re-sorted workbook can be re-identified without inference.
 *
 * ── What this file will never do ────────────────────────────────────────────
 *
 *   * accept an inferred match silently — every one is CONFLICT or NEEDS_REVIEW
 *   * resolve an ambiguous match — it stays UNRESOLVED and linked to nothing
 *   * auto-link a row that both moved AND was renamed
 *   * delete anything because a row disappeared from the workbook
 *   * let a new row inherit a prior approval, evidence or reference
 *   * re-mint the identifier set because the workbook was sorted or re-saved
 */

import { normalizeNameForMatching, proposeSourceRef } from "./source-ref";

import type { PlanFlag, WorkbookProductRow } from "./catalog-import.types";

/**
 * The state a `sourceRef` on a planned row is in. This — not the shape of the string — is
 * what says whether the reference may be relied on.
 */
export type IdentityState =
  /** The workbook declared this ratified reference and the ledger holds it. Authoritative. */
  | "RATIFIED"
  /** Matched a ratified ledger entry on evidence that agrees where it matters. */
  | "LEDGER_CORROBORATED"
  /** Matched a ratified entry on PARTIAL evidence. A proposal awaiting reconciliation. */
  | "INFERRED_UNCONFIRMED"
  /** Evidence is ambiguous. Deliberately linked to nothing. */
  | "UNRESOLVED"
  /** No ledger entry. A first-generation proposal, or a genuinely new row. */
  | "PROPOSED";

/** States a later gate may act on without a human first reconciling the identity. */
export const SETTLED_IDENTITY_STATES: readonly IdentityState[] = [
  "RATIFIED",
  "LEDGER_CORROBORATED",
  "PROPOSED",
];

export type IdentityEvidenceKind =
  "DECLARED_SOURCE_REF" | "SHEET_ROW" | "EXACT_NAME" | "NORMALIZED_NAME" | "CATEGORY";

/** One piece of matching evidence, and whether it agreed. Never identity on its own. */
export interface IdentityEvidence {
  readonly kind: IdentityEvidenceKind;
  readonly agrees: boolean;
  readonly ledgerValue: string;
  readonly workbookValue: string;
}

/**
 * One frozen identity. Everything except `sourceRef` and `state` is MATCHING EVIDENCE
 * captured when the entry was recorded; none of it is identity and none of it is
 * authoritative.
 */
export interface LedgerEntry {
  readonly sourceRef: string;
  readonly state: "RATIFIED" | "PROPOSED";
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly exactName: string;
  readonly normalizedName: string;
  readonly categoryLabel: string;
  /** Fingerprint of the row's raw evidence when the entry was recorded. */
  readonly evidenceHash: string;
  /** Whether a human had approved this row's facts. Never produced by the importer. */
  readonly approved?: boolean;
}

/** The identity of one workbook file, pinned so a later run can prove it has the same one. */
export interface WorkbookCustody {
  readonly fileName: string;
  readonly sha256: string;
  readonly byteSize: number;
}

/**
 * The approved master workbook: the original PLUS the owner-maintained identifier column.
 * Only this file may be used to apply ratified identities.
 */
export interface MasterWorkbookCustody extends WorkbookCustody {
  readonly worksheetName: string;
  /** The identifier column's header, exactly as the sheet writes it. */
  readonly identifierHeader: string;
  /** The identifier column as a spreadsheet letter, e.g. `A`. */
  readonly identifierColumn: string;
}

/**
 * The ledger schema this code understands. Bumped when the shape changes in a way an older
 * reader could misread; an unknown version is refused rather than read optimistically.
 */
export const RATIFIED_LEDGER_SCHEMA_VERSION = 1;

export interface IdentityLedger {
  /**
   * The ledger schema version. Absent on the pre-custody shape, which is why it is optional
   * here and REQUIRED by `assertRatifiedWorkbookCustody`.
   */
  readonly schemaVersion?: number;
  /** The workbook lineage these references belong to. A different lineage is a different set. */
  readonly lineage: string;
  /** How many ratified identities this ledger declares. Self-describing, never inferred. */
  readonly ratifiedIdentityCount?: number;
  /**
   * The authoritative workbook the references were derived from. Kept for audit and fixture
   * parity ONLY: it carries no identifier column, so it can never be the apply workbook.
   */
  readonly originalWorkbook?: WorkbookCustody;
  /** The one file a ratified run may be applied from. */
  readonly approvedMasterWorkbook?: MasterWorkbookCustody;
  readonly entries: readonly LedgerEntry[];
}

export interface IdentityAssignment {
  readonly rowNumber: number;
  readonly sourceRef: string;
  readonly state: IdentityState;
  /** The ledger entry this row was linked to, or null when it was linked to none. */
  readonly matchedEntry: LedgerEntry | null;
  /** The references an ambiguous row could have been, listed rather than chosen between. */
  readonly candidateSourceRefs: readonly string[];
  readonly evidence: readonly IdentityEvidence[];
  readonly flags: readonly PlanFlag[];
}

export interface IdentityResolution {
  readonly assignments: ReadonlyMap<number, IdentityAssignment>;
  /** Ledger entries no workbook row matched. Reported, NEVER deleted. */
  readonly unmatchedEntries: readonly LedgerEntry[];
  /** True only when nothing needs reconciling, so the run could be ratified as it stands. */
  readonly ratifiable: boolean;
}

function evidenceFor(row: WorkbookProductRow, entry: LedgerEntry): IdentityEvidence[] {
  return [
    {
      kind: "SHEET_ROW",
      agrees: entry.sheetName === row.sheetName && entry.rowNumber === row.rowNumber,
      ledgerValue: `${entry.sheetName}#${String(entry.rowNumber)}`,
      workbookValue: `${row.sheetName}#${String(row.rowNumber)}`,
    },
    {
      kind: "EXACT_NAME",
      agrees: entry.exactName === row.name,
      ledgerValue: entry.exactName,
      workbookValue: row.name,
    },
    {
      kind: "NORMALIZED_NAME",
      agrees: entry.normalizedName === normalizeNameForMatching(row.name),
      ledgerValue: entry.normalizedName,
      workbookValue: normalizeNameForMatching(row.name),
    },
    {
      kind: "CATEGORY",
      agrees: entry.categoryLabel === row.categoryLabel,
      ledgerValue: entry.categoryLabel,
      workbookValue: row.categoryLabel,
    },
  ];
}

function agrees(evidence: readonly IdentityEvidence[], kind: IdentityEvidenceKind): boolean {
  return evidence.find((item) => item.kind === kind)?.agrees === true;
}

/**
 * Classifies a link made on matching evidence.
 *
 * Position agreement is what separates a settled row from an inferred one. A row still where
 * the ledger left it, under a name that still matches, is corroborated — a category edit or a
 * whitespace fix is reported but does not unsettle the identity. A row whose POSITION moved
 * is inferred and must be reconciled, because position is the only evidence that separates
 * two products sharing a name.
 */
function classifyMatch(
  row: WorkbookProductRow,
  entry: LedgerEntry,
  evidence: readonly IdentityEvidence[],
): { state: IdentityState; flags: PlanFlag[] } {
  const flags: PlanFlag[] = [];
  const positionAgrees = agrees(evidence, "SHEET_ROW");
  const nameAgrees = agrees(evidence, "NORMALIZED_NAME");

  if (!positionAgrees && nameAgrees) {
    return {
      state: "INFERRED_UNCONFIRMED",
      flags: [
        {
          code: "IDENTITY_INFERRED_MOVED",
          severity: "conflict",
          detail:
            `Row moved from ${entry.sheetName}#${String(entry.rowNumber)} to ` +
            `${row.sheetName}#${String(row.rowNumber)}. The name still matches, so ` +
            `${entry.sourceRef} is PROPOSED for it — not accepted. Position is the only ` +
            `evidence that separates two products sharing a name; reconcile before applying.`,
        },
      ],
    };
  }

  if (positionAgrees && !nameAgrees) {
    return {
      state: "INFERRED_UNCONFIRMED",
      flags: [
        {
          code: "IDENTITY_INFERRED_RENAMED",
          severity: "conflict",
          detail:
            `The row at ${row.sheetName}#${String(row.rowNumber)} is now named "${row.name}"; ` +
            `the ledger records "${entry.exactName}" there. That reads either as a rename in ` +
            `place or as a different product occupying a vacated position, and the evidence ` +
            `cannot tell them apart. ${entry.sourceRef} is PROPOSED, not accepted.`,
        },
      ],
    };
  }

  if (!agrees(evidence, "EXACT_NAME")) {
    flags.push({
      code: "IDENTITY_NAME_PUNCTUATION_CHANGED",
      severity: "review",
      detail:
        `The exact name changed from "${entry.exactName}" to "${row.name}" while the ` +
        `normalized form stayed the same. Identity is preserved.`,
    });
  }
  if (!agrees(evidence, "CATEGORY")) {
    flags.push({
      code: "IDENTITY_CATEGORY_CHANGED",
      severity: "review",
      detail:
        `The workbook category changed from "${entry.categoryLabel}" to ` +
        `"${row.categoryLabel}". Category is never identity; the reference is unchanged.`,
    });
  }
  return { state: "LEDGER_CORROBORATED", flags };
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const bucket = groups.get(key(item));
    if (bucket) bucket.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

/**
 * Decides the identity of every workbook row against a frozen ledger.
 *
 * Resolved as a SET rather than row by row: whether a match is unique is a property of the
 * whole workbook and the whole ledger, and a row-at-a-time loop cannot see it. The tiers run
 * in decreasing order of authority and each only ever consumes an entry once.
 */
export function resolveIdentities(
  rows: readonly WorkbookProductRow[],
  declaredSourceRefs: ReadonlyMap<number, string>,
  ledger: readonly LedgerEntry[],
  lineage?: string,
): IdentityResolution {
  const assignments = new Map<number, IdentityAssignment>();
  const claimedRefs = new Set<string>();
  const entriesByRef = new Map(ledger.map((entry) => [entry.sourceRef, entry]));
  const rowByNumber = new Map(rows.map((row) => [row.rowNumber, row]));

  // Every reference already spoken for: the ledger's, and anything already assigned. A new
  // row at position 3 must not be handed `…R003` when a MOVED row already carries it — that
  // would be a silent reassignment produced by the mint itself.
  const usedRefs = new Set(ledger.map((entry) => entry.sourceRef));
  const mint = (row: WorkbookProductRow): string => {
    const base =
      lineage === undefined
        ? proposeSourceRef(row.rowNumber)
        : proposeSourceRef(row.rowNumber, lineage);
    if (!usedRefs.has(base)) {
      usedRefs.add(base);
      return base;
    }
    for (let attempt = 1; ; attempt++) {
      const candidate = `${base}-NEW${String(attempt)}`;
      if (!usedRefs.has(candidate)) {
        usedRefs.add(candidate);
        return candidate;
      }
    }
  };

  // ── First authoritative generation ────────────────────────────────────────
  // No ledger: every reference is a PROPOSAL. The digits come from the row because on a
  // first run there is nothing else to derive them from, and they stop meaning anything the
  // moment the owner ratifies them.
  if (ledger.length === 0) {
    for (const row of rows) {
      assignments.set(row.rowNumber, {
        rowNumber: row.rowNumber,
        sourceRef: mint(row),
        state: "PROPOSED",
        matchedEntry: null,
        candidateSourceRefs: [],
        evidence: [],
        flags: [
          {
            code: "IDENTITY_PROPOSED",
            severity: "info",
            detail:
              `First authoritative generation: this reference is a PROPOSAL derived from the ` +
              `current row. It becomes an immutable identity only when the owner ratifies the ` +
              `ledger, after which it is opaque and never re-derived.`,
          },
        ],
      });
    }
    return { assignments, unmatchedEntries: [], ratifiable: true };
  }

  const pending = new Set(rows.map((row) => row.rowNumber));
  const link = (
    row: WorkbookProductRow,
    entry: LedgerEntry,
    state: IdentityState,
    flags: readonly PlanFlag[],
    evidence: readonly IdentityEvidence[],
  ): void => {
    claimedRefs.add(entry.sourceRef);
    pending.delete(row.rowNumber);
    assignments.set(row.rowNumber, {
      rowNumber: row.rowNumber,
      sourceRef: entry.sourceRef,
      state,
      matchedEntry: entry,
      candidateSourceRefs: [],
      evidence,
      flags,
    });
  };

  // ── Tier 0: an identifier the workbook itself declares ────────────────────
  // The only authoritative path. Nothing is inferred here and nothing is guessed: a declared
  // reference the ledger does not hold is a conflict, not an invitation to mint one.
  const declaredForKnownRows = [...declaredSourceRefs.entries()].filter(([rowNumber]) =>
    rowByNumber.has(rowNumber),
  );
  const declaredCounts = groupBy(declaredForKnownRows, ([, ref]) => ref);
  for (const [rowNumber, declared] of declaredForKnownRows) {
    const row = rowByNumber.get(rowNumber);
    if (!row) continue;
    const duplicates = declaredCounts.get(declared) ?? [];
    if (duplicates.length > 1) {
      pending.delete(rowNumber);
      usedRefs.add(declared);
      assignments.set(rowNumber, {
        rowNumber,
        sourceRef: declared,
        state: "UNRESOLVED",
        matchedEntry: null,
        candidateSourceRefs: [declared],
        evidence: [
          {
            kind: "DECLARED_SOURCE_REF",
            agrees: false,
            ledgerValue: declared,
            workbookValue: declared,
          },
        ],
        flags: [
          {
            code: "IDENTITY_DECLARED_REF_DUPLICATED",
            severity: "conflict",
            detail:
              `${String(duplicates.length)} workbook rows declare the reference ${declared}. ` +
              `An identity belongs to one row; none of them is linked.`,
          },
        ],
      });
      continue;
    }
    const entry = entriesByRef.get(declared);
    if (!entry) {
      pending.delete(rowNumber);
      usedRefs.add(declared);
      assignments.set(rowNumber, {
        rowNumber,
        sourceRef: declared,
        state: "UNRESOLVED",
        matchedEntry: null,
        candidateSourceRefs: [],
        evidence: [
          { kind: "DECLARED_SOURCE_REF", agrees: false, ledgerValue: "", workbookValue: declared },
        ],
        flags: [
          {
            code: "IDENTITY_DECLARED_REF_UNKNOWN",
            severity: "conflict",
            detail:
              `The workbook declares ${declared} for this row and the ledger does not hold it. ` +
              `Not minted and not inferred: a declared reference that is unknown is a ` +
              `reconciliation, not a new product.`,
          },
        ],
      });
      continue;
    }
    link(
      row,
      entry,
      "RATIFIED",
      [],
      [
        {
          kind: "DECLARED_SOURCE_REF",
          agrees: true,
          ledgerValue: entry.sourceRef,
          workbookValue: declared,
        },
        ...evidenceFor(row, entry),
      ],
    );
  }

  const unclaimedEntries = (): LedgerEntry[] =>
    ledger.filter((entry) => !claimedRefs.has(entry.sourceRef));
  const ambiguousCandidates = new Map<number, string[]>();

  // ── Tier 1: normalized name, mutually unique ──────────────────────────────
  {
    const rowsPending = [...pending].flatMap((rowNumber) => {
      const row = rowByNumber.get(rowNumber);
      return row ? [row] : [];
    });
    const rowsByName = groupBy(rowsPending, (row) => normalizeNameForMatching(row.name));
    const entriesByName = groupBy(unclaimedEntries(), (entry) => entry.normalizedName);
    for (const [name, candidateRows] of rowsByName) {
      const candidateEntries = entriesByName.get(name) ?? [];
      if (candidateEntries.length === 0) continue;
      const row = candidateRows[0];
      const entry = candidateEntries[0];
      if (candidateRows.length === 1 && candidateEntries.length === 1 && row && entry) {
        const evidence = evidenceFor(row, entry);
        const { state, flags } = classifyMatch(row, entry, evidence);
        link(row, entry, state, flags, evidence);
        continue;
      }
      // More than one row or more than one entry carries this name. Nothing is chosen here;
      // tier 2 may still separate them by position, and tier 3 reports what it could not.
      for (const candidate of candidateRows) {
        ambiguousCandidates.set(
          candidate.rowNumber,
          candidateEntries.map((item) => item.sourceRef),
        );
      }
    }
  }

  // ── Tier 2: sheet and row, among what tier 1 left ─────────────────────────
  // Position is unique on both sides, so this pass is a bijection by construction. It exists
  // for exactly two cases: a duplicate NAME that stayed put — which is how `SN Grade` at rows
  // 69 and 96 stays separable — and a rename in place. The second is emitted as a conflict,
  // because a rename in place and a different product on a vacated position look identical.
  {
    const entriesByPosition = new Map(
      unclaimedEntries().map((entry) => [`${entry.sheetName}#${String(entry.rowNumber)}`, entry]),
    );
    for (const rowNumber of [...pending]) {
      const row = rowByNumber.get(rowNumber);
      if (!row) continue;
      const entry = entriesByPosition.get(`${row.sheetName}#${String(row.rowNumber)}`);
      if (!entry || claimedRefs.has(entry.sourceRef)) continue;
      const evidence = evidenceFor(row, entry);
      // Too little agreement to even propose: neither the name nor the category corroborates.
      if (!agrees(evidence, "EXACT_NAME") && !agrees(evidence, "CATEGORY")) continue;
      const { state, flags } = classifyMatch(row, entry, evidence);
      link(row, entry, state, flags, evidence);
    }
  }

  // ── Tier 3: what is left ──────────────────────────────────────────────────
  for (const rowNumber of [...pending]) {
    const row = rowByNumber.get(rowNumber);
    if (!row) continue;
    const candidates = (ambiguousCandidates.get(rowNumber) ?? [])
      .filter((ref) => !claimedRefs.has(ref))
      .sort();
    pending.delete(rowNumber);
    if (candidates.length > 0) {
      assignments.set(rowNumber, {
        rowNumber,
        sourceRef: mint(row),
        state: "UNRESOLVED",
        matchedEntry: null,
        candidateSourceRefs: candidates,
        evidence: [],
        flags: [
          {
            code: "IDENTITY_AMBIGUOUS",
            severity: "conflict",
            detail:
              `"${row.name}" could be any of ${String(candidates.length)} ledger entries ` +
              `(${candidates.join(", ")}) and the evidence does not separate them. Left ` +
              `unresolved and linked to none of them; the reference shown is a placeholder ` +
              `proposal and must not be ratified as it stands.`,
          },
        ],
      });
      continue;
    }
    assignments.set(rowNumber, {
      rowNumber,
      sourceRef: mint(row),
      state: "PROPOSED",
      matchedEntry: null,
      candidateSourceRefs: [],
      evidence: [],
      flags: [
        {
          code: "IDENTITY_NEW_ROW",
          severity: "review",
          detail:
            `No ledger entry matches this row, so a NEW reference is proposed. It inherits ` +
            `nothing: no prior approval, no evidence and no other row's identity.`,
        },
      ],
    });
  }

  const unmatchedEntries = ledger.filter((entry) => !claimedRefs.has(entry.sourceRef));
  const ratifiable = [...assignments.values()].every((assignment) =>
    SETTLED_IDENTITY_STATES.includes(assignment.state),
  );

  return { assignments, unmatchedEntries, ratifiable };
}

/** How many rows were given a freshly minted reference. Zero is the point of the ledger. */
export function mintedCount(resolution: IdentityResolution): number {
  return [...resolution.assignments.values()].filter(
    (assignment) => assignment.matchedEntry === null,
  ).length;
}

/** Raised when a file offered as the RATIFIED ledger is not one. Never repaired in place. */
export class RatifiedLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatifiedLedgerError";
  }
}

/**
 * Reads a ratified identity ledger, and refuses anything that is not one.
 *
 * The production ledger is the owner's frozen decision about which row is which Product, so
 * this validates rather than repairs: a duplicate reference, a `PROPOSED` entry that never
 * got ratified, or a missing field is a REFUSAL. Silently dropping a bad entry would let a
 * hundred-identity file degrade to ninety-nine without anyone noticing, and auto-promoting a
 * `PROPOSED` entry would be the importer ratifying its own proposal — the one thing
 * ratification exists to prevent.
 *
 * Nothing here writes: the ledger is read-only input, and no caller may hand back a mutated
 * copy of it.
 */
export function parseRatifiedLedger(json: string, path: string): IdentityLedger {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new RatifiedLedgerError(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof raw !== "object" || raw === null) {
    throw new RatifiedLedgerError(`${path} must be a JSON object with "lineage" and "entries".`);
  }
  const candidate = raw as {
    schemaVersion?: unknown;
    lineage?: unknown;
    ratifiedIdentityCount?: unknown;
    originalWorkbook?: unknown;
    approvedMasterWorkbook?: unknown;
    entries?: unknown;
  };
  if (typeof candidate.lineage !== "string" || candidate.lineage.length === 0) {
    throw new RatifiedLedgerError(
      `${path} has no workbook "lineage". A ledger without a ` +
        `lineage does not say which workbook its references belong to.`,
    );
  }
  if (!Array.isArray(candidate.entries)) {
    throw new RatifiedLedgerError(`${path} has no "entries" array.`);
  }

  const entries: LedgerEntry[] = [];
  const seen = new Set<string>();
  for (const [index, item] of candidate.entries.entries()) {
    const where = `${path} entry ${String(index)}`;
    if (typeof item !== "object" || item === null) {
      throw new RatifiedLedgerError(`${where} is not an object.`);
    }
    const entry = item as Record<string, unknown>;
    const text = (field: string): string => {
      const value = entry[field];
      if (typeof value !== "string" || value.length === 0) {
        throw new RatifiedLedgerError(`${where} has no "${field}".`);
      }
      return value;
    };
    const sourceRef = text("sourceRef");
    if (seen.has(sourceRef)) {
      throw new RatifiedLedgerError(
        `${path} holds ${sourceRef} more than once. An identity belongs to one row, and a ` +
          `ledger that lists it twice cannot say which.`,
      );
    }
    seen.add(sourceRef);

    // The production ledger is the ratified one. A PROPOSED entry in it is a file that was
    // never signed off, and this is not the place that signs it off.
    if (entry["state"] !== "RATIFIED") {
      throw new RatifiedLedgerError(
        `${where} (${sourceRef}) is "${String(entry["state"])}", not "RATIFIED". The ` +
          `production ledger holds ratified identities only; the importer never ratifies one.`,
      );
    }
    const rowNumber = entry["rowNumber"];
    if (typeof rowNumber !== "number" || !Number.isInteger(rowNumber) || rowNumber < 1) {
      throw new RatifiedLedgerError(`${where} (${sourceRef}) has no valid "rowNumber".`);
    }
    const approved = entry["approved"];
    if (approved !== undefined && typeof approved !== "boolean") {
      throw new RatifiedLedgerError(`${where} (${sourceRef}) has a non-boolean "approved".`);
    }

    entries.push({
      sourceRef,
      state: "RATIFIED",
      sheetName: text("sheetName"),
      rowNumber,
      exactName: text("exactName"),
      normalizedName: text("normalizedName"),
      categoryLabel: text("categoryLabel"),
      evidenceHash: text("evidenceHash"),
      ...(approved === undefined ? {} : { approved }),
    });
  }

  if (entries.length === 0) {
    throw new RatifiedLedgerError(
      `${path} holds no entries. An empty file is not "no ledger": pass no --ledger at all ` +
        `to run the first authoritative generation.`,
    );
  }

  // ── Custody ───────────────────────────────────────────────────────────────
  // Shape-checked here; MATCHED against a real file in `assertRatifiedWorkbookCustody`.
  const optionalNumber = (value: unknown, field: string): number | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new RatifiedLedgerError(`${path} has a non-integer "${field}".`);
    }
    return value;
  };
  const custody = (value: unknown, field: string): Record<string, unknown> | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== "object" || value === null) {
      throw new RatifiedLedgerError(`${path} has a malformed "${field}".`);
    }
    return value as Record<string, unknown>;
  };
  const custodyText = (source: Record<string, unknown>, field: string, where: string): string => {
    const value = source[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new RatifiedLedgerError(`${path} ${where} has no "${field}".`);
    }
    // A path is not an identity. Pinning one would tie the ledger to one machine's disk.
    if (/[\\/]/.test(value)) {
      throw new RatifiedLedgerError(
        `${path} ${where} "${field}" contains a path separator. Custody records a FILE ` +
          `NAME and a hash, never a location.`,
      );
    }
    return value;
  };
  const custodySize = (source: Record<string, unknown>, where: string): number => {
    const value = source["byteSize"];
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new RatifiedLedgerError(`${path} ${where} has no valid "byteSize".`);
    }
    return value;
  };
  const custodyHash = (source: Record<string, unknown>, where: string): string => {
    const value = source["sha256"];
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
      throw new RatifiedLedgerError(`${path} ${where} has no valid lowercase hex "sha256".`);
    }
    return value;
  };

  const originalRaw = custody(candidate.originalWorkbook, "originalWorkbook");
  const masterRaw = custody(candidate.approvedMasterWorkbook, "approvedMasterWorkbook");

  return {
    ...(candidate.schemaVersion === undefined
      ? {}
      : { schemaVersion: optionalNumber(candidate.schemaVersion, "schemaVersion") }),
    lineage: candidate.lineage,
    ...(candidate.ratifiedIdentityCount === undefined
      ? {}
      : {
          ratifiedIdentityCount: optionalNumber(
            candidate.ratifiedIdentityCount,
            "ratifiedIdentityCount",
          ),
        }),
    ...(originalRaw === undefined
      ? {}
      : {
          originalWorkbook: {
            fileName: custodyText(originalRaw, "fileName", "originalWorkbook"),
            sha256: custodyHash(originalRaw, "originalWorkbook"),
            byteSize: custodySize(originalRaw, "originalWorkbook"),
          },
        }),
    ...(masterRaw === undefined
      ? {}
      : {
          approvedMasterWorkbook: {
            fileName: custodyText(masterRaw, "fileName", "approvedMasterWorkbook"),
            sha256: custodyHash(masterRaw, "approvedMasterWorkbook"),
            byteSize: custodySize(masterRaw, "approvedMasterWorkbook"),
            worksheetName: custodyText(masterRaw, "worksheetName", "approvedMasterWorkbook"),
            identifierHeader: custodyText(masterRaw, "identifierHeader", "approvedMasterWorkbook"),
            identifierColumn: custodyText(masterRaw, "identifierColumn", "approvedMasterWorkbook"),
          },
        }),
    entries,
  };
}

/** Raised when the file in front of the importer is not the ledger's approved workbook. */
export class RatifiedWorkbookMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatifiedWorkbookMismatchError";
  }
}

/** `1` -> `A`, `27` -> `AA`. Local so the ledger does not depend on the ZIP reader. */
function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** What the custody check needs to know about the file that was actually opened. */
export interface WorkbookUnderTest {
  readonly fileName: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly sheetName: string;
  readonly identifierColumn: number | null;
  readonly identifierHeader?: string | null;
  readonly declaredSourceRefs: ReadonlyMap<number, string>;
}

/**
 * Proves the file in front of the importer IS the owner's approved master workbook, and that
 * it declares exactly the ratified identities the ledger holds.
 *
 * ── Why the ledger is the only authority ────────────────────────────────────
 *
 * The approved workbook lives outside version control, so nothing in the repository would
 * otherwise say which file it is. The committed ledger pins it. The hashes are NOT repeated
 * in TypeScript: a constant in code and a value in the ledger could disagree, and then there
 * would be two authorities and no way to tell which one the owner approved.
 *
 * ── Why the original workbook is refused here ───────────────────────────────
 *
 * The original is still valid for proposal, audit and fixture-parity flows — but it has no
 * identifier column, so applying ratified identities from it could only ever be inference.
 * It fails on its hash, which is the correct reason.
 *
 * ── Where this runs ─────────────────────────────────────────────────────────
 *
 * Before the plan is built and before the database is opened, so a mismatch cannot reach a
 * point where a write would be conceivable.
 */
export function assertRatifiedWorkbookCustody(
  ledger: IdentityLedger,
  workbook: WorkbookUnderTest,
  expectedLineage: string,
): void {
  const fail = (message: string): never => {
    throw new RatifiedWorkbookMismatchError(message);
  };

  if (ledger.schemaVersion === undefined) {
    fail(
      `The ratified ledger declares no "schemaVersion". A ledger without one predates ` +
        `workbook custody and cannot say which file it approves.`,
    );
  }
  if (ledger.schemaVersion !== RATIFIED_LEDGER_SCHEMA_VERSION) {
    fail(
      `Ratified ledger schemaVersion ${String(ledger.schemaVersion)} is not supported; this ` +
        `importer reads version ${String(RATIFIED_LEDGER_SCHEMA_VERSION)}. Refusing to read a ` +
        `ledger whose shape it may misunderstand.`,
    );
  }
  if (ledger.lineage !== expectedLineage) {
    fail(
      `Ratified ledger lineage "${ledger.lineage}" is not "${expectedLineage}". A different ` +
        `lineage is a different set of identities, not a variant of this one.`,
    );
  }

  const master = ledger.approvedMasterWorkbook;
  if (!master) {
    fail(
      `The ratified ledger pins no "approvedMasterWorkbook". The approved file lives outside ` +
        `version control, so without this the run cannot prove which workbook it opened.`,
    );
    return;
  }

  const declaredCount = ledger.ratifiedIdentityCount;
  if (declaredCount === undefined) {
    fail(`The ratified ledger declares no "ratifiedIdentityCount".`);
    return;
  }
  if (ledger.entries.length !== declaredCount) {
    fail(
      `The ratified ledger declares ${String(declaredCount)} identities but holds ` +
        `${String(ledger.entries.length)}.`,
    );
  }
  for (const entry of ledger.entries) {
    if (entry.state !== "RATIFIED") {
      fail(`${entry.sourceRef} is ${entry.state}, not RATIFIED.`);
    }
  }

  // ── The file itself ───────────────────────────────────────────────────────
  if (workbook.sha256 !== master.sha256) {
    const isOriginal =
      ledger.originalWorkbook !== undefined && workbook.sha256 === ledger.originalWorkbook.sha256;
    fail(
      `This is not the approved master workbook.\n` +
        `  expected ${master.fileName}\n` +
        `    sha256 ${master.sha256}\n` +
        `  received ${workbook.fileName}\n` +
        `    sha256 ${workbook.sha256}\n` +
        (isOriginal
          ? `  That is the ORIGINAL authoritative workbook. It is valid for proposal, audit ` +
            `and fixture parity, but it carries no identifier column, so ratified identities ` +
            `could only be inferred from it. Use the approved master workbook.`
          : `  A single changed byte changes the hash. Re-approve the file, or use the one ` +
            `the ledger pins.`),
    );
  }
  if (workbook.byteSize !== master.byteSize) {
    fail(
      `Approved master workbook is ${String(master.byteSize)} bytes; this file is ` +
        `${String(workbook.byteSize)}.`,
    );
  }
  if (workbook.sheetName !== master.worksheetName) {
    fail(
      `Approved master worksheet is "${master.worksheetName}"; this file parsed ` +
        `"${workbook.sheetName}".`,
    );
  }

  // ── The identifier column ─────────────────────────────────────────────────
  if (workbook.identifierColumn === null) {
    fail(
      `The workbook declares no identifier column. Ratified identities are applied only from ` +
        `a workbook that names them; nothing here is inferred.`,
    );
    return;
  }
  const actualColumn = columnLetter(workbook.identifierColumn);
  if (actualColumn !== master.identifierColumn) {
    fail(
      `Approved identifier column is ${master.identifierColumn}; this workbook carries it in ` +
        `${actualColumn}.`,
    );
  }
  const actualHeader = workbook.identifierHeader ?? "";
  if (actualHeader !== master.identifierHeader) {
    fail(
      `Approved identifier header is "${master.identifierHeader}"; this workbook reads ` +
        `"${actualHeader}".`,
    );
  }

  // ── The declared references ───────────────────────────────────────────────
  // Set membership is checked BEFORE the count. Both catch a missing row, but "declares no
  // row for SAMCAT-W1-R003" names the identity that went missing, and "expected 100, got 99"
  // does not — and which identity it was is the only part a reviewer can act on.
  const declared = [...workbook.declaredSourceRefs.values()];
  const seen = new Map<string, number>();
  for (const reference of declared) seen.set(reference, (seen.get(reference) ?? 0) + 1);
  const duplicated = [...seen].filter(([, count]) => count > 1).map(([reference]) => reference);
  if (duplicated.length > 0) {
    fail(
      `The workbook declares ${duplicated.join(", ")} more than once. An identity belongs to ` +
        `one row.`,
    );
  }
  // Membership only. A ratified reference is OPAQUE: nothing here re-derives it from a row
  // number, so a row that moved still matches as long as it still declares its reference.
  const known = new Set(ledger.entries.map((entry) => entry.sourceRef));
  const unknown = declared.filter((reference) => !known.has(reference)).sort();
  if (unknown.length > 0) {
    fail(
      `The workbook declares ${unknown.join(", ")}, which the ratified ledger does not hold. ` +
        `An unknown declared reference is a reconciliation, never a new product.`,
    );
  }
  const declaredSet = new Set(declared);
  const unmatched = ledger.entries
    .map((entry) => entry.sourceRef)
    .filter((reference) => !declaredSet.has(reference))
    .sort();
  if (unmatched.length > 0) {
    fail(
      `The workbook declares no row for ${unmatched.join(", ")}. A ratified identity that no ` +
        `row claims is reported, never dropped and never reassigned.`,
    );
  }
  // Backstop. With the three checks above satisfied the two sets are equal and this cannot
  // fire; it stays so that relaxing one of them can never silently let a count through.
  if (declared.length !== declaredCount) {
    fail(
      `Expected ${String(declaredCount)} declared sourceRefs; the workbook declares ` +
        `${String(declared.length)}.`,
    );
  }
}
