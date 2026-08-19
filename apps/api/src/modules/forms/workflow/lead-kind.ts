/**
 * Which lead table a workflow operation is about.
 *
 * The two values are the `entityType` strings written into `status_history` and
 * `lead_assignment_history`, and they are the Prisma model names rather than the physical table
 * names — matching what `StatusHistory` already stores for its other producers, and what
 * DATA_MODEL.md's ER diagram names.
 *
 * A closed union rather than a string, because it selects which Prisma delegate a mutation runs
 * against. `DistributorApplication` and `DownloadRequest` both carry `assignedToId` and will join
 * this union when they get endpoints; the history tables need no schema change to accept them.
 */
export const LEAD_KINDS = ["Inquiry", "CustomFormulationRequest"] as const;

export type LeadKind = (typeof LEAD_KINDS)[number];
