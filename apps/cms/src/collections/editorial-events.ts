import type { CollectionConfig } from "payload";

import { notifyPublished } from "../editor/mail";

/** Internal transactional activity trail; never editable through the REST API or CMS UI. */
export const EditorialEvents: CollectionConfig = {
  slug: "editorial-events",
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  hooks: {
    // The owner is told when a page goes live (editor/mail.ts). It never blocks or fails the save.
    afterChange: [
      ({ doc, operation, req }) => {
        if (operation === "create" && doc.action === "publish")
          notifyPublished(req.payload, String(doc.resource), String(doc.actorId));
      },
    ],
  },
  fields: [
    { name: "operationId", type: "text", required: true, unique: true },
    { name: "actorId", type: "text", required: true, index: true },
    { name: "resource", type: "text", required: true, index: true },
    { name: "action", type: "select", required: true, options: ["save-draft", "publish"] },
    { name: "requestHash", type: "text", required: true },
    { name: "revision", type: "text", required: true },
  ],
};
