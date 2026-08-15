/**
 * Maximum accepted length for every free-text field the two public submission endpoints hold.
 *
 * ── Why these exist at all ──────────────────────────────────────────────────
 *
 * Every column behind them is an unbounded PostgreSQL `text`. On an unauthenticated write endpoint
 * that is a storage-abuse vector rather than a convenience: without a cap, one request can commit
 * a megabyte of prose to a table nothing prunes. API_CONTRACT_FINAL.md §Input validation requires
 * length limits on the boundary DTOs, and this is where they are stated once instead of per field.
 *
 * ── They are engineering limits, not business rules ─────────────────────────
 *
 * No document specifies a maximum length for any of these fields, so nothing here is transcribed
 * from a specification and nothing here encodes a commercial rule. Each value is chosen to be
 * comfortably beyond any honest submission and far below anything worth storing by accident — a
 * buyer describing a full formulation requirement has 5000 characters, which is several pages.
 *
 * `EMAIL` is the one principled number: 254 is the RFC 5321 maximum length of a deliverable
 * address, so a longer value could not be replied to whatever the form accepted.
 */
export const FIELD_MAX = {
  /** Given/family name. */
  NAME: 120,
  COMPANY: 200,
  /** RFC 5321's ceiling on a routable address. */
  EMAIL: 254,
  /** Deliberately generous: international formats carry country codes, extensions and separators. */
  PHONE: 40,
  COUNTRY: 120,
  INDUSTRY: 120,
  /** One-line answers — quantity, destination, packaging, a product or application name. */
  SHORT_TEXT: 200,
  /** Multi-paragraph answers — the message, a specification, additional information. */
  LONG_TEXT: 5000,
} as const;

/**
 * The ceiling on `Inquiry.productsOfInterest`, the one array either endpoint accepts.
 *
 * Nine options are specified for the control (SITE_STRUCTURE.md §10 — six product families plus
 * Petroleum Derivatives, Customized Products and Other). The cap is set above that rather than at
 * it: the column is an unconstrained `text[]` and this DTO deliberately does not close the
 * vocabulary (see `create-inquiry.dto.ts`), so the limit bounds the request size without claiming
 * to know which values are legitimate.
 */
export const PRODUCTS_OF_INTEREST_MAX_ITEMS = 20;
