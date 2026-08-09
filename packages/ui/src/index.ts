// @sam-group/ui — the shared visual foundation for apps/web (public site and Admin Dashboard).
//
// A systems library, not a themed component kit: layout, surface and typographic primitives
// only. Visual personality belongs to the bespoke sections composed in apps/web/src/features,
// which is what keeps 27 pages from converging on one template
// (docs/frontend/FRONTEND_ARCHITECTURE.md section 6).
//
// Deliberately absent, and not an oversight: Card, Stack, Grid, Badge, Accordion, Tabs, Modal,
// form controls, Table.
//
// Stylesheets are imported by the consuming app, not from here:
//   @sam-group/ui/theme.css           tokens (generated)
//   @sam-group/ui/styles/base.css     document defaults and accessibility floors
//   @sam-group/ui/styles/surfaces.css surface behaviour and treatments
//   @sam-group/ui/styles/grid.css     the twelve-column editorial grid
//   @sam-group/ui/styles/spec.css     specification presentation
//   @sam-group/ui/styles/motion.css   the four reveal patterns (scroll-driven, no JS)

export * from "./primitives";
export * from "./tokens";
export { cn } from "./lib/cn";
