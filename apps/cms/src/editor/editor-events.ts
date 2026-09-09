import type { Endpoint, Where } from "payload";
import { editorAuthenticated } from "./editor-auth";

const reply = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const editorEvents: Endpoint = {
  path: "/editor/events",
  method: "get",
  handler: async (req) => {
    if (!editorAuthenticated(req)) return reply({ error: "Forbidden" }, 403);
    const params = new URL(req.url ?? "http://localhost").searchParams;
    const pageText = params.get("page") ?? "1";
    const page = Number(pageText);
    const actor = params.get("actorId");
    const event = params.get("event");
    const from = params.get("from");
    const to = params.get("to");
    if (
      [...params.keys()].some((key) => !["page", "actorId", "event", "from", "to"].includes(key)) ||
      !/^\d+$/.test(pageText) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000 ||
      (actor &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          actor,
        )) ||
      (event && !["content.save-draft", "content.publish"].includes(event)) ||
      [from, to].some(
        (value) =>
          value && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))),
      ) ||
      (from && to && Date.parse(from) > Date.parse(to))
    )
      return reply({ error: "Invalid filters" }, 400);
    const and: Where[] = [];
    if (actor) and.push({ actorId: { equals: actor } });
    if (event) and.push({ action: { equals: event.slice("content.".length) } });
    if (from) and.push({ createdAt: { greater_than_equal: from } });
    if (to) and.push({ createdAt: { less_than_equal: to } });
    try {
      const result = await req.payload.find({
        collection: "editorial-events",
        overrideAccess: true,
        depth: 0,
        page,
        limit: 50,
        sort: ["-createdAt", "-id"],
        where: and.length ? { and } : {},
      });
      return reply({
        items: result.docs.map((row) => ({
          id: String(row.id),
          occurredAt: row.createdAt,
          actorId: row.actorId,
          subjectId: row.resource,
          event: `content.${row.action}`,
          outcome: "success",
          httpStatus: null,
        })),
        total: result.totalDocs,
      });
    } catch {
      return reply({ error: "Content history unavailable" }, 503);
    }
  },
};
