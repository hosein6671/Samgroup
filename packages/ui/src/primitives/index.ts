// Primitive barrel.
//
// Every primitive here is a Server Component. Nothing in this package carries "use client",
// and nothing should: a single client directive reachable through this barrel would opt every
// consumer of it out of server rendering, silently, and the first-load JS budget
// (docs/frontend/FRONTEND_ARCHITECTURE.md section 13) has no room for that.
//
// When an interactive primitive eventually exists it gets its own subpath export, never a
// place in this file.

export { Button, buttonClasses } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";

export { Container } from "./container";
// ContainerWidth is not re-exported here: it is a layout token, exported from ./tokens.
export type { ContainerElement, ContainerProps } from "./container";

export { Divider } from "./divider";
export type { DividerOrientation, DividerProps, DividerVariant } from "./divider";

export { EditorialGrid, GridArea } from "./editorial-grid";
export type {
  EditorialGridElement,
  EditorialGridProps,
  GridAreaElement,
  GridAreaProps,
  GridPlacement,
} from "./editorial-grid";

export { IndustrialGlassPanel } from "./industrial-glass-panel";
export type { GlassPanelElement, IndustrialGlassPanelProps } from "./industrial-glass-panel";

export { Section } from "./section";
export type { SectionElement, SectionProps, SectionRhythm } from "./section";

export { SpecItem, SpecList } from "./spec-list";
export type { SpecItemProps, SpecListLayout, SpecListProps, SpecListScale } from "./spec-list";

export { Surface } from "./surface";
export type { SurfaceContext, SurfaceElement, SurfaceProps } from "./surface";

export { TechnicalLabel } from "./technical-label";
export type {
  TechnicalLabelElement,
  TechnicalLabelProps,
  TechnicalLabelTone,
} from "./technical-label";

export { Text } from "./text";
export type { TextElement, TextProps, TextRole, TextTone } from "./text";

export { VisuallyHidden } from "./visually-hidden";
export type { VisuallyHiddenElement, VisuallyHiddenProps } from "./visually-hidden";
