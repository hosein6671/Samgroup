import type { ReactNode } from "react";

import { HomeExperience } from "@/features/home/home-experience";

/**
 * The Sam Group flagship homepage, on a proof route.
 *
 * It lives here rather than at `app/[locale]/page.tsx` because locale routing does not exist
 * yet and the CMS that owns this copy arrives in M2. Building the real route now would mean
 * shipping a homepage whose content is hardcoded — the one thing the frozen decisions rule out
 * (docs/PROJECT_HANDOFF.md §6.7).
 */
export default function HomeProofPage(): ReactNode {
  return <HomeExperience />;
}
