import type { ProductGradeSummaryResponse, ProductSpecificationResponse } from "@sam-group/types";

/**
 * The property × grade view of a product's published specifications (redesign, 28 October 2026).
 *
 * One row per property (and test condition), one column per grade, so every grade can be compared
 * at a glance. A product with no `ProductGrade` children gets a single unnamed column. Nothing is
 * computed or converted: a cell is the published value string exactly as served.
 */

/** Display order: the properties a buyer compares first lead, the rest follow alphabetically. */
const PRIORITY = [
  "kv_40c",
  "kv_100c",
  "viscosity_index",
  "ccs_viscosity",
  "tbn",
  "pour_point",
  "flash_point_coc",
  "flash_point_oc",
  "flash_point",
  "density_15c",
  "freezing_point",
  "boiling_point",
  "grease_penetration_worked",
  "drop_point",
];

function rank(key: string): number {
  const index = PRIORITY.indexOf(key);
  return index === -1 ? PRIORITY.length : index;
}

export type SpecMatrixRow = {
  /** `key` plus the test condition, so two conditions of one property stay two rows. */
  readonly id: string;
  readonly key: string;
  readonly qualifier: string | null;
  /** The unit when every cell of the row shares it; null otherwise (then it stays in the cell). */
  readonly unit: string | null;
  readonly method: string | null;
  /** Cell text by column label; absent when that grade publishes no value for the property. */
  readonly cells: ReadonlyMap<string, string>;
};

export type SpecMatrix = {
  /** Column labels in the product's grade order; `[""]` for a product without grades. */
  readonly columns: readonly string[];
  readonly rows: readonly SpecMatrixRow[];
};

export function buildSpecMatrix(
  specifications: readonly ProductSpecificationResponse[],
  grades: readonly ProductGradeSummaryResponse[],
): SpecMatrix {
  const columns = grades.length > 0 ? grades.map((grade) => grade.label) : [""];
  const groups = new Map<string, ProductSpecificationResponse[]>();
  for (const specification of specifications) {
    const id = `${specification.key}\u0000${specification.qualifier ?? ""}`;
    groups.set(id, [...(groups.get(id) ?? []), specification]);
  }
  const rows = [...groups.entries()].map(([id, items]): SpecMatrixRow => {
    const units = new Set(items.map((item) => item.unit ?? ""));
    const sharedUnit = units.size === 1 ? [...units][0] || null : null;
    const methods = new Set(items.map((item) => item.method).filter((method) => method));
    const cells = new Map<string, string>();
    for (const item of items) {
      const column = item.grade?.label ?? (grades.length > 0 ? null : "");
      // A product-level value on a graded product applies to every grade.
      const targets = column === null ? columns : [column];
      const text = sharedUnit === null && item.unit ? `${item.value} ${item.unit}` : item.value;
      for (const target of targets) if (!cells.has(target)) cells.set(target, text);
    }
    const first = items[0] as ProductSpecificationResponse;
    return {
      id,
      key: first.key,
      qualifier: first.qualifier,
      unit: sharedUnit,
      method:
        methods.size === 1
          ? ([...methods][0] ?? null)
          : methods.size > 1
            ? [...methods].join(" · ")
            : null,
      cells,
    };
  });
  rows.sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
  return { columns, rows };
}

export type KeyMetric = {
  readonly key: string;
  readonly value: string;
  readonly unit: string | null;
  readonly method: string | null;
  /**
   * Where this grade sits between the product's lowest and highest published value, 0–100, for
   * the meter bar. Null when the product has one grade or the values are not plain numbers.
   */
  readonly position: number | null;
};

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/** Up to `limit` headline values of the active column, in display order, for the hero. */
export function keyMetrics(matrix: SpecMatrix, column: string, limit = 4): KeyMetric[] {
  const metrics: KeyMetric[] = [];
  for (const row of matrix.rows) {
    if (row.qualifier !== null || rank(row.key) === PRIORITY.length) continue;
    const value = row.cells.get(column);
    if (value === undefined) continue;
    // One flash point is enough in the hero, whichever method the product publishes.
    if (row.key.startsWith("flash_point") && metrics.some((m) => m.key.startsWith("flash_point")))
      continue;
    const numbers = [...row.cells.values()].filter((cell) => PLAIN_NUMBER.test(cell)).map(Number);
    let position: number | null = null;
    if (PLAIN_NUMBER.test(value) && numbers.length > 1) {
      const low = Math.min(...numbers);
      const high = Math.max(...numbers);
      position = high === low ? 100 : Math.round(((Number(value) - low) / (high - low)) * 100);
    }
    metrics.push({ key: row.key, value, unit: row.unit, method: row.method, position });
    if (metrics.length === limit) break;
  }
  return metrics;
}
