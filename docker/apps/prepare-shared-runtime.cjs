// Run only inside the image build, after type checking. Node cannot execute
// TypeScript from a deployed node_modules workspace package.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const app = process.argv[2];
if (!["api", "cms"].includes(app)) throw new Error("Expected api or cms");
const ts = createRequire(path.resolve(`apps/${app}/package.json`))("typescript");
const root = path.resolve("packages/types");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
for (const name of ["structural-content", "structural-lists"]) {
  const source = fs.readFileSync(path.join(root, "src", `${name}.ts`), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  fs.writeFileSync(path.join(root, "dist", `${name}.js`), result.outputText);
  manifest.exports[`./${name}`] = {
    types: `./src/${name}.ts`,
    default: `./dist/${name}.js`,
  };
}
fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(manifest, null, 2) + "\n");

const release = process.argv[3];
if (release) {
  if (release !== `/release/${app === "api" ? "api" : "cms-cli"}`)
    throw new Error("Unexpected release directory");
  // Legacy pnpm deploy can retain links back into the build workspace.
  // Materialize only our known workspace packages, never external dependencies.
  for (const name of app === "cms" ? ["types", "tsconfig"] : ["types"]) {
    const target = path.join(release, "node_modules/@sam-group", name);
    if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
    fs.cpSync(path.resolve("packages", name), target, {
      recursive: true,
      filter: (source) => !source.split(path.sep).includes("node_modules"),
    });
  }
}
