import type { Endpoint } from "payload";
import path from "node:path";

import { editorAuthenticated } from "./editor-auth";

const reply = (data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * A bounded media picker feed for the platform Admin.
 *
 * Bytes are still uploaded and managed by Payload. This endpoint exposes only the facts needed to
 * choose an editorial image and deliberately omits storage credentials, prefixes and file sizes.
 */
export const mediaList: Endpoint = {
  path: "/editor/media",
  method: "get",
  handler: async (req) => {
    if (!editorAuthenticated(req)) return reply({ error: "Forbidden" }, 403);

    const result = await req.payload.find({
      collection: "media",
      locale: "en",
      fallbackLocale: false,
      depth: 0,
      limit: 100,
      sort: "-updatedAt",
      overrideAccess: true,
    });

    return reply({
      items: result.docs.map((item) => ({
        id: item.id,
        alt: item.alt,
        url: item.url,
        width: item.width ?? null,
        height: item.height ?? null,
      })),
      total: result.totalDocs,
    });
  },
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export const mediaUpload: Endpoint = {
  path: "/editor/media",
  method: "post",
  handler: async (req) => {
    if (!editorAuthenticated(req)) return reply({ error: "Forbidden" }, 403);
    if (!req.text) return reply({ error: "Invalid upload" }, 400);
    let input: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 7_100_000) return reply({ error: "Upload is too large" }, 413);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return reply({ error: "Invalid upload" }, 400);
      input = parsed as Record<string, unknown>;
    } catch {
      return reply({ error: "Invalid upload" }, 400);
    }
    if (
      typeof input.alt !== "string" ||
      !input.alt.trim() ||
      input.alt.length > 300 ||
      typeof input.name !== "string" ||
      !input.name ||
      input.name.length > 180 ||
      typeof input.mimeType !== "string" ||
      !allowedTypes.has(input.mimeType) ||
      typeof input.content !== "string"
    )
      return reply({ error: "Invalid upload" }, 400);
    const bytes = Buffer.from(input.content, "base64");
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024)
      return reply({ error: "Upload is too large" }, 413);
    const created = await req.payload.create({
      collection: "media",
      locale: "en",
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
      data: { alt: input.alt.trim() },
      file: {
        data: bytes,
        mimetype: input.mimeType,
        name: path.basename(input.name),
        size: bytes.length,
      },
    });
    return reply(
      {
        id: created.id,
        alt: created.alt,
        url: created.url,
        width: created.width ?? null,
        height: created.height ?? null,
      },
      201,
    );
  },
};
