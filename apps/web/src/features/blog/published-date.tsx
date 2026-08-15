import type { ReactNode } from "react";

/**
 * A post's publication date, formatted for the active locale.
 *
 * ── Why this is a component and not a helper ────────────────────────────────
 *
 * Both surfaces that show a date — the index card and the article header — must render it the same
 * way, and both must emit the machine-readable value alongside the human one. A shared function
 * returning a string would have let one of them forget the `<time dateTime>` wrapper, which is the
 * part a crawler and an assistive technology actually read.
 *
 * ── `timeZone: "UTC"`, deliberately ─────────────────────────────────────────
 *
 * `publishedAt` is stored as `timestamptz` and serialized as ISO 8601 in UTC. Formatting it in the
 * server's local zone would make the rendered date depend on where the process happens to run — a
 * post published at 21:00 UTC would show one day in London and another in Tehran, from the same
 * response. Pinning the zone makes the rendered date a property of the record.
 *
 * ── The calendar is the locale's own ────────────────────────────────────────
 *
 * `Intl.DateTimeFormat("fa", …)` uses the Persian calendar and `"ar"` the Gregorian one with Arabic
 * numerals, because that is what those locales mean. Nothing is chosen here beyond passing the
 * locale through; overriding either would be this component deciding how a language writes a date.
 *
 * A malformed or unsupported value falls back to the ISO date, never to an invented one or to
 * "Invalid Date" — the string came from the API and this component is not the place to fail on it.
 */
export function PublishedDate({
  iso,
  locale,
  className,
}: {
  /** The API's `publishedAt`, an ISO 8601 string. */
  readonly iso: string;
  /** The active locale segment, passed straight to `Intl`. */
  readonly locale: string;
  readonly className?: string;
}): ReactNode {
  const parsed = new Date(iso);
  const valid = !Number.isNaN(parsed.getTime());

  let label = iso.slice(0, 10);

  if (valid) {
    try {
      label = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(parsed);
    } catch {
      // An unsupported locale tag. The ISO date already assigned above is the answer.
    }
  }

  return (
    <time className={className} dateTime={iso}>
      {label}
    </time>
  );
}
