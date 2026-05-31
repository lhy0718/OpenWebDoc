import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bytesEqual,
  compareFileMaps,
  listHtmlxPackageIds,
  listPublicExampleIds,
  readDirectoryFileMap,
  scanFileMapForAbsolutePaths,
} from "./release-check-helpers.mjs";

const examplesDirectory = "examples";
const publicExamplesDirectory = "apps/openwebdoc/public/examples";
const securityInvalidId = "security-invalid";
const exampleIds = listHtmlxPackageIds(examplesDirectory);
const validExampleIds = exampleIds.filter((exampleId) => exampleId !== securityInvalidId);
const examplePackages = exampleIds.map((exampleId) => `${exampleId}.htmlx`);

const commands = [
  ["pnpm", ["clean"]],
  ["pnpm", ["guard:repo"]],
  ["pnpm", ["build"]],
  ["pnpm", ["test"]],
  ["pnpm", ["lint"]],
  ["pnpm", ["format"]],
  ...examplePackages.map((examplePackage) => [
    "node",
    ["packages/cli/dist/index.js", "validate", `examples/${examplePackage}`],
    { expectFailure: examplePackage === `${securityInvalidId}.htmlx` },
  ]),
];

for (const [command, args, options] of commands) {
  run(command, args, options);
}

await checkExampleMetadataFreshness();
await checkExampleArtifactDrift();

run("pnpm", ["pack:packages"]);
run("pnpm", ["site:build"]);

console.log("OpenWebDoc release check passed.");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  const failed = result.status !== 0;
  if (options.expectFailure) {
    if (!failed) {
      console.error(`Expected command to fail: ${command} ${args.join(" ")}`);
      process.exit(1);
    }
    return;
  }
  if (failed) {
    process.exit(result.status ?? 1);
  }
}

async function checkExampleMetadataFreshness() {
  for (const exampleId of validExampleIds) {
    const sourceDirectory = join(examplesDirectory, exampleId);
    if (!existsSync(sourceDirectory)) {
      failReleaseCheck(`Missing source directory for examples/${exampleId}.htmlx.`);
    }
    run("node", [
      "packages/cli/dist/index.js",
      "refresh-metadata",
      sourceDirectory,
      "--check",
      "--json",
    ]);
  }
}

async function checkExampleArtifactDrift() {
  const { unpackHtmlx } = await import("@openwebdoc/core");
  const publicExampleIds = listPublicExampleIds(publicExamplesDirectory);
  const validExampleSet = new Set(validExampleIds);

  for (const publicExampleId of publicExampleIds) {
    if (!validExampleSet.has(publicExampleId)) {
      failReleaseCheck(`Public example has no matching source package: ${publicExampleId}.htmlx.`);
    }
  }

  for (const exampleId of validExampleIds) {
    const sourceDirectory = join(examplesDirectory, exampleId);
    const packagePath = join(examplesDirectory, `${exampleId}.htmlx`);
    const sourceFiles = readDirectoryFileMap(sourceDirectory);
    const packageFiles = unpackHtmlx(readFileSync(packagePath));
    const packageComparison = compareFileMaps(sourceFiles, packageFiles, new Set(["mimetype"]));
    if (!packageComparison.ok) {
      failReleaseCheck(
        [
          `Packed package drift detected for examples/${exampleId}.htmlx.`,
          packageComparison.missing.length
            ? `Missing from package: ${packageComparison.missing.join(", ")}.`
            : "",
          packageComparison.extra.length
            ? `Extra in package: ${packageComparison.extra.join(", ")}.`
            : "",
          packageComparison.different.length
            ? `Different content: ${packageComparison.different.join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    const privatePathFailures = scanFileMapForAbsolutePaths(packageFiles, new Set(["mimetype"]));
    if (privatePathFailures.length > 0) {
      failReleaseCheck(
        `Packed package contains private or absolute paths: examples/${exampleId}.htmlx: ${privatePathFailures.join(
          " ",
        )}`,
      );
    }

    const publicPackagePath = join(publicExamplesDirectory, `${exampleId}.htmlx`);
    if (existsSync(publicPackagePath)) {
      const sourceBytes = readFileSync(packagePath);
      const publicBytes = readFileSync(publicPackagePath);
      if (!bytesEqual(sourceBytes, publicBytes)) {
        failReleaseCheck(`Public example copy differs from source package: ${publicPackagePath}.`);
      }
    }
  }
}

function failReleaseCheck(message) {
  console.error(`Release check failed: ${message}`);
  process.exit(1);
}
