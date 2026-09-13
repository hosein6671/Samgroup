const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("deployed shared exports run in Node without a TypeScript loader", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sam-shared-runtime-"));
  fs.mkdirSync(path.join(root, "apps/api"), { recursive: true });
  fs.writeFileSync(path.join(root, "apps/api/package.json"), "{}");
  fs.mkdirSync(path.join(root, "packages"));
  fs.cpSync("packages/types", path.join(root, "packages/types"), {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });
  execFileSync(process.execPath, [path.resolve("docker/apps/prepare-shared-runtime.cjs"), "api"], {
    cwd: root,
    env: { ...process.env, NODE_PATH: path.resolve("apps/api/node_modules") },
  });
  const target = path.join(root, "node_modules/@sam-group/types");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(root, "packages/types"), target, { recursive: true });
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      "console.log(require('@sam-group/types/structural-content').STRUCTURAL_DEFAULTS.header.brand.name); console.log(require('@sam-group/types/structural-lists').structuralLists('header').navigation.length)",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(output.trim(), "SAM GROUP\n6");
});
