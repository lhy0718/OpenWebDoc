import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = "dist/npm";
const outputPath = resolve(outputDirectory);
const packages = [
  { name: "@openwebdoc/spec", directory: "packages/spec" },
  { name: "@openwebdoc/core", directory: "packages/core" },
  { name: "@openwebdoc/cli", directory: "packages/cli" },
  { name: "@openwebdoc/ui", directory: "packages/ui" },
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const packageInfo of packages) {
  runPnpm(["build"], packageInfo.directory);
  runPnpm(["pack", "--pack-destination", outputPath], packageInfo.directory);
}

const tarballs = (await readdir(outputDirectory)).filter((file) => file.endsWith(".tgz")).sort();
if (tarballs.length !== packages.length) {
  console.error(`Expected ${packages.length} npm tarballs, found ${tarballs.length}.`);
  process.exit(1);
}

console.log(`Packed ${tarballs.length} OpenWebDoc packages into ${outputDirectory}:`);
for (const tarball of tarballs) {
  console.log(`- ${tarball}`);
}

function runPnpm(args, cwd) {
  const result = spawnSync("pnpm", args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
