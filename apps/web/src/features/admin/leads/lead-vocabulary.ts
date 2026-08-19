import { INQUIRY_TYPE_OPTIONS } from "@/features/forms/inquiry-vocabulary";

import type { AdminInquiryType } from "@sam-group/types";

/**
 * How the inbox spells the things the API sends as machine values.
 *
 * ── The inquiry-type labels are the site's, not a second set ────────────────
 *
 * `INQUIRY_TYPE_OPTIONS` in `features/forms/inquiry-vocabulary.ts` already holds the seven values
 * and the wording SITE_STRUCTURE §10 gives them, and it is the one place in `apps/web` that does.
 * Importing it means an operator reading "Sample request" in the inbox is reading the same words
 * the submitter saw in the form. A private copy here would be a second list to keep in step, and
 * the first time they disagreed the Admin surface would be describing submissions inaccurately.
 *
 * Only the data is shared. None of that feature's CSS is — the admin surface keeps its own `.ad-*`
 * vocabulary, for the reason `admin.css` states.
 *
 * ── Labels are English, in every locale ────────────────────────────────────
 *
 * The same position the public form takes, and the stronger one here: the Admin surface sits
 * outside `[locale]` entirely, its layout is fixed `lang="en" dir="ltr"`, and admin UI language is
 * a preference with no mechanism yet (FRONTEND_ARCHITECTURE §1).
 */

const LABEL_BY_TYPE = new Map<string, string>(
  INQUIRY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * The human label for an inquiry type.
 *
 * Falls back to the raw value rather than to a placeholder. If the API ever serves a type this
 * build does not know, showing the machine value is honest and still identifies the record;
 * "Unknown" would hide which kind of submission an operator is looking at.
 */
export function inquiryTypeLabel(type: AdminInquiryType): string {
  return LABEL_BY_TYPE.get(type) ?? type;
}

/**
 * The submission timestamp, rendered deterministically in UTC.
 *
 * `toLocaleString` is deliberately avoided: it reads the *server's* locale and timezone during a
 * Server Component render, which makes the output depend on the container's environment rather
 * than on the data, and would differ from what a client render would produce. An explicit UTC
 * stamp is unambiguous, sorts the way the list is ordered, and is the same string for every
 * operator looking at the same lead.
 */
export function formatSubmittedAt(iso: string): string {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
