#!/usr/bin/env tsx
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../../prisma/generated/client";

import { sourceCaptureWriter } from "../apply/source-capture-executor";
import { runSourceCapture } from "./source-capture-cli";

import type { SourceCaptureDatabase } from "./source-capture";

function prismaCaptureDatabase(client: PrismaClient): SourceCaptureDatabase {
  return {
    async currentDatabase() {
      const rows = await client.$queryRaw<
        Array<{ name: string }>
      >`SELECT current_database() AS name`;
      return rows[0]?.name ?? "";
    },
    async findDocument(id) {
      const document = await client.sourceDocument.findUnique({
        where: { id },
        select: {
          id: true,
          sourceAsset: {
            select: { sha256: true, byteSize: true, mediaType: true, pageCount: true },
          },
        },
      });
      return document;
    },
    capture: sourceCaptureWriter(client),
  };
}

async function main(): Promise<number> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is required for source capture.");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    return await runSourceCapture(process.argv.slice(2), prismaCaptureDatabase(client));
  } finally {
    await client.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
