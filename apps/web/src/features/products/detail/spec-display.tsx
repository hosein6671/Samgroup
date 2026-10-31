import type { ReactNode } from "react";

import type { Translate } from "@/i18n/translate";

import { unitSymbol } from "./spec-units";

/** The unit as shown on a page in `t`'s language. */
export function displayUnit(unit: string, t: Translate): string {
  return t(unitSymbol(unit));
}

/** `@ -25 °C`, `@ 100 ºC`: a single test temperature. */
const AT_TEMPERATURE = /^@\s*(-?\d+(?:\.\d+)?)\s*(?:°|º|℃)\s*C?$/;

/**
 * A test condition in the page's language, with its numbers kept left to right.
 *
 * `@ -25 °C` rendered inside a right-to-left label came out as `°C 25- @`. A temperature
 * condition is written as words plus an isolated `-25 °C`; any other condition uses the locale
 * catalog when it has the text and is isolated as one left-to-right run when it does not.
 */
export function SpecQualifier({
  qualifier,
  t,
}: {
  readonly qualifier: string;
  readonly t: Translate;
}): ReactNode {
  const temperature = AT_TEMPERATURE.exec(qualifier.trim());
  if (temperature) {
    const [before, after] = t("at {temperature}").split("{temperature}");
    return (
      <>
        {before}
        <bdi dir="ltr">{`${temperature[1]} °C`}</bdi>
        {after}
      </>
    );
  }
  const translated = t(qualifier);
  return translated === qualifier ? <bdi dir="ltr">{qualifier}</bdi> : translated;
}
