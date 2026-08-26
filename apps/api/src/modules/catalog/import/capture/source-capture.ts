import { createHash } from "node:crypto";

export interface SourceCaptureInspection {
  readonly sha256: string;
  readonly byteSize: number;
  readonly mediaType: string;
  readonly pageCount: number | null;
}

export interface SourceCaptureDocument {
  readonly id: string;
  readonly sourceAsset: SourceCaptureInspection | null;
}

export interface SourceCaptureDatabase {
  currentDatabase(): Promise<string>;
  findDocument(id: string): Promise<SourceCaptureDocument | null>;
  capture(
    documentId: string,
    inspection: SourceCaptureInspection,
  ): Promise<"captured" | "already_captured">;
}

export function inspectSourceBytes(
  bytes: Uint8Array,
  mediaType: string,
  pageCount: number | null,
): SourceCaptureInspection {
  const normalizedMediaType = mediaType.trim().toLowerCase();
  if (!normalizedMediaType || !normalizedMediaType.includes("/")) {
    throw new Error("--media-type must be a non-empty MIME type such as application/pdf.");
  }
  if (bytes.byteLength < 1) {
    throw new Error("The captured source file is empty.");
  }
  if (pageCount !== null && (!Number.isSafeInteger(pageCount) || pageCount < 1)) {
    throw new Error("--page-count must be a positive integer when supplied.");
  }
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
    mediaType: normalizedMediaType,
    pageCount,
  };
}

export function sameCapture(
  left: SourceCaptureInspection,
  right: SourceCaptureInspection,
): boolean {
  return (
    left.sha256 === right.sha256 &&
    left.byteSize === right.byteSize &&
    left.mediaType === right.mediaType &&
    left.pageCount === right.pageCount
  );
}
