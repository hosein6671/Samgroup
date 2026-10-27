import { Fragment, type ReactNode } from "react";

/**
 * A run of Latin text — a grade, a code, a number list — inside a sentence that may be Persian.
 *
 * Starts at a Latin letter or a digit and continues through the separators a grade line uses
 * (`/`, `·`, `-`, `+`, `.`, `%`, `°`) as long as Latin text follows them.
 */
const LATIN_RUN = /[A-Za-z0-9][A-Za-z0-9.%°]*(?:[\s/·:+\-–×.,]+[A-Za-z0-9][A-Za-z0-9.%°]*)*/g;

/**
 * Text with every Latin run isolated left-to-right.
 *
 * Under `dir="rtl"`, neutral separators between numbers take the paragraph's direction, so
 * "گروه I · SN 150 / 350 / 500 / 650" displays as "650 / 500 / 350 / I · SN 150". Wrapping each
 * Latin run in `<bdi dir="ltr">` keeps it in its own order. Text with no Persian or Arabic letter
 * in it is returned unchanged, so English output is byte-for-byte what it was.
 */
export function isolateLatin(text: string): ReactNode {
  if (!/[؀-ۿ]/.test(text)) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <bdi dir="ltr" key={start}>
        {match[0]}
      </bdi>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
