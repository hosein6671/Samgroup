import { createHash } from "node:crypto";

import { canonicalJson } from "../manifest";

import type { CoolantNormalizationPatch } from "./patch";

export function incrementalPatchHash(patch: CoolantNormalizationPatch): string {
  return createHash("sha256").update(canonicalJson(patch), "utf8").digest("hex");
}
