/**
 * The identity cases the gate names, each one exercised against the resolver directly.
 *
 * Every test here asserts one of two things: that a reference was PRESERVED, or that an
 * uncertain match was REPORTED rather than accepted. There is deliberately no test asserting
 * that an inferred match "works", because an inferred match that works silently is the bug
 * this file exists to prevent.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { WORKBOOK_FIXTURE } from "./__fixtures__/workbook-rows.fixture";
import {
  assertRatifiedWorkbookCustody,
  mintedCount,
  parseRatifiedLedger,
  RATIFIED_LEDGER_SCHEMA_VERSION,
  RatifiedLedgerError,
  RatifiedWorkbookMismatchError,
  resolveIdentities,
} from "./identity-ledger";
import { normalizeNameForMatching, proposeSourceRef, WORKBOOK_LINEAGE } from "./source-ref";
import { RATIFIED_MARINE_GEAR_DECISIONS } from "./taxonomy-mapping";
import { parseCatalogWorkbook } from "./workbook-parser";

import type { WorkbookProductRow } from "./catalog-import.types";
import type { IdentityLedger, LedgerEntry, WorkbookUnderTest } from "./identity-ledger";

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

/**
 * PRODUCT-DATA-2C-A: the durable ratified ledger, and the refusals that protect it.
 *
 * These do not test that a good file loads — that is the least interesting thing a loader
 * does. They test that a file which is NEARLY right is refused, because a ledger that
 * silently drops one of a hundred identities is worse than one that fails outright.
 */
describe("the ratified identity ledger", () => {
  const ledgerPath = join(__dirname, "data", "catalog-identity-ledger.json");
  const raw = readFileSync(ledgerPath, "utf8");
  const ledger = parseRatifiedLedger(raw, ledgerPath);

  it("holds the ratified 100, every one of them RATIFIED", () => {
    expect(ledger.entries).toHaveLength(100);
    expect(ledger.lineage).toBe("W1");
    for (const entry of ledger.entries) expect(entry.state).toBe("RATIFIED");
  });

  it("carries exactly the reviewed reference set, unrenumbered and uncompacted", () => {
    const refs = ledger.entries.map((entry) => entry.sourceRef);
    expect(new Set(refs).size).toBe(100);
    expect(refs[0]).toBe("SAMCAT-W1-R003");
    expect(refs[99]).toBe("SAMCAT-W1-R300");
    for (const entry of ledger.entries) {
      expect(entry.sourceRef).toBe(proposeSourceRef(entry.rowNumber));
    }
  });

  it("is sorted deterministically by sourceRef", () => {
    const refs = ledger.entries.map((entry) => entry.sourceRef);
    expect(refs).toEqual([...refs].sort());
  });

  it("holds identity and reconciliation metadata ONLY", () => {
    const allowed = new Set([
      "sourceRef",
      "state",
      "sheetName",
      "rowNumber",
      "exactName",
      "normalizedName",
      "categoryLabel",
      "evidenceHash",
      "approved",
    ]);
    const parsed = JSON.parse(raw) as { entries: Record<string, unknown>[] };
    for (const entry of parsed.entries) {
      for (const key of Object.keys(entry)) expect([...allowed]).toContain(key);
    }
    // No technical facts, specifications, claims, credentials, absolute paths or run
    // timestamps may ever appear in this file.
    expect(raw).not.toMatch(/specification|password|secret|token/i);
    expect(raw).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(raw).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("re-serialises byte-identically, so the committed file IS the canonical form", () => {
    expect(`${JSON.stringify(ledger, null, 2)}\n`).toBe(raw);
  });

  it("names the five ratified Marine/Gear rows at their ratification positions", () => {
    for (const decision of RATIFIED_MARINE_GEAR_DECISIONS) {
      const entry = ledger.entries.find((item) => item.sourceRef === decision.sourceRef);
      expect(entry?.rowNumber).toBe(decision.ratifiedAtRow);
      expect(entry?.exactName).toBe(decision.ratifiedName);
      expect(entry?.categoryLabel).toBe("روغن های دریایی Marine Oils");
    }
  });
});

describe("the ratified ledger loader refuses", () => {
  const good = {
    lineage: "W1",
    entries: [
      {
        sourceRef: "SAMCAT-W1-R003",
        state: "RATIFIED",
        sheetName: SHEET,
        rowNumber: 3,
        exactName: "CK-4 10W-40",
        normalizedName: "ck 4 10w 40",
        categoryLabel: "روغن موتور Engine oil",
        evidenceHash: "0".repeat(64),
      },
    ],
  };
  const load = (value: unknown): void => {
    parseRatifiedLedger(JSON.stringify(value), "test.json");
  };

  it("a duplicated sourceRef, rather than quietly keeping one of them", () => {
    const twice = { ...good, entries: [good.entries[0], { ...good.entries[0] }] };
    expect(() => {
      load(twice);
    }).toThrow(RatifiedLedgerError);
    expect(() => {
      load(twice);
    }).toThrow(/more than once/);
  });

  it("a PROPOSED entry, rather than ratifying it on the owner's behalf", () => {
    expect(() => {
      load({ ...good, entries: [{ ...good.entries[0], state: "PROPOSED" }] });
    }).toThrow(/not "RATIFIED"/);
  });

  it("an entry missing a field it needs in order to reconcile a row", () => {
    for (const field of ["sourceRef", "sheetName", "exactName", "categoryLabel", "evidenceHash"]) {
      const entry: Record<string, unknown> = { ...good.entries[0] };
      delete entry[field];
      expect(() => {
        load({ ...good, entries: [entry] });
      }).toThrow(RatifiedLedgerError);
    }
  });

  it("a ledger with no lineage, and a ledger with no entries array", () => {
    expect(() => {
      load({ entries: good.entries });
    }).toThrow(/lineage/);
    expect(() => {
      load({ lineage: "W1" });
    }).toThrow(/entries/);
  });

  it("an EMPTY ledger, which is not the same as passing no ledger at all", () => {
    expect(() => {
      load({ lineage: "W1", entries: [] });
    }).toThrow(/no entries/);
  });

  it("a file that is not JSON", () => {
    expect(() => parseRatifiedLedger("{not json", "test.json")).toThrow(RatifiedLedgerError);
  });

  it("and never mutates what it was handed", () => {
    const before = JSON.stringify(good);
    parseRatifiedLedger(before, "test.json");
    expect(JSON.stringify(good)).toBe(before);
  });
});

describe("the ratified ledger against a workbook that declares its references", () => {
  const ledgerPath = join(__dirname, "data", "catalog-identity-ledger.json");
  const ledger = parseRatifiedLedger(readFileSync(ledgerPath, "utf8"), ledgerPath);
  const declaredAll = new Map(
    WORKBOOK_FIXTURE.rows.map((item) => [item.rowNumber, proposeSourceRef(item.rowNumber)]),
  );

  it("re-identifies all 100 as RATIFIED, minting nothing", () => {
    const resolution = resolveIdentities(WORKBOOK_FIXTURE.rows, declaredAll, ledger.entries);
    expect(resolution.assignments.size).toBe(100);
    for (const assignment of resolution.assignments.values()) {
      expect(assignment.state).toBe("RATIFIED");
    }
    expect(mintedCount(resolution)).toBe(0);
    expect(resolution.unmatchedEntries).toEqual([]);
    expect(resolution.ratifiable).toBe(true);
  });

  it("refuses a declared reference the ratified ledger does not hold", () => {
    const declared = new Map(declaredAll);
    declared.set(3, "SAMCAT-W1-R999");
    const resolution = resolveIdentities(WORKBOOK_FIXTURE.rows, declared, ledger.entries);
    const assignment = resolution.assignments.get(3);
    expect(assignment?.state).toBe("UNRESOLVED");
    expect(assignment?.flags.map((flag) => flag.code)).toContain("IDENTITY_DECLARED_REF_UNKNOWN");
  });

  it("refuses one ratified reference declared by two rows", () => {
    const declared = new Map(declaredAll);
    declared.set(6, "SAMCAT-W1-R003");
    const resolution = resolveIdentities(WORKBOOK_FIXTURE.rows, declared, ledger.entries);
    for (const rowNumber of [3, 6]) {
      expect(resolution.assignments.get(rowNumber)?.state).toBe("UNRESOLVED");
      expect(resolution.assignments.get(rowNumber)?.flags.map((flag) => flag.code)).toContain(
        "IDENTITY_DECLARED_REF_DUPLICATED",
      );
    }
  });

  it("keeps first-generation proposal behaviour when NO ledger is supplied", () => {
    const resolution = resolveIdentities(WORKBOOK_FIXTURE.rows, NO_REFS, []);
    for (const assignment of resolution.assignments.values()) {
      expect(assignment.state).toBe("PROPOSED");
    }
    expect(resolution.ratifiable).toBe(true);
  });
});

/**
 * Workbook custody: proving the file in front of the importer is the one the owner approved.
 *
 * The approved master workbook lives outside version control, so the committed ledger is the
 * only durable record of which file it is. Every test below drives the check from the LEDGER's
 * own pinned values rather than from constants restated here — a hash written twice is two
 * authorities, and the point of custody is that there is one.
 */
describe("ratified workbook custody", () => {
  const ledgerPath = join(__dirname, "data", "catalog-identity-ledger.json");
  const ledger = parseRatifiedLedger(readFileSync(ledgerPath, "utf8"), ledgerPath);
  const master = ledger.approvedMasterWorkbook;
  if (!master) throw new Error("the ratified ledger pins no approved master workbook");

  /** A workbook that IS the approved master, described exactly as the ledger pins it. */
  const approved = (): WorkbookUnderTest => ({
    fileName: master.fileName,
    sha256: master.sha256,
    byteSize: master.byteSize,
    sheetName: master.worksheetName,
    identifierColumn: 1,
    identifierHeader: master.identifierHeader,
    declaredSourceRefs: new Map(ledger.entries.map((entry) => [entry.rowNumber, entry.sourceRef])),
  });

  const check = (workbook: WorkbookUnderTest, custody: IdentityLedger = ledger): void => {
    assertRatifiedWorkbookCustody(custody, workbook, WORKBOOK_LINEAGE);
  };

  it("pins the approved master workbook, with no path and no timestamp", () => {
    expect(ledger.schemaVersion).toBe(RATIFIED_LEDGER_SCHEMA_VERSION);
    expect(ledger.lineage).toBe(WORKBOOK_LINEAGE);
    expect(ledger.ratifiedIdentityCount).toBe(100);
    expect(master.identifierHeader).toBe("sourceRef");
    expect(master.identifierColumn).toBe("A");
    expect(master.worksheetName).toBe("محصولات");
    expect(master.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger.originalWorkbook?.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Custody records a NAME and a hash. Never a location.
    for (const name of [master.fileName, ledger.originalWorkbook?.fileName ?? ""]) {
      expect(name).not.toMatch(/[\\/]/);
    }
  });

  it("ACCEPTS the exact approved master workbook", () => {
    expect(() => {
      check(approved());
    }).not.toThrow();
  });

  it("rejects the ORIGINAL workbook, and says why it is not a substitute", () => {
    const original = ledger.originalWorkbook;
    if (!original) throw new Error("no original workbook pinned");
    const asOriginal: WorkbookUnderTest = {
      ...approved(),
      fileName: original.fileName,
      sha256: original.sha256,
      byteSize: original.byteSize,
      identifierColumn: null,
      identifierHeader: null,
      declaredSourceRefs: new Map(),
    };
    expect(() => {
      check(asOriginal);
    }).toThrow(RatifiedWorkbookMismatchError);
    expect(() => {
      check(asOriginal);
    }).toThrow(/ORIGINAL authoritative workbook/);
  });

  it("rejects a wrong SHA-256", () => {
    expect(() => {
      check({ ...approved(), sha256: "a".repeat(64) });
    }).toThrow(/not the approved master workbook/);
  });

  it("rejects a wrong byte size", () => {
    expect(() => {
      check({ ...approved(), byteSize: master.byteSize + 1 });
    }).toThrow(/bytes; this file is/);
  });

  it("rejects a wrong worksheet", () => {
    expect(() => {
      check({ ...approved(), sheetName: "ایده ها" });
    }).toThrow(/worksheet is/);
  });

  it("rejects a wrong identifier column", () => {
    expect(() => {
      check({ ...approved(), identifierColumn: 29 });
    }).toThrow(/identifier column is A; this workbook carries it in AC/);
  });

  it("rejects a wrong identifier header", () => {
    expect(() => {
      check({ ...approved(), identifierHeader: "شناسه" });
    }).toThrow(/identifier header is "sourceRef"/);
  });

  it("rejects a workbook with no identifier column at all", () => {
    expect(() => {
      check({ ...approved(), identifierColumn: null, identifierHeader: null });
    }).toThrow(/declares no identifier column/);
  });

  it("rejects a MISSING declared sourceRef, naming the identity that went missing", () => {
    const declared = new Map(approved().declaredSourceRefs);
    declared.delete(3);
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).toThrow(RatifiedWorkbookMismatchError);
    // Naming it matters: "99 instead of 100" tells a reviewer nothing actionable.
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).toThrow(/declares no row for SAMCAT-W1-R003/);
  });

  it("rejects a DUPLICATE declared sourceRef", () => {
    const declared = new Map(approved().declaredSourceRefs);
    declared.set(6, "SAMCAT-W1-R003");
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).toThrow(/more than once/);
  });

  it("rejects an UNKNOWN declared sourceRef", () => {
    const declared = new Map(approved().declaredSourceRefs);
    declared.set(3, "SAMCAT-W1-R999");
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).toThrow(/SAMCAT-W1-R999, which the ratified ledger does not hold/);
  });

  it("rejects an UNMATCHED ledger entry, rather than dropping the identity", () => {
    const declared = new Map(approved().declaredSourceRefs);
    // Two ratified identities left unclaimed. Both are named; neither is silently discarded.
    declared.delete(234);
    declared.delete(300);
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).toThrow(/declares no row for SAMCAT-W1-R234, SAMCAT-W1-R300/);
  });

  it("accepts a pure PERMUTATION of the ratified set across rows", () => {
    // Every reference still claimed, by a different row. The set is what matters, not who
    // holds what — this is the same guarantee as row movement, stated as a set property.
    const declared = new Map(approved().declaredSourceRefs);
    declared.set(3, "SAMCAT-W1-R006");
    declared.set(6, "SAMCAT-W1-R009");
    declared.set(9, "SAMCAT-W1-R003");
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).not.toThrow();
  });

  it("rejects an unsupported ledger schema version", () => {
    const future: IdentityLedger = { ...ledger, schemaVersion: 99 };
    expect(() => {
      check(approved(), future);
    }).toThrow(/schemaVersion 99 is not supported/);
  });

  it("rejects a ledger that declares no schema version at all", () => {
    const legacy: IdentityLedger = { ...ledger };
    delete (legacy as { schemaVersion?: number }).schemaVersion;
    expect(() => {
      check(approved(), legacy);
    }).toThrow(/no "schemaVersion"/);
  });

  it("rejects a mismatched lineage", () => {
    const other: IdentityLedger = { ...ledger, lineage: "W2" };
    expect(() => {
      check(approved(), other);
    }).toThrow(/lineage "W2" is not "W1"/);
  });

  it("rejects a ledger that pins no approved master workbook", () => {
    const unpinned: IdentityLedger = { ...ledger };
    delete (unpinned as { approvedMasterWorkbook?: unknown }).approvedMasterWorkbook;
    expect(() => {
      check(approved(), unpinned);
    }).toThrow(/pins no "approvedMasterWorkbook"/);
  });

  it("rejects a declared identity count that disagrees with the entries", () => {
    const miscounted: IdentityLedger = { ...ledger, ratifiedIdentityCount: 99 };
    expect(() => {
      check(approved(), miscounted);
    }).toThrow(/declares 99 identities but holds 100/);
  });

  /**
   * The opacity guarantee. `R234` does not mean "row 234" after ratification, and nothing in
   * the custody path may re-derive or re-validate it from a row number.
   */
  it("accepts ratified identities whose rows ALL moved, deriving nothing from position", () => {
    const moved = new Map<number, string>();
    for (const entry of ledger.entries) {
      // Every row somewhere else entirely, and in a different relative order.
      moved.set(1000 - entry.rowNumber, entry.sourceRef);
    }
    expect(() => {
      check({ ...approved(), declaredSourceRefs: moved });
    }).not.toThrow();
    // ...and the resolver agrees: same references, no minting, still ratifiable.
    const rows = WORKBOOK_FIXTURE.rows.map((item) => ({
      ...item,
      rowNumber: 1000 - item.rowNumber,
    }));
    const declared = new Map(
      rows.map((item) => [item.rowNumber, proposeSourceRef(1000 - item.rowNumber)]),
    );
    const resolution = resolveIdentities(rows, declared, ledger.entries);
    for (const assignment of resolution.assignments.values()) {
      expect(assignment.state).toBe("RATIFIED");
    }
    expect(mintedCount(resolution)).toBe(0);
    expect(resolution.unmatchedEntries).toEqual([]);
  });

  it("does not accept a row that merely sits where a ratified row used to, without declaring it", () => {
    const declared = new Map(approved().declaredSourceRefs);
    declared.delete(234);
    declared.set(234, "SAMCAT-W1-R003");
    expect(() => {
      check({ ...approved(), declaredSourceRefs: declared });
    }).toThrow(RatifiedWorkbookMismatchError);
  });
});

/**
 * The same checks against the REAL files, whichever of the two `CATALOG_WORKBOOK` names.
 * Branching on the hash rather than skipping keeps this meaningful in both modes.
 */
const custodyWorkbook = process.env["CATALOG_WORKBOOK"];
const describeWithFile = custodyWorkbook && existsSync(custodyWorkbook) ? describe : describe.skip;

describeWithFile("ratified workbook custody, against the real file", () => {
  const ledgerPath = join(__dirname, "data", "catalog-identity-ledger.json");
  const ledger = parseRatifiedLedger(readFileSync(ledgerPath, "utf8"), ledgerPath);

  const read = (): { bytes: Buffer; parsed: ReturnType<typeof parseCatalogWorkbook> } => {
    const bytes = readFileSync(custodyWorkbook as string);
    return { bytes, parsed: parseCatalogWorkbook(bytes) };
  };
  const describeFile = (
    bytes: Buffer,
    parsed: ReturnType<typeof parseCatalogWorkbook>,
  ): WorkbookUnderTest => ({
    fileName: (custodyWorkbook as string).split(/[\\/]/).pop() ?? "workbook.xlsx",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
    sheetName: parsed.sheetName,
    identifierColumn: parsed.identifierColumn,
    identifierHeader: parsed.identifierHeader,
    declaredSourceRefs: parsed.declaredSourceRefs,
  });

  it("accepts it when it is the approved master, and rejects it when it is the original", () => {
    const { bytes, parsed } = read();
    const under = describeFile(bytes, parsed);
    if (under.sha256 === ledger.approvedMasterWorkbook?.sha256) {
      expect(() => {
        assertRatifiedWorkbookCustody(ledger, under, WORKBOOK_LINEAGE);
      }).not.toThrow();
      expect(parsed.identifierColumn).toBe(1);
      expect(parsed.identifierHeader).toBe("sourceRef");
      expect(parsed.declaredSourceRefs.size).toBe(100);
    } else {
      expect(under.sha256).toBe(ledger.originalWorkbook?.sha256);
      expect(() => {
        assertRatifiedWorkbookCustody(ledger, under, WORKBOOK_LINEAGE);
      }).toThrow(/ORIGINAL authoritative workbook/);
    }
  });

  it("rejects the file with ONE byte changed", () => {
    const { bytes, parsed } = read();
    const mutated = Buffer.from(bytes);
    // Flip one bit in the middle. Only the hash and size checks can see this.
    const at = Math.floor(mutated.length / 2);
    mutated[at] = (mutated[at] ?? 0) ^ 0x01;
    expect(createHash("sha256").update(mutated).digest("hex")).not.toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    const under = {
      ...describeFile(bytes, parsed),
      sha256: createHash("sha256").update(mutated).digest("hex"),
    };
    expect(() => {
      assertRatifiedWorkbookCustody(ledger, under, WORKBOOK_LINEAGE);
    }).toThrow(RatifiedWorkbookMismatchError);
  });
});
