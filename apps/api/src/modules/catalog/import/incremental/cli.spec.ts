import {
  INCREMENTAL_CONFIRMATION_PHRASE,
  parseIncrementalArguments,
  runIncrementalCatalog,
} from "./cli";

import type { IncrementalDatabase } from "./cli";
import type { IncrementalInspection } from "../apply/incremental-executor";

const hash = "a".repeat(64);
const applicable: IncrementalInspection = {
  patchId: "coolant-source-layout-v1",
  patchHash: hash,
  databaseName: "sam_platform",
  state: "APPLICABLE",
  conflicts: [],
  planned: { specProperties: 2, mappingUpdates: 2, specifications: 4, evidenceLinks: 4 },
};

describe("incremental catalog CLI", () => {
  it("requires one mode and the one registered patch", () => {
    expect(() => parseIncrementalArguments([])).toThrow(/exactly one/);
    expect(() =>
      parseIncrementalArguments(["--dry-run", "--apply", "--patch", "coolant-source-layout-v1"]),
    ).toThrow(/exactly one/);
    expect(() => parseIncrementalArguments(["--dry-run", "--patch", "anything-else"])).toThrow(
      /must be exactly/,
    );
  });

  it("makes every apply confirmation mandatory and exact", () => {
    const complete = [
      "--apply",
      "--patch",
      "coolant-source-layout-v1",
      "--expect-patch-hash",
      hash,
      "--target-database",
      "sam_platform",
      "--backup-attestation",
      "verified-backup-2026-08-29",
      "--confirm",
      INCREMENTAL_CONFIRMATION_PHRASE,
    ];
    expect(parseIncrementalArguments(complete).mode).toBe("apply");
    for (const flag of [
      "--expect-patch-hash",
      "--target-database",
      "--backup-attestation",
      "--confirm",
    ]) {
      const index = complete.indexOf(flag);
      expect(() =>
        parseIncrementalArguments([...complete.slice(0, index), ...complete.slice(index + 2)]),
      ).toThrow();
    }
  });

  it("writes nothing on dry-run", async () => {
    const apply = jest.fn();
    const database: IncrementalDatabase = { inspect: async () => applicable, apply };
    const messages: string[] = [];
    await expect(
      runIncrementalCatalog(
        ["--dry-run", "--patch", "coolant-source-layout-v1"],
        database,
        (message) => messages.push(message),
      ),
    ).resolves.toBe(0);
    expect(apply).not.toHaveBeenCalled();
    expect(messages.join("\n")).toMatch(/nothing was written/);
  });

  it("refuses a conflict before the writer can run", async () => {
    const apply = jest.fn();
    const database: IncrementalDatabase = {
      inspect: async () => ({ ...applicable, state: "CONFLICT", conflicts: ["changed"] }),
      apply,
    };
    await expect(
      runIncrementalCatalog(
        ["--dry-run", "--patch", "coolant-source-layout-v1"],
        database,
        () => undefined,
      ),
    ).rejects.toThrow(/nothing was written/);
    expect(apply).not.toHaveBeenCalled();
  });
});
