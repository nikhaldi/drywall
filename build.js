import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

await build({
  entryPoints: ["src/jscpd.js"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "servers/jscpd.js",
  banner: { js: "#!/usr/bin/env node" },
  minify: true,
  treeShaking: true,
  define: { DRYWALL_VERSION: JSON.stringify(version) },
});
