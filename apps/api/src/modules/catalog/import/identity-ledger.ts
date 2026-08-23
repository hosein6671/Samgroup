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

export interface IdentityLedger {
  /** The workbook lineage these references belong to. A different lineage is a different set. */
  readonly lineage: string;
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
