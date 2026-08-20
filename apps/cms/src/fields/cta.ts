import type { Field } from "payload";

/**
 * The shared editorial call-to-action vocabulary.
 *
 * ── Why this is one module and not a copy per Global ────────────────────────
 *
 * `AboutUs` declared these first. `CustomizedSolutions` needs the identical option list, and a
 * second copy of a route vocabulary is the drift this project has refused everywhere else — the
 * same reasoning that keeps the six Product Families in one table rather than restated per page.
 * One list, spread into every Global that offers an action.
 */

/**
 * The structural routes an editorial action may point at.
 *
 * Values are route *keys*, resolved to a locale-prefixed path by `apps/web`. They are not URLs and
 * must never become URLs: structural page URLs stay fixed English across locales and belong to the
 * frontend's route table, not to a CMS text field (PROJECT_HANDOFF.md §6.12).
 */
export const ROUTE_OPTIONS = [
  { label: "Products", value: "products" },
  { label: "Customized Solutions", value: "customized-solutions" },
  { label: "Quality & Certifications", value: "quality-certifications" },
  { label: "Contact Us", value: "contact-us" },
  { label: "Request a Quote", value: "request-a-quote" },
];

/** A call to action: localized copy plus a non-localized structural destination. */
export function ctaField(name: string, label: string): Field {
  return {
    name,
    type: "group",
    label,
    fields: [
      {
        name: "label",
        type: "text",
        localized: true,
        admin: { description: "Leave empty to omit this action from the page." },
      },
      {
        name: "route",
        type: "select",
        options: ROUTE_OPTIONS,
        /*
         * A destination is not copy. The same button points at the same page in every language —
         * only its wording changes — and the locale prefix is applied by the frontend.
         */
        localized: false,
      },
    ],
  };
}

/**
 * An action whose destination is a **structural anchor on the page it sits on**, so the CMS holds
 * the wording and nothing else.
 *
 * ── Why there is no target field, and why there must not be ─────────────────
 *
 * An in-page anchor is part of the page's own structure: the id it points at is declared by a
 * component, shared in links, and changed only by changing the markup. Storing it here would let an
 * edit silently break a fragment somebody had already sent, and would mix page anchors into the
 * route-key vocabulary, which exists to describe *pages*.
 *
 * So the frontend renders the `href` from its own anchor table and reads only the label from here.
 * An editor can rename the button; nobody can point it somewhere else.
 */
export function anchorCtaField(name: string, label: string, targetNote: string): Field {
  return {
    name,
    type: "group",
    label,
    fields: [
      {
        name: "label",
        type: "text",
        localized: true,
        admin: { description: `Wording only. ${targetNote} Leave empty to omit this action.` },
      },
    ],
  };
}
