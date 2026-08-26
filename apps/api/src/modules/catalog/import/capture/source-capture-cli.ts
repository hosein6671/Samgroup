import { readFile } from "node:fs/promises";

import { inspectSourceBytes, sameCapture } from "./source-capture";

import type { SourceCaptureDatabase, SourceCaptureInspection } from "./source-capture";

const TARGET_DATABASE = "sam_platform";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

interface CaptureArguments {
  readonly mode: "dry-run" | "apply";
  readonly documentId: string;
  readonly filePath: string;
  readonly mediaType: string;
  readonly pageCount: number | null;
  readonly expectedDatabase: string | null;
  readonly confirmedSha256: string | null;
}

export interface SourceCaptureIo {
  read(path: string): Promise<Uint8Array>;
  log(message: string): void;
}

const DEFAULT_IO: SourceCaptureIo = { read: readFile, log: console.log };

function valueAfter(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseCaptureArguments(argv: readonly string[]): CaptureArguments {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) throw new Error("Pass exactly one of --dry-run or --apply.");

  const known = new Set([
    "--dry-run",
    "--apply",
    "--document-id",
    "--file",
    "--media-type",
    "--page-count",
    "--target-database",
    "--confirm-sha256",
  ]);
  for (const argument of argv) {
    if (argument.startsWith("--") && !known.has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const documentId = valueAfter(argv, "--document-id");
  const filePath = valueAfter(argv, "--file");
  const mediaType = valueAfter(argv, "--media-type");
  if (!documentId || !UUID.test(documentId)) throw new Error("--document-id must be a UUID.");
  if (!filePath) throw new Error("--file is required.");
  if (!mediaType) throw new Error("--media-type is required.");

  const rawPageCount = valueAfter(argv, "--page-count");
  const pageCount = rawPageCount === null ? null : Number(rawPageCount);
  const expectedDatabase = valueAfter(argv, "--target-database");
  const confirmedSha256 = valueAfter(argv, "--confirm-sha256")?.toLowerCase() ?? null;

  if (apply) {
    if (expectedDatabase !== TARGET_DATABASE) {
      throw new Error(`--apply requires --target-database ${TARGET_DATABASE}.`);
    }
    if (!confirmedSha256 || !SHA256.test(confirmedSha256)) {
      throw new Error("--apply requires --confirm-sha256 with a lowercase SHA-256 digest.");
    }
  } else if (expectedDatabase !== null || confirmedSha256 !== null) {
    throw new Error("Database and hash confirmations are accepted only with --apply.");
  }

  return {
    mode: apply ? "apply" : "dry-run",
    documentId,
    filePath,
    mediaType,
    pageCount,
    expectedDatabase,
    confirmedSha256,
  };
}

function renderInspection(inspection: SourceCaptureInspection): string {
  return [
    `SHA-256                  ${inspection.sha256}`,
    `byte size               ${String(inspection.byteSize)}`,
    `media type              ${inspection.mediaType}`,
    `page count              ${inspection.pageCount === null ? "not supplied" : String(inspection.pageCount)}`,
  ].join("\n");
}

export async function runSourceCapture(
  argv: readonly string[],
  database: SourceCaptureDatabase,
  io: SourceCaptureIo = DEFAULT_IO,
): Promise<number> {
  const args = parseCaptureArguments(argv);
  const bytes = await io.read(args.filePath);
  const inspection = inspectSourceBytes(bytes, args.mediaType, args.pageCount);
  const document = await database.findDocument(args.documentId);
  if (!document) throw new Error("SourceDocument was not found.");

  io.log(`document id             ${document.id}`);
  io.log(renderInspection(inspection));
  io.log("source bytes            inspected in memory; not stored");

  if (document.sourceAsset) {
    if (!sameCapture(document.sourceAsset, inspection)) {
      throw new Error(
        "SourceDocument is already captured with different bytes or metadata; create a new revision instead.",
      );
    }
    io.log("result                  already captured; no write needed");
    return 0;
  }

  if (args.mode === "dry-run") {
    io.log("result                  dry run; no database write");
    return 0;
  }

  const currentDatabase = await database.currentDatabase();
  if (currentDatabase !== args.expectedDatabase || currentDatabase !== TARGET_DATABASE) {
    throw new Error("The connected database does not match the confirmed sam_platform target.");
  }
  if (inspection.sha256 !== args.confirmedSha256) {
    throw new Error("--confirm-sha256 does not match the inspected source bytes.");
  }

  const result = await database.capture(args.documentId, inspection);
  io.log(`result                  ${result === "captured" ? "captured" : "already captured"}`);
  return 0;
}
