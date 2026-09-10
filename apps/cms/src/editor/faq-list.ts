import type { Endpoint } from "payload";
import { editorAuthenticated } from "./editor-auth";

export const faqList: Endpoint = {
  path: "/editor/faqs",
  method: "get",
  handler: async (req) => {
    if (!editorAuthenticated(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const page = Number(req.query?.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000)
      return Response.json({ error: "Invalid page" }, { status: 400 });
    const result = await req.payload.find({
      collection: "faq-entries",
      page,
      limit: 20,
      sort: ["sortOrder", "entryKey"],
      draft: true,
      locale: "en",
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
    });
    return Response.json(
      {
        items: result.docs.map((doc) => ({
          entryKey: doc.entryKey,
          question: doc.question,
          revision: doc.updatedAt,
          status: doc._status,
        })),
        total: result.totalDocs,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
};
