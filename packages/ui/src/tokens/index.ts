// Token barrel.
//
// This is the single authored source of every design value in the platform. The Tailwind
// theme layer (theme.generated.css) is produced from it by `pnpm --filter @sam-group/ui
// tokens:build` and committed. Non-CSS consumers that cannot read a class — Mapbox style
// JSON, Canvas 2D, OG image generation — import from here, so one value serves every
// consumer and is never redefined per consumer
// (docs/frontend/FRONTEND_ARCHITECTURE.md section 6).

export * from "./color";
export * from "./typography";
export * from "./spacing";
export * from "./motion";
export * from "./layout";
