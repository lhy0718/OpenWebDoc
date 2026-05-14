import { rm } from "node:fs/promises";

const directories = [
  "dist",
  "packages/spec/dist",
  "packages/core/dist",
  "packages/cli/dist",
  "packages/ui/dist",
  "apps/viewer/dist",
  "apps/editor/dist",
];

for (const directory of directories) {
  await rm(directory, { recursive: true, force: true });
}

console.log("Removed OpenWebDoc build artifacts.");
