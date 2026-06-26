// Bundle the backend into a single self-contained ESM file.
//
// Why bundle: the app and @opero/shared use extensionless relative imports
// (moduleResolution: "bundler"), which tsx resolves in dev but plain `node`
// rejects at runtime ("Cannot find module './types'"). esbuild resolves every
// import ahead of time and inlines @opero/shared, so dist/index.js runs under
// plain node with no extension/workspace-resolution problems.
//
// We inline our workspace package (@opero/shared) but keep all real npm
// dependencies external (resolved from node_modules at runtime). @prisma/client
// in particular MUST stay external — it ships native query-engine binaries.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));

// Everything in dependencies/devDependencies stays external EXCEPT workspace
// packages (those we want bundled so their TS source is resolved at build time).
const external = Object.entries({
  ...pkg.dependencies,
  ...pkg.devDependencies,
})
  .filter(([, version]) => !version.startsWith("workspace:"))
  .map(([name]) => name);

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
});
