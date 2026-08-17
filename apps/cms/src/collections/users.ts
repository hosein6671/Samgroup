import { ROLES, adminOnly, adminOnlyField, canAccessAdminPanel } from "../access";

import type { CollectionConfig } from "payload";

/**
 * Payload's own admin users — ADR-006.
 *
 * These accounts live in `sam_cms` and are **not** platform users. Payload hashes their passwords
 * itself; ADR-004's argon2id decision applies to platform identity in `apps/api` and not here.
 * There is no synchronisation in either direction, which ADR-006 records as an accepted
 * offboarding risk: revoking a platform user does not revoke CMS access, and no automation for
 * that is being built.
 *
 * **Bootstrap.** Payload's own create-first-user flow is the mechanism — with the collection empty,
 * `/admin` serves that form and the operator sets the first account's email, password and role.
 * No credential is invented, seeded or committed anywhere in this repository.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    /*
     * Enables a per-user API key, which is how NestJS authenticates as a service
     * (API_CONTRACT_FINAL.md §4). Payload generates the key; nothing here creates one, and no key
     * is ever written to a tracked file.
     */
    useAPIKey: true,
  },
  access: {
    admin: canAccessAdminPanel,
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ["email", "roles"],
    useAsTitle: "email",
  },
  fields: [
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      options: [...ROLES],
      access: {
        // Otherwise a Content Manager who could reach this collection could grant themselves
        // `admin`. Field-level, so it holds even if the collection gate is ever widened.
        create: adminOnlyField,
        update: adminOnlyField,
      },
      admin: {
        description:
          "admin and content-manager are editorial roles. service is for the NestJS Content module only and must never be given to a person.",
      },
    },
  ],
};
