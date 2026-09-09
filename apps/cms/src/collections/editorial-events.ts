import type { CollectionConfig } from "payload";

/** Internal transactional activity trail; never editable through the REST API or CMS UI. */
export const EditorialEvents: CollectionConfig = {
  slug: "editorial-events",
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "operationId", type: "text", required: true, unique: true },
    { name: "actorId", type: "text", required: true, index: true },
    { name: "resource", type: "text", required: true, index: true },
    { name: "action", type: "select", required: true, options: ["save-draft", "publish"] },
    { name: "requestHash", type: "text", required: true },
    { name: "revision", type: "text", required: true },
  ],
};
