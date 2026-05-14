import { spawnSync } from "node:child_process";

const commands = [
  ["pnpm", ["clean"]],
  ["pnpm", ["guard:repo"]],
  ["pnpm", ["build"]],
  ["pnpm", ["test"]],
  ["pnpm", ["lint"]],
  ["pnpm", ["format"]],
  ["node", ["packages/cli/dist/index.js", "validate", "examples/basic.htmlx"]],
  [
    "node",
    ["packages/cli/dist/index.js", "validate", "examples/security-invalid.htmlx"],
    { expectFailure: true },
  ],
  ["pnpm", ["pack:packages"]],
  ["pnpm", ["site:build"]],
];

for (const [command, args, options] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  const failed = result.status !== 0;
  if (options?.expectFailure) {
    if (!failed) {
      console.error(`Expected command to fail: ${command} ${args.join(" ")}`);
      process.exit(1);
    }
    continue;
  }
  if (failed) {
    process.exit(result.status ?? 1);
  }
}

console.log("OpenWebDoc release check passed.");
