/**
 * One active redirect rule — the wire shape of `GET /seo/redirects`
 * (API_CONTRACT_FINAL.md §2.8), consumed by `apps/web`'s middleware before a route renders.
 *
 * `id` and `createdAt` are deliberately absent, as they are from LocaleResponse: middleware
 * matches on paths and needs neither, and a surrogate key that never leaves the database is
 * one fewer thing a later change can leak.
 *
 * `fromPath` and `toPath` are stored paths, not URLs. Consistent with the rest of this API,
 * composing an absolute URL is the frontend's job.
 */
export type RedirectResponse = {
  fromPath: string;
  toPath: string;
  /** 301 or 302 — the column's own default is 301. */
  statusCode: number;
  /** Null for a global rule that applies in every locale. */
  locale: string | null;
};
