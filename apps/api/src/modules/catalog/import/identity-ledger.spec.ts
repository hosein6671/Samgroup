/**
 * The identity cases the gate names, each one exercised against the resolver directly.
 *
 * Every test here asserts one of two things: that a reference was PRESERVED, or that an
 * uncertain match was REPORTED rather than accepted. There is deliberately no test asserting
 * that an inferred match "works", because an inferred match that works silently is the bug
 * this file exists to prevent.
 */

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import { mintedCount, resolveIdentities } from "./identity-ledger";
import { normalizeNameForMatching } from "./source-ref";

import type { WorkbookProductRow } from "./catalog-import.types";
import type { LedgerEntry } from "./identity-ledger";

const SHEET = "محصولات";
const NO_REFS: ReadonlyMap<number, string> = new Map();

function row(
  rowNumber: number,
  name: string,
  categoryLabel = "روغن موتور Engine oil",
): WorkbookProductRow {
  return {
    ...(WORKBOOK_FIXTURE.rows[0] as WorkbookProductRow),
    sheetName: SHEET,
    rowNumber,
    name,
    rawName: name,
    categoryLabel,
  };
}

function entry(
  sourceRef: string,
  rowNumber: number,
  name: string,
  categoryLabel = "روغن موتور Engine oil",
): LedgerEntry {
  return {
    sourceRef,
    state: "RATIFIED",
    sheetName: SHEET,
    rowNumber,
    exactName: name,
    normalizedName: normalizeNameForMatching(name),
    categoryLabel,
    evidenceHash: "0".repeat(64),
  };
}

/** The three-row baseline every scenario below perturbs. */
const BASE_ROWS = [row(3, "Alpha"), row(6, "Beta"), row(9, "Gamma")];
const BASE_LEDGER = [
  entry("SAMCAT-W1-R003", 3, "Alpha"),
  entry("SAMCAT-W1-R006", 6, "Beta"),
  entry("SAMCAT-W1-R009", 9, "Gamma"),
];

const refFor = (
  resolution: ReturnType<typeof resolveIdentities>,
  rowNumber: number,
): string | undefined => resolution.assignments.get(rowNumber)?.sourceRef;

const stateFor = (
  resolution: ReturnType<typeof resolveIdentities>,
  rowNumber: number,
): string | undefined => resolution.assignments.get(rowNumber)?.state;

const codesFor = (resolution: ReturnType<typeof resolveIdentities>, rowNumber: number): string[] =>
  (resolution.assignments.get(rowNumber)?.flags ?? []).map((flag) => flag.code);

describe("first authoritative generation", () => {
  it("proposes all 100 references and calls them PROPOSED, not ratified", () => {
    const resolution = resolveIdentities(WORKBOOK_FIXTURE.rows, NO_REFS, []);
    expect(resolution.assignments.size).toBe(100);
    for (const assignment of resolution.assignments.values()) {
      expect(assignment.state).toBe("PROPOSED");
      expect(assignment.matchedEntry).toBeNull();
    }
    expect(new Set([...resolution.assignments.values()].map((a) => a.sourceRef)).size).toBe(100);
  });
});

describe("exact sourceRef reuse is the only authoritative path", () => {
  it("takes a declared reference the ledger holds, whatever else changed", () => {
    const declared = new Map([[300, "SAMCAT-W1-R003"]]);
    const resolution = resolveIdentities(
      [row(300, "Completely Different Name", "روغن های صنعتی Industrial Oils")],
      declared,
      BASE_LEDGER,
    );
    expect(refFor(resolution, 300)).toBe("SAMCAT-W1-R003");
    expect(stateFor(resolution, 300)).toBe("RATIFIED");
  });

  it("refuses a declared reference the ledger does not hold, and mints nothing", () => {
    const declared = new Map([[3, "SAMCAT-W1-R999"]]);
    const resolution = resolveIdentities([row(3, "Alpha")], declared, BASE_LEDGER);
    expect(stateFor(resolution, 3)).toBe("UNRESOLVED");
    expect(codesFor(resolution, 3)).toContain("IDENTITY_DECLARED_REF_UNKNOWN");
  });

  it("refuses two rows declaring the same reference", () => {
    const declared = new Map([
      [3, "SAMCAT-W1-R003"],
      [6, "SAMCAT-W1-R003"],
    ]);
    const resolution = resolveIdentities([row(3, "Alpha"), row(6, "Beta")], declared, BASE_LEDGER);
    expect(stateFor(resolution, 3)).toBe("UNRESOLVED");
    expect(stateFor(resolution, 6)).toBe("UNRESOLVED");
    expect(codesFor(resolution, 3)).toContain("IDENTITY_DECLARED_REF_DUPLICATED");
  });
});

describe("an unchanged workbook", () => {
  it("re-identifies every row and mints nothing", () => {
    const resolution = resolveIdentities(BASE_ROWS, NO_REFS, BASE_LEDGER);
    expect(mintedCount(resolution)).toBe(0);
    expect(refFor(resolution, 3)).toBe("SAMCAT-W1-R003");
    expect(stateFor(resolution, 3)).toBe("LEDGER_CORROBORATED");
    expect(resolution.ratifiable).toBe(true);
  });
});

describe("row insertion before all existing rows", () => {
  // Everything shifts by one stride. Position evidence fails on every row at once, which is
  // exactly the save that would have re-minted 100 identities under a position-derived scheme.
  const shifted = [row(3, "Newcomer"), row(6, "Alpha"), row(9, "Beta"), row(12, "Gamma")];

  it("re-mints NOTHING for the rows that merely moved", () => {
    const resolution = resolveIdentities(shifted, NO_REFS, BASE_LEDGER);
    expect(refFor(resolution, 6)).toBe("SAMCAT-W1-R003");
    expect(refFor(resolution, 9)).toBe("SAMCAT-W1-R006");
    expect(refFor(resolution, 12)).toBe("SAMCAT-W1-R009");
    expect(mintedCount(resolution)).toBe(1); // the genuinely new row, and only it
  });

  it("reports every moved row as a conflict rather than accepting the match", () => {
    const resolution = resolveIdentities(shifted, NO_REFS, BASE_LEDGER);
    for (const rowNumber of [6, 9, 12]) {
      expect(stateFor(resolution, rowNumber)).toBe("INFERRED_UNCONFIRMED");
      expect(codesFor(resolution, rowNumber)).toContain("IDENTITY_INFERRED_MOVED");
    }
    expect(resolution.ratifiable).toBe(false);
  });
});

describe("workbook sorting", () => {
  const sorted = [row(3, "Gamma"), row(6, "Beta"), row(9, "Alpha")];

  it("never re-mints the identifier set because the sheet was sorted", () => {
    const resolution = resolveIdentities(sorted, NO_REFS, BASE_LEDGER);
    expect(mintedCount(resolution)).toBe(0);
    expect(refFor(resolution, 3)).toBe("SAMCAT-W1-R009");
    expect(refFor(resolution, 9)).toBe("SAMCAT-W1-R003");
  });

  it("still refuses to accept the re-identification without a human", () => {
    const resolution = resolveIdentities(sorted, NO_REFS, BASE_LEDGER);
    expect(stateFor(resolution, 3)).toBe("INFERRED_UNCONFIRMED");
    expect(resolution.ratifiable).toBe(false);
  });
});

describe("a single row move", () => {
  it("preserves the reference and reports the move", () => {
    const moved = [row(3, "Alpha"), row(6, "Beta"), row(300, "Gamma")];
    const resolution = resolveIdentities(moved, NO_REFS, BASE_LEDGER);
    expect(refFor(resolution, 300)).toBe("SAMCAT-W1-R009");
    expect(stateFor(resolution, 300)).toBe("INFERRED_UNCONFIRMED");
    expect(stateFor(resolution, 3)).toBe("LEDGER_CORROBORATED");
  });
});

describe("a rename in place", () => {
  it("preserves the reference and reports it as needing reconciliation", () => {
    const renamed = [row(3, "Alpha Mk II"), row(6, "Beta"), row(9, "Gamma")];
    const resolution = resolveIdentities(renamed, NO_REFS, BASE_LEDGER);
    expect(refFor(resolution, 3)).toBe("SAMCAT-W1-R003");
    expect(stateFor(resolution, 3)).toBe("INFERRED_UNCONFIRMED");
    expect(codesFor(resolution, 3)).toContain("IDENTITY_INFERRED_RENAMED");
  });

  it("does not treat a category edit as a rename or as a new product", () => {
    const recategorised = [
      row(3, "Alpha", "روغن های صنعتی Industrial Oils"),
      row(6, "Beta"),
      row(9, "Gamma"),
    ];
    const resolution = resolveIdentities(recategorised, NO_REFS, BASE_LEDGER);
    expect(refFor(resolution, 3)).toBe("SAMCAT-W1-R003");
    expect(stateFor(resolution, 3)).toBe("LEDGER_CORROBORATED");
    expect(codesFor(resolution, 3)).toContain("IDENTITY_CATEGORY_CHANGED");
  });
});

describe("a rename PLUS a move", () => {
  // The dangerous case. Neither the name nor the position points anywhere, so nothing may be
  // linked: linking on either alone would attach one product's evidence to another.
  const renamedAndMoved = [row(6, "Beta"), row(9, "Gamma"), row(300, "Alpha Renamed")];

  it("never auto-links the row to the identity it used to have", () => {
    const resolution = resolveIdentities(renamedAndMoved, NO_REFS, BASE_LEDGER);
    expect(refFor(resolution, 300)).toBe("SAMCAT-W1-R300");
    expect(stateFor(resolution, 300)).toBe("PROPOSED");
    expect(codesFor(resolution, 300)).toContain("IDENTITY_NEW_ROW");
  });

  it("reports the orphaned ledger entry instead of deleting it", () => {
    const resolution = resolveIdentities(renamedAndMoved, NO_REFS, BASE_LEDGER);
    expect(resolution.unmatchedEntries.map((item) => item.sourceRef)).toEqual(["SAMCAT-W1-R003"]);
  });

  it("does not steal the identity of a row that merely moved onto the vacated position", () => {
    // `Alpha` is renamed and moves to 300; `Beta` slides up into position 3. Position alone
    // would hand Beta the reference `Alpha` had.
    const shuffled = [row(3, "Beta"), row(9, "Gamma"), row(300, "Alpha Renamed")];
    const resolution = resolveIdentities(shuffled, NO_REFS, BASE_LEDGER);
    expect(refFor(resolution, 3)).toBe("SAMCAT-W1-R006");
    expect(refFor(resolution, 300)).not.toBe("SAMCAT-W1-R003");
  });
});

describe("a duplicate name that moved", () => {
  const duplicateLedger = [
    entry("SAMCAT-W1-R069", 69, "SN Grade"),
    entry("SAMCAT-W1-R096", 96, "SN Grade"),
  ];

  it("stays UNRESOLVED and is linked to neither candidate", () => {
    const moved = [row(72, "SN Grade"), row(99, "SN Grade")];
    const resolution = resolveIdentities(moved, NO_REFS, duplicateLedger);
    for (const rowNumber of [72, 99]) {
      expect(stateFor(resolution, rowNumber)).toBe("UNRESOLVED");
      expect(codesFor(resolution, rowNumber)).toContain("IDENTITY_AMBIGUOUS");
      expect(resolution.assignments.get(rowNumber)?.matchedEntry).toBeNull();
      expect(resolution.assignments.get(rowNumber)?.candidateSourceRefs).toEqual([
        "SAMCAT-W1-R069",
        "SAMCAT-W1-R096",
      ]);
    }
    expect(resolution.ratifiable).toBe(false);
  });

  it("but separates the SAME duplicate names by position when they did NOT move", () => {
    const inPlace = [row(69, "SN Grade"), row(96, "SN Grade")];
    const resolution = resolveIdentities(inPlace, NO_REFS, duplicateLedger);
    expect(refFor(resolution, 69)).toBe("SAMCAT-W1-R069");
    expect(refFor(resolution, 96)).toBe("SAMCAT-W1-R096");
    expect(resolution.ratifiable).toBe(true);
  });
});

describe("a removed row", () => {
  it("is reported, never deleted", () => {
    const shortened = [row(3, "Alpha"), row(6, "Beta")];
    const resolution = resolveIdentities(shortened, NO_REFS, BASE_LEDGER);
    expect(resolution.unmatchedEntries.map((item) => item.sourceRef)).toEqual(["SAMCAT-W1-R009"]);
    expect(mintedCount(resolution)).toBe(0);
  });
});

describe("a new row", () => {
  it("gets a new reference and inherits nothing", () => {
    const extended = [...BASE_ROWS, row(12, "Delta")];
    const resolution = resolveIdentities(extended, NO_REFS, BASE_LEDGER);
    const assignment = resolution.assignments.get(12);
    expect(assignment?.sourceRef).toBe("SAMCAT-W1-R012");
    expect(assignment?.state).toBe("PROPOSED");
    expect(assignment?.matchedEntry).toBeNull();
    expect(BASE_LEDGER.some((item) => item.sourceRef === "SAMCAT-W1-R012")).toBe(false);
  });

  it("does not take an identity another row already holds", () => {
    const duplicateName = [...BASE_ROWS, row(12, "Alpha")];
    const resolution = resolveIdentities(duplicateName, NO_REFS, BASE_LEDGER);
    const refs = [...resolution.assignments.values()].map((item) => item.sourceRef);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe("no silent identity reassignment, ever", () => {
  const scenarios: readonly { name: string; rows: readonly WorkbookProductRow[] }[] = [
    { name: "unchanged", rows: BASE_ROWS },
    {
      name: "inserted above",
      rows: [row(3, "New"), row(6, "Alpha"), row(9, "Beta"), row(12, "Gamma")],
    },
    { name: "sorted", rows: [row(3, "Gamma"), row(6, "Beta"), row(9, "Alpha")] },
    { name: "renamed", rows: [row(3, "Alpha Mk II"), row(6, "Beta"), row(9, "Gamma")] },
    { name: "renamed and moved", rows: [row(6, "Beta"), row(9, "Gamma"), row(300, "Alpha X")] },
    { name: "removed", rows: [row(3, "Alpha"), row(6, "Beta")] },
  ];

  it.each(scenarios)("$name: every non-corroborated link is reported", ({ rows }) => {
    const resolution = resolveIdentities(rows, NO_REFS, BASE_LEDGER);
    for (const assignment of resolution.assignments.values()) {
      if (assignment.state === "LEDGER_CORROBORATED" || assignment.state === "RATIFIED") {
        // A settled link must agree on position, which is the evidence that separates two
        // products sharing a name.
        expect(assignment.evidence.find((item) => item.kind === "SHEET_ROW")?.agrees).toBe(true);
        continue;
      }
      if (assignment.matchedEntry !== null) {
        expect(assignment.state).toBe("INFERRED_UNCONFIRMED");
        expect(assignment.flags.some((flag) => flag.severity === "conflict")).toBe(true);
      }
    }
  });

  it.each(scenarios)("$name: never assigns one reference to two rows", ({ rows }) => {
    const resolution = resolveIdentities(rows, NO_REFS, BASE_LEDGER);
    const refs = [...resolution.assignments.values()].map((item) => item.sourceRef);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it.each(scenarios)("$name: never deletes a ledger entry", ({ rows }) => {
    const resolution = resolveIdentities(rows, NO_REFS, BASE_LEDGER);
    const linked = [...resolution.assignments.values()]
      .map((item) => item.matchedEntry?.sourceRef)
      .filter((ref): ref is string => ref !== undefined);
    const accounted = new Set([
      ...linked,
      ...resolution.unmatchedEntries.map((item) => item.sourceRef),
    ]);
    expect(accounted.size).toBe(BASE_LEDGER.length);
  });
});
