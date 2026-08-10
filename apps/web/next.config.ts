import type { NextConfig } from "next";

/**
 * Minimal by intent. Step A-3 is the design proof — the scaffold exists to render
 * `packages/ui` in a real browser for the first time, nothing more. Locale routing
 * (next-intl), the redirect middleware, image domains and the API client all arrive with
 * their own steps (docs/PROJECT_HANDOFF.md §5 step 8).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The primitives are consumed from source (packages/ui exports .tsx directly, with no build
  // step), so Next has to compile them rather than treat them as a prebuilt dependency.
  transpilePackages: ["@sam-group/ui"],
};

export default nextConfig;
