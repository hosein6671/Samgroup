import type { ReactNode } from "react";

/**
 * A run of Latin-script text — a product name, a grade list such as `T-32, T-46`, a unit —
 * including the spaces between its words, so `Turbine oil` stays one run.
 */
const LATIN_RUN = /[A-Za-z0-9][A-Za-z0-9\-+./°%]*(?: [A-Za-z0-9][A-Za-z0-9\-+./°%]*)*/g;

/**
 * Text with every Latin run isolated in `<bdi>` when the page is right to left.
 *
 * A Persian sentence that names `T-32، T-46` or `SAE 10W40` otherwise lets the bidi algorithm
 * reorder the hyphens and digits across the Persian commas — the scrambling the owner reported on
 * the live product page. Left-to-right pages get the text untouched.
 */
export function BidiText({
  text,
  dir,
}: {
  readonly text: string;
  readonly dir: "ltr" | "rtl";
}): ReactNode {
  if (dir === "ltr") return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    // A single token (`T-100`, `10W40`) never breaks at its own hyphen; a phrase still wraps.
    parts.push(
      <bdi key={start} className={match[0].includes(" ") ? undefined : "bidi-token"}>
        {match[0]}
      </bdi>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
