import { sameCapture } from "../capture/source-capture";

import type { PrismaClient } from "../../../../prisma/generated/client";
import type { SourceCaptureDatabase, SourceCaptureInspection } from "../capture/source-capture";

export function sourceCaptureWriter(client: PrismaClient): SourceCaptureDatabase["capture"] {
  return (documentId, inspection) =>
    client.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string; source_asset_id: string | null }>>`
          SELECT id, source_asset_id
            FROM source_documents
           WHERE id = ${documentId}::uuid
           FOR UPDATE
        `;
        const document = rows[0];
        if (!document) throw new Error("SourceDocument was not found during capture.");

        if (document.source_asset_id) {
          const existing = await tx.sourceAsset.findUniqueOrThrow({
            where: { id: document.source_asset_id },
            select: { sha256: true, byteSize: true, mediaType: true, pageCount: true },
          });
          if (!sameCapture(existing, inspection)) {
            throw new Error(
              "Concurrent capture used different bytes; create a new revision instead.",
            );
          }
          return "already_captured" as const;
        }

        const asset = await reconcileAsset(tx, inspection);
        const updated = await tx.sourceDocument.updateMany({
          where: { id: documentId, sourceAssetId: null },
          data: { sourceAssetId: asset.id },
        });
        if (updated.count !== 1)
          throw new Error("SourceDocument capture lost its concurrency guard.");
        return "captured" as const;
      },
      { isolationLevel: "Serializable", maxWait: 20_000, timeout: 60_000 },
    );
}

async function reconcileAsset(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  inspection: SourceCaptureInspection,
): Promise<{ id: string }> {
  const existing = await tx.sourceAsset.findUnique({
    where: { sha256: inspection.sha256 },
    select: { id: true, sha256: true, byteSize: true, mediaType: true, pageCount: true },
  });
  if (existing) {
    if (!sameCapture(existing, inspection)) {
      throw new Error("An existing SourceAsset has this hash but different metadata.");
    }
    return existing;
  }
  return tx.sourceAsset.create({ data: inspection, select: { id: true } });
}
