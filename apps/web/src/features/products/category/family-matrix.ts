import type {
  ProductApplicationGroupResponse,
  ProductDetailResponse,
  ProductListItemResponse,
} from "@sam-group/types";

/**
 * The data the redesigned Product Family page shows beside each product (owner-approved design,
 * 28 October 2026): a few headline properties, each as the range across the product's grades.
 *
 * Which properties is decided by the data, not per family in code: the ones most products of the
 * family publish, in a fixed order of importance. Nothing is computed beyond min and max of the
 * published numbers; a value that is not a plain number is shown as published.
 */

/** Candidate columns, most important first. Flash point methods are one column. */
const CANDIDATES = [
  "kv_40c",
  "kv_100c",
  "viscosity_index",
  "tbn",
  "ccs_viscosity",
  "pour_point",
  "flash_point",
  "density_15c",
  "drop_point",
  "grease_penetration_worked",
  "coolant_reserve_alkalinity",
] as const;

export type FamilyColumnKey = (typeof CANDIDATES)[number];

/** Short header labels; the English source is the translation key. */
export const COLUMN_LABEL: Record<FamilyColumnKey, { label: string; unit: string | null }> = {
  kv_40c: { label: "Viscosity 40 °C", unit: "cSt" },
  kv_100c: { label: "Viscosity 100 °C", unit: "cSt" },
  viscosity_index: { label: "VI", unit: null },
  tbn: { label: "TBN", unit: "mg KOH/g" },
  ccs_viscosity: { label: "CCS", unit: "mPa·s" },
  pour_point: { label: "Pour point", unit: "°C" },
  flash_point: { label: "Flash point", unit: "°C" },
  density_15c: { label: "Density 15 °C", unit: null },
  drop_point: { label: "Dropping point", unit: "°C" },
  grease_penetration_worked: { label: "Penetration", unit: null },
  coolant_reserve_alkalinity: { label: "Reserve alkalinity", unit: null },
};

/** For pour point the useful figure is how low it goes; everything else is a range. */
const LOWEST_ONLY: ReadonlySet<FamilyColumnKey> = new Set(["pour_point"]);

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function columnOf(key: string): FamilyColumnKey | null {
  if (key.startsWith("flash_point")) return "flash_point";
  return (CANDIDATES as readonly string[]).includes(key) ? (key as FamilyColumnKey) : null;
}

function valuesFor(detail: ProductDetailResponse, column: FamilyColumnKey): string[] {
  return detail.specifications
    .filter((specification) => specification.qualifier === null || specification.qualifier === "")
    .filter((specification) => columnOf(specification.key) === column)
    .map((specification) => specification.value.trim());
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/** One product's cell: `min–max`, a single value, or null when it publishes none. */
export function productCell(detail: ProductDetailResponse, column: FamilyColumnKey): string | null {
  const values = valuesFor(detail, column);
  if (values.length === 0) return null;
  const numbers = values.filter((value) => PLAIN_NUMBER.test(value)).map(Number);
  if (numbers.length !== values.length) return values[0] ?? null;
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  if (LOWEST_ONLY.has(column) || low === high) return format(low);
  return `${format(low)}–${format(high)}`;
}

/** The family's columns: those at least `minShare` of products publish, best first, at most `limit`. */
export function familyColumns(
  details: readonly ProductDetailResponse[],
  limit = 4,
  minShare = 0.3,
): FamilyColumnKey[] {
  if (details.length === 0) return [];
  const coverage = CANDIDATES.map((column) => ({
    column,
    count: details.filter((detail) => valuesFor(detail, column).length > 0).length,
  }));
  const qualifying = coverage
    .filter((entry) => entry.count / details.length >= minShare)
    .map((entry) => entry.column);
  // Industrial fluids are specified by viscosity at 40 °C; 100 °C only leads where the family is
  // an engine-oil kind (it publishes TBN), so it gives way when 40 °C is already shown.
  const redundant = qualifying.includes("kv_40c") && !qualifying.includes("tbn") ? ["kv_100c"] : [];
  return qualifying.filter((column) => !redundant.includes(column)).slice(0, limit);
}

/** The family-wide span of one column, for the hero's summary. */
export function familySpan(
  details: readonly ProductDetailResponse[],
  column: FamilyColumnKey,
): { low: string; high: string } | null {
  const numbers = details
    .flatMap((detail) => valuesFor(detail, column))
    .filter((value) => PLAIN_NUMBER.test(value))
    .map(Number);
  if (numbers.length === 0) return null;
  return { low: format(Math.min(...numbers)), high: format(Math.max(...numbers)) };
}

export type FamilyRow = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly type: string | null;
  readonly image: ProductListItemResponse["featuredImage"];
  readonly grades: readonly string[];
  /** One cell per column, in column order; null where the product publishes no value. */
  readonly cells: readonly (string | null)[];
  readonly hasData: boolean;
};

export type FamilySection = {
  /** Null for the products with no application group ("Other products"). */
  readonly group: ProductApplicationGroupResponse | null;
  readonly rows: readonly FamilyRow[];
};

/** Rows grouped by application group (ADR-029) in the family's order; ungrouped products last. */
export function familySections(
  items: readonly ProductListItemResponse[],
  details: ReadonlyMap<string, ProductDetailResponse>,
  columns: readonly FamilyColumnKey[],
): FamilySection[] {
  const sections = new Map<string, FamilySection & { rows: FamilyRow[] }>();
  for (const item of items) {
    const detail = details.get(item.slug);
    const row: FamilyRow = {
      id: item.id,
      slug: item.slug,
      name: item.name,
      type: detail?.productType?.name ?? null,
      image: item.featuredImage,
      grades: detail?.grades.map((grade) => grade.label) ?? [],
      cells: columns.map((column) => (detail ? productCell(detail, column) : null)),
      hasData: (detail?.specifications.length ?? 0) > 0,
    };
    const key = item.applicationGroup?.slug ?? "";
    const section = sections.get(key) ?? { group: item.applicationGroup, rows: [] };
    section.rows.push(row);
    sections.set(key, section);
  }
  return [...sections.values()].sort((a, b) => {
    if (a.group === null) return 1;
    if (b.group === null) return -1;
    return a.group.sortOrder - b.group.sortOrder || a.group.name.localeCompare(b.group.name);
  });
}
