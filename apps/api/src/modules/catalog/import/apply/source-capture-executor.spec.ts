import { sourceCaptureWriter } from "./source-capture-executor";

import type { PrismaClient } from "../../../../prisma/generated/client";
import type { SourceCaptureInspection } from "../capture/source-capture";

const INSPECTION: SourceCaptureInspection = {
  sha256: "a".repeat(64),
  byteSize: 42,
  mediaType: "application/pdf",
  pageCount: 3,
};

function clientWithTransaction(tx: object): PrismaClient {
  return {
    $transaction: jest.fn(async (operation: (value: object) => Promise<unknown>) => operation(tx)),
  } as unknown as PrismaClient;
}

describe("source capture writer", () => {
  it("creates the immutable asset and attaches it once inside one transaction", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: "document", source_asset_id: null }]),
      sourceAsset: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: "asset" })),
      },
      sourceDocument: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    const client = clientWithTransaction(tx);

    await expect(sourceCaptureWriter(client)("document", INSPECTION)).resolves.toBe("captured");
    expect(tx.sourceAsset.create).toHaveBeenCalledWith({
      data: INSPECTION,
      select: { id: true },
    });
    expect(tx.sourceDocument.updateMany).toHaveBeenCalledWith({
      where: { id: "document", sourceAssetId: null },
      data: { sourceAssetId: "asset" },
    });
  });

  it("makes an identical concurrent replay idempotent", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: "document", source_asset_id: "asset" }]),
      sourceAsset: { findUniqueOrThrow: jest.fn(async () => INSPECTION) },
    };

    await expect(
      sourceCaptureWriter(clientWithTransaction(tx))("document", INSPECTION),
    ).resolves.toBe("already_captured");
  });

  it("refuses to rewrite a document captured with different bytes", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: "document", source_asset_id: "asset" }]),
      sourceAsset: {
        findUniqueOrThrow: jest.fn(async () => ({ ...INSPECTION, sha256: "b".repeat(64) })),
      },
    };

    await expect(
      sourceCaptureWriter(clientWithTransaction(tx))("document", INSPECTION),
    ).rejects.toThrow(/different bytes/);
  });
});
