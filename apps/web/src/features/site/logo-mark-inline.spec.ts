import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { LOGO_MARK_DATA_URI } from "./logo-mark-inline";

/** The loader's inline mark is the shipped 256px file, byte for byte — never a drifted copy. */
describe("LOGO_MARK_DATA_URI", () => {
  it("is exactly public/brand/sam-group-mark-256.png", () => {
    const file = readFileSync(resolve(__dirname, "../../../public/brand/sam-group-mark-256.png"));
    expect(LOGO_MARK_DATA_URI).toBe(`data:image/png;base64,${file.toString("base64")}`);
  });
});
