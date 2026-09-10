import type { ProductCategoryContent as CategoryDocument } from "../payload-types";
import { createHash } from "node:crypto";
import type { Endpoint, Field, GlobalConfig, PayloadRequest } from "payload";
import { editorAuthenticated } from "./editor-auth";
import { AboutUs } from "../globals/about-us";
import { CustomizedSolutions } from "../globals/customized-solutions";
import { QualityCertifications } from "../globals/quality-certifications";
import { ContactUs } from "../globals/contact-us";

import { CATEGORY_KEYS, categoryTextFields } from "../collections/product-category-content";

const resources = [AboutUs, CustomizedSolutions, QualityCertifications, ContactUs];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
function names(fields: Field[]): string[] {
  return fields.flatMap((field) => {
    if ("name" in field && field.name)
      return field.name.startsWith("_") || ["id", "createdAt", "updatedAt"].includes(field.name)
        ? []
        : [field.name];
    if (field.type === "tabs")
      return field.tabs.flatMap((tab) =>
        "name" in tab && tab.name ? [tab.name] : names(tab.fields),
      );
    if ("fields" in field) return names(field.fields);
    return [];
  });
}
function project(config: GlobalConfig, value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(names(config.fields).map((key) => [key, value[key] ?? null]));
}

type EditorField = {
  name: string;
  label: string;
  type: string;
  hasMany?: boolean;
  fields?: EditorField[];
  options?: { label: string; value: string }[];
};
function editorFields(fields: Field[]): EditorField[] {
  return fields.flatMap((field) => {
    if (field.type === "tabs") return field.tabs.flatMap((tab) => editorFields(tab.fields));
    if (!("name" in field) || !field.name)
      return "fields" in field ? editorFields(field.fields) : [];
    if (field.name.startsWith("_") || ["id", "createdAt", "updatedAt"].includes(field.name))
      return [];
    if (field.type === "upload" || field.type === "relationship") return [];
    const label =
      typeof field.label === "string"
        ? field.label
        : field.name.replace(/([a-z])([A-Z])/g, "$1 $2");
    const item: EditorField = { name: field.name, label, type: field.type };
    if ("fields" in field) item.fields = editorFields(field.fields);
    if (field.type === "select") item.hasMany = field.hasMany === true;
    if (field.type === "select")
      item.options = field.options.map((option) =>
        typeof option === "string"
          ? { label: option, value: option }
          : {
              label: typeof option.label === "string" ? option.label : option.value,
              value: option.value,
            },
      );
    return [item];
  });
}

export const companyEditor: Endpoint = {
  path: "/editor/company/:key",
  method: "post",
  handler: async (req) => {
    if (!editorAuthenticated(req)) return reply({ error: "Forbidden" }, 403);
    const key = String(req.routeParams?.["key"] ?? "");
    const categoryKey = key.startsWith("category-") ? key.slice(9) : null;
    const config =
      categoryKey && CATEGORY_KEYS.includes(categoryKey)
        ? ({ slug: key, fields: categoryTextFields } as GlobalConfig)
        : resources.find((item) => item.slug === key);
    if (!config) return reply({ error: "Unknown resource" }, 404);
    let body: Record<string, unknown>;
    try {
      if (!req.text) return reply({ error: "Invalid request" }, 400);
      const text = await req.text();
      if (text.length > 200000) return reply({ error: "Content is too large" }, 400);
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return reply({ error: "Invalid request" }, 400);
      body = parsed as Record<string, unknown>;
    } catch {
      return reply({ error: "Invalid request" }, 400);
    }
    if (typeof body.actorId !== "string" || !uuid.test(body.actorId))
      return reply({ error: "Invalid actor" }, 400);
    const slug = config.slug as
      "about-us" | "customized-solutions" | "quality-certifications" | "contact-us";
    const read = async (transactionReq?: PayloadRequest): Promise<Record<string, unknown>> => {
      if (categoryKey) {
        const found = await req.payload.find({
          collection: "product-category-content",
          where: { categoryKey: { equals: categoryKey } },
          limit: 1,
          locale: "en",
          fallbackLocale: false,
          draft: true,
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        });
        return found.docs[0] ? { ...found.docs[0] } : {};
      }
      return {
        ...(await req.payload.findGlobal({
          slug,
          locale: "en",
          fallbackLocale: false,
          draft: true,
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        })),
      };
    };
    if (body.action === "read") {
      const doc = await read();
      return reply({
        key: slug,
        revision: doc.updatedAt ?? "initial",
        fields: project(config, { ...doc }),
        schema: editorFields(config.fields),
      });
    }
    if (
      !["save-draft", "publish"].includes(String(body.action)) ||
      typeof body.operationId !== "string" ||
      !uuid.test(body.operationId) ||
      typeof body.revision !== "string" ||
      !body.fields ||
      typeof body.fields !== "object" ||
      Array.isArray(body.fields)
    )
      return reply({ error: "Invalid edit" }, 400);
    if (
      Object.keys(body).some(
        (key) => !["actorId", "operationId", "revision", "action", "fields"].includes(key),
      )
    )
      return reply({ error: "Unknown request field" }, 400);
    const fields = body.fields as Record<string, unknown>;
    const allowed = names(config.fields);
    if (Object.keys(fields).some((key) => !allowed.includes(key)))
      return reply({ error: "Unknown content field" }, 400);
    if (
      categoryKey &&
      categoryTextFields.some((field) => {
        if (!("name" in field)) return true;
        const value = fields[field.name];
        return (
          typeof value !== "string" ||
          !value.trim() ||
          ("maxLength" in field &&
            typeof field.maxLength === "number" &&
            value.length > field.maxLength)
        );
      })
    )
      return reply({ error: "Check the content fields." }, 400);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ resource: slug, ...body }))
      .digest("hex");
    const transactionID = await req.payload.db.beginTransaction({ isolationLevel: "serializable" });
    if (transactionID === null) return reply({ error: "Transactions unavailable" }, 503);
    req.transactionID = transactionID;
    const transactionReq = req;
    try {
      const prior = await req.payload.find({
        collection: "editorial-events",
        where: { operationId: { equals: body.operationId } },
        limit: 1,
        overrideAccess: true,
        req: transactionReq,
      });
      if (prior.docs[0]) {
        await req.payload.db.rollbackTransaction(transactionID);
        return prior.docs[0].requestHash === requestHash
          ? reply({ revision: prior.docs[0].revision, saved: true })
          : reply({ error: "Operation already used" }, 409);
      }
      const current = await read(transactionReq);
      if ((current.updatedAt ?? "initial") !== body.revision) {
        await req.payload.db.rollbackTransaction(transactionID);
        return reply({ error: "Content changed. Reload before saving." }, 409);
      }
      const options = {
        locale: "en" as const,
        overrideAccess: true,
        depth: 0,
        draft: body.action === "save-draft",
        req: transactionReq,
      };
      const data = {
        ...fields,
        _status: body.action === "publish" ? ("published" as const) : ("draft" as const),
      };
      const updated = categoryKey
        ? typeof current.id === "number"
          ? await req.payload.update({
              ...options,
              collection: "product-category-content",
              id: current.id,
              data,
            })
          : await req.payload.create({
              ...options,
              collection: "product-category-content",
              data: { ...data, categoryKey } as Omit<
                CategoryDocument,
                "id" | "createdAt" | "updatedAt"
              >,
            })
        : await req.payload.updateGlobal({ ...options, slug, data });
      const revision = updated.updatedAt ?? "initial";
      await req.payload.create({
        collection: "editorial-events",
        overrideAccess: true,
        req: transactionReq,
        data: {
          operationId: body.operationId,
          actorId: body.actorId,
          resource: slug,
          action: body.action as "save-draft" | "publish",
          requestHash,
          revision,
        },
      });
      await req.payload.db.commitTransaction(transactionID);
      // Verify the durable receipt outside the transaction: a lost commit acknowledgement is never reported as success.
      const receipt = await req.payload.find({
        collection: "editorial-events",
        where: { operationId: { equals: body.operationId } },
        limit: 1,
        overrideAccess: true,
      });
      if (receipt.docs[0]?.requestHash !== requestHash)
        return reply({ error: "Save was not confirmed. Reload before retrying." }, 503);
      return reply({ revision, saved: true });
    } catch (error: unknown) {
      await req.payload.db.rollbackTransaction(transactionID);
      // A serialization loser must reload instead of overwriting the winner's draft.
      try {
        const latest = await read();
        if ((latest.updatedAt ?? "initial") !== body.revision)
          return reply({ error: "Content changed. Reload before saving." }, 409);
      } catch {
        // Keep an unavailable database distinct from a confirmed conflict.
      }
      const status =
        typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      return reply(
        {
          error:
            status === 400
              ? "Check the content fields."
              : "Content could not be saved. Reload before retrying.",
        },
        status === 400 ? 400 : 503,
      );
    }
  },
};
