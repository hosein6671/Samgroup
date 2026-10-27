/**
 * The one-off operator change ADR-028 §4 allows: set `display_label` on the seven `Turbine oil`
 * grades so the public site shows `T-32` … `T-68 plus` instead of the source's `HSB-T-*` labels.
 *
 * Pure planning only — no database here. It may write `display_label` and nothing else, only on
 * the named product's grades whose verbatim label carries the prefix, and only when exactly the
 * expected seven are found. `label` (ADR-014's verbatim source text) is never changed.
 */
export const RELABEL_ENABLE_ENV = "SAM_ALLOW_GRADE_RELABEL";
export const RELABEL_TARGET_DATABASE = "sam_platform";
/** The public slug and the approved catalogue name; both must match before anything is planned. */
export const TURBINE_OIL_SLUG = "turbine-oil";
export const TURBINE_OIL_NAME = "Turbine oil";
export const SOURCE_PREFIX = "HSB-";
export const EXPECTED_GRADE_COUNT = 7;

export type GradeRow = { id: string; label: string; displayLabel: string | null };

export type RelabelPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      changes: { id: string; label: string; from: string | null; to: string }[];
      unchanged: number;
    };

export function planRelabel(grades: readonly GradeRow[] | null): RelabelPlan {
  if (grades === null)
    return {
      ok: false,
      error: `No product "${TURBINE_OIL_NAME}" has the slug ${TURBINE_OIL_SLUG}.`,
    };
  const prefixed = grades.filter((grade) => grade.label.startsWith(SOURCE_PREFIX));
  if (prefixed.length !== EXPECTED_GRADE_COUNT)
    return {
      ok: false,
      error: `Expected ${EXPECTED_GRADE_COUNT} grades labelled ${SOURCE_PREFIX}*, found ${prefixed.length}. Nothing is changed.`,
    };
  const changes: { id: string; label: string; from: string | null; to: string }[] = [];
  let unchanged = 0;
  for (const grade of prefixed) {
    const to = grade.label.slice(SOURCE_PREFIX.length).trim();
    if (!to) return { ok: false, error: `Grade ${grade.id} has nothing after the prefix.` };
    if (grade.displayLabel === to) unchanged += 1;
    else changes.push({ id: grade.id, label: grade.label, from: grade.displayLabel, to });
  }
  // The shown name must stay unique within the product (the database index enforces it too).
  const shown = grades.map(
    (grade) =>
      changes.find((change) => change.id === grade.id)?.to ?? grade.displayLabel ?? grade.label,
  );
  if (new Set(shown).size !== shown.length)
    return { ok: false, error: "Two grades would show the same name. Nothing is changed." };
  return { ok: true, changes, unchanged };
}
