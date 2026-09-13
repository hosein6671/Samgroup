import type { NextConfig } from "next";

/**
 * Minimal by intent. Step A-3 is the design proof — the scaffold exists to render
 * `packages/ui` in a real browser for the first time, nothing more. Locale routing
 * (next-intl), the redirect middleware, image domains and the API client all arrive with
 * their own steps (docs/PROJECT_HANDOFF.md §5 step 8).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ADR-005 runs the public site as its own Node container on the VPS. Standalone output traces
  // only the runtime files the image needs, instead of copying the entire workspace dependency
  // tree into every release image.
  output: "standalone",
  // The primitives are consumed from source (packages/ui exports .tsx directly, with no build
  // step), so Next has to compile them rather than treat them as a prebuilt dependency.
  transpilePackages: ["@sam-group/ui"],
};

export default nextConfig;
