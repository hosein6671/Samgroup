import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * Specification presentation — the primitive that carries the engineering register.
 *
 * A lubricant grade is a set of measured values against named test methods: "Kinematic
 * Viscosity @ 40°C · 46.0 mm²/s · ASTM D445". Rendering that as prose, or as generic cards,
 * throws away the thing that signals a manufacturer rather than a trader. This is the primitive
 * that treats measured data as a designed artefact.
 *
 * Semantically a description list, because that is what it is: term and value. Screen readers
 * announce the pairing, and the value reads naturally with its unit ("46.0 mm²/s") because unit
 * and value are adjacent inline text rather than separate columns.
 *
 * It is emphatically not a card system. There is no border, no elevation and no container
 * chrome — those belong to whatever composes it.
 */
export type SpecListLayout = "rows" | "stacked";
export type SpecListScale = "default" | "feature";

export type SpecListProps = {
  /**
   * `rows` is the specification sheet: label and value on one line, hairline separated.
   * `stacked` puts the label above the value, for figure blocks and hero statistics.
   */
  readonly layout?: SpecListLayout;
  /**
   * `feature` renders values at display scale for storytelling moments — a capacity figure,
   * a purity percentage — without needing a second primitive.
   */
  readonly scale?: SpecListScale;
  readonly children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDListElement>, "children">;

export function SpecList({
  layout = "rows",
  scale = "default",
  className,
  children,
  ...rest
}: SpecListProps): ReactNode {
  return (
    <dl
      data-spec-layout={layout}
      data-spec-scale={scale}
      className={cn("spec-list", className)}
      {...rest}
    >
      {children}
    </dl>
  );
}

export type SpecItemProps = {
  /** What was measured, or what is certified. */
  readonly label: ReactNode;
  /**
   * The measured value. Optional: a certification row is a label and a standard with no
   * number attached.
   */
  readonly value?: ReactNode;
  /** Unit of measure, kept adjacent to the value so it reads as one quantity. */
  readonly unit?: ReactNode;
  /**
   * Test method, specification or certification reference — ASTM D445, ISO 9001, API SN.
   * Rendered in the technical register, subordinate to the value.
   */
  readonly standard?: ReactNode;
  readonly className?: string;
};

/**
 * One measured row. Content always arrives as props from CMS or catalog data — a hardcoded
 * specification is the same class of defect as a hardcoded translation string
 * (docs/CODING_STANDARDS.md).
 */
export function SpecItem({ label, value, unit, standard, className }: SpecItemProps): ReactNode {
  return (
    <div className={cn("spec-item", className)}>
      <dt className="spec-item__label technical-label">{label}</dt>
      <dd className="spec-item__value">
        {value !== undefined && <span className="spec-item__figure tabular">{value}</span>}
        {unit !== undefined && <span className="spec-item__unit">{unit}</span>}
        {standard !== undefined && (
          <span className="spec-item__standard technical-label">{standard}</span>
        )}
      </dd>
    </div>
  );
}
