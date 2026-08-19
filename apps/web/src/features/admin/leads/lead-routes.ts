import { ADMIN_PATH } from "../admin-routes";

/**
 * The Admin lead inbox's paths.
 *
 * ── `/admin/leads/*`, because the route tree says `leads/` ──────────────────
 *
 * FRONTEND_ARCHITECTURE §1's frozen tree puts one segment under `admin/` for all four
 * lead-bearing submissions — `leads/  # inquiries, formulation requests, distributor apps,
 * downloads` — rather than a top-level segment per entity. So the inbox is `/admin/leads/inquiries`
 * and not `/admin/inquiries`, even though the **API** path is `/admin/inquiries` (§2.10 names that
 * one). The two namespaces are allowed to differ: one is a REST resource, the other is a screen in
 * a tool, and the tree is the authority for the second.
 *
 * The two unbuilt siblings — distributor applications and download requests — have no entity
 * written by any endpoint yet and get no placeholder route here.
 *
 * ── No `/admin/leads` index ─────────────────────────────────────────────────
 *
 * There is no page at the bare segment. Two inboxes reached from two links on the shell is the
 * whole of the navigation this gate needs; a landing page above them would be the beginning of a
 * dashboard, and this gate is explicitly not that.
 *
 * ── Not locale-prefixed, and not in `site-routes.ts` ────────────────────────
 *
 * These are `/admin/...` paths, so `isAdminSurfacePath` already matches them by prefix and
 * middleware short-circuits them before locale resolution — no middleware change, and no risk of
 * `/admin/leads/inquiries` being rewritten to `/en/admin/leads/inquiries`. Adding any of them to
 * the public route vocabulary would do exactly that; see the note in `admin-routes.ts`.
 */

export const LEADS_PATH = `${ADMIN_PATH}/leads`;

export const INQUIRIES_PATH = `${LEADS_PATH}/inquiries`;

export const CUSTOM_FORMULATION_REQUESTS_PATH = `${LEADS_PATH}/custom-formulation-requests`;

/**
 * A detail URL. `encodeURIComponent` is applied here, where the segment's meaning is known: the id
 * comes from an API response and is a UUID, but a link builder that assumes its input is safe is a
 * link builder that is wrong the first time the assumption changes.
 */
export function inquiryDetailPath(id: string): string {
  return `${INQUIRIES_PATH}/${encodeURIComponent(id)}`;
}

export function customFormulationRequestDetailPath(id: string): string {
  return `${CUSTOM_FORMULATION_REQUESTS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * The two lead sections, keyed by the URL segment the API and the frontend share.
 *
 * One vocabulary for both tiers: the same string is the API path segment
 * (`/admin/inquiries`) and the frontend section (`/admin/leads/inquiries`), so a workflow action
 * carrying a section can build both without a translation table that could disagree with itself.
 */
export type LeadSectionKey = "inquiries" | "custom-formulation-requests";

export const LEAD_SECTION_PATH: Readonly<Record<LeadSectionKey, string>> = {
  inquiries: INQUIRIES_PATH,
  "custom-formulation-requests": CUSTOM_FORMULATION_REQUESTS_PATH,
};
