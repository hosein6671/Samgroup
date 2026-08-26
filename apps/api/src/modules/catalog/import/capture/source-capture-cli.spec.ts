import { parseCaptureArguments, runSourceCapture } from "./source-capture-cli";

import type { SourceCaptureDatabase } from "./source-capture";

const ID = "1c7fd981-f53d-4bc4-b755-7e765895ad4e";
const SHA = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function database(sourceAsset: null = null): SourceCaptureDatabase {
  return {
    currentDatabase: jest.fn(async () => "sam_platform"),
    findDocument: jest.fn(async () => ({ id: ID, sourceAsset })),
    capture: jest.fn(async () => "captured"),
  };
}

describe("source capture CLI", () => {
  it("requires one explicit mode and refuses unknown switches", () => {
    expect(() => parseCaptureArguments([])).toThrow(/exactly one/);
    expect(() => parseCaptureArguments(["--dry-run", "--wat"])).toThrow(/Unknown/);
  });

  it("keeps database and hash confirmations out of dry runs", () => {
    expect(() =>
      parseCaptureArguments([
        "--dry-run",
        "--document-id",
        ID,
        "--file",
        "x.pdf",
        "--media-type",
        "application/pdf",
        "--target-database",
        "sam_platform",
      ]),
    ).toThrow(/only with --apply/);
  });

  it("inspects without writing or logging a file path", async () => {
    const db = database();
    const messages: string[] = [];
    await expect(
      runSourceCapture(
        [
          "--dry-run",
          "--document-id",
          ID,
          "--file",
          "secret/source.pdf",
          "--media-type",
          "application/pdf",
        ],
        db,
        { read: jest.fn(async () => Buffer.from("abc")), log: (message) => messages.push(message) },
      ),
    ).resolves.toBe(0);
    expect(db.capture).not.toHaveBeenCalled();
    expect(messages.join("\n")).not.toContain("secret/source.pdf");
    expect(messages.join("\n")).toContain(SHA);
  });

  it("writes only after database and digest confirmations match", async () => {
    const db = database();
    await runSourceCapture(
      [
        "--apply",
        "--document-id",
        ID,
        "--file",
        "source.pdf",
        "--media-type",
        "application/pdf",
        "--target-database",
        "sam_platform",
        "--confirm-sha256",
        SHA,
      ],
      db,
      { read: jest.fn(async () => Buffer.from("abc")), log: jest.fn() },
    );
    expect(db.capture).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ sha256: SHA, byteSize: 3 }),
    );
  });

  it("refuses a mismatched confirmation before opening the write", async () => {
    const db = database();
    await expect(
      runSourceCapture(
        [
          "--apply",
          "--document-id",
          ID,
          "--file",
          "source.pdf",
          "--media-type",
          "application/pdf",
          "--target-database",
          "sam_platform",
          "--confirm-sha256",
          "0".repeat(64),
        ],
        db,
        { read: jest.fn(async () => Buffer.from("abc")), log: jest.fn() },
      ),
    ).rejects.toThrow(/does not match/);
    expect(db.capture).not.toHaveBeenCalled();
  });
});
