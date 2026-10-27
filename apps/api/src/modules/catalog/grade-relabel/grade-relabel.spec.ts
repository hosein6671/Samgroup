import { planRelabel } from "./grade-relabel";

const seven = ["T-32", "T-46", "T-68", "T-32 plus", "T-46 plus", "T-68 plus", "T-100"].map(
  (label, index) => ({ id: `g${index}`, label: `HSB-${label}`, displayLabel: null }),
);

describe("planRelabel (ADR-028 §4)", () => {
  it("removes only the prefix, as a display label", () => {
    const plan = planRelabel(seven);
    expect(plan.ok && plan.changes.map((change) => change.to)).toEqual([
      "T-32",
      "T-46",
      "T-68",
      "T-32 plus",
      "T-46 plus",
      "T-68 plus",
      "T-100",
    ]);
  });
  it("is a no-op once applied", () => {
    const applied = seven.map((grade) => ({ ...grade, displayLabel: grade.label.slice(4) }));
    expect(planRelabel(applied)).toEqual({ ok: true, changes: [], unchanged: 7 });
  });
  it("refuses a missing product or an unexpected grade count", () => {
    expect(planRelabel(null).ok).toBe(false);
    expect(planRelabel(seven.slice(1)).ok).toBe(false);
  });
  it("refuses a result that would show two grades with one name", () => {
    expect(planRelabel([...seven, { id: "other", label: "T-32", displayLabel: null }]).ok).toBe(
      false,
    );
  });
});
