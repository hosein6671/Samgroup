import { withPayload } from "@payloadcms/next/withPayload";

import type { NextConfig } from "next";

/**
 * Payload 3 runs fully inside Next.js — the admin UI and the REST API are routes of this
 * application, not a separate server (DEVOPS.md §Services). `withPayload` is what wires the config
 * into the build.
 *
 * `output: "standalone"` matches what `apps/web` will need for the same reason: on the VPS this is
 * a container serving itself with `node`, not a managed platform (DEVOPS.md §Public routing).
 */
const nextConfig: NextConfig = {
  output: "standalone",
};

export default withPayload(nextConfig);
