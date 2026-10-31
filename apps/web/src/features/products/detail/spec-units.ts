/**
 * How a published unit and test condition are shown — display only, never written back.
 *
 * The catalogue keeps each unit exactly as the source data sheet spelled it (`Cst`, `ºC`, `Cp`,
 * `MgKOH/g`, `Kg/m³`). The page shows the standard symbol instead, so one table does not print
 * `cSt` on one row and `Cst` on the next. A unit that is a word (`minutes`) goes through the
 * locale catalog; a symbol is never translated.
 */
const UNIT_SYMBOL: Readonly<Record<string, string>> = {
  Cst: "cSt",
  cst: "cSt",
  Cp: "cP",
  cp: "cP",
  ºC: "°C",
  "℃": "°C",
  MgKOH: "mg KOH",
  "MgKOH/g": "mg KOH/g",
  "mgKOH/g": "mg KOH/g",
  "Kg/m³": "kg/m³",
  "mm²/sec": "mm²/s",
};

/** The standard symbol for a published unit; unknown units pass through trimmed. */
export function unitSymbol(unit: string): string {
  return UNIT_SYMBOL[unit.trim()] ?? unit.trim();
}
