import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  ["pnpm", ["audit:prod"]],
  ["pnpm", ["build"]],
  ["pnpm", ["test"]],
  ["pnpm", ["lint"]],
  ["pnpm", ["format"]],
  ["pnpm", ["conformance:check"]],
  ["pnpm", ["samples:check"]],
  ["pnpm", ["samples:export"]],
  ["pnpm", ["samples:verify-export"]],
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
checkReleaseConsistency();
checkExampleGallery();
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

function checkReleaseConsistency() {
  const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
  const expectedVersion = rootPackage.version;
  const expectedTag = `v${expectedVersion}`;
  const releaseNotePath = join("docs", "releases", `${expectedTag}.md`);
  if (!existsSync(releaseNotePath)) {
    failReleaseCheck(`Missing release notes: ${releaseNotePath}.`);
  }

  for (const packagePath of [
    "apps/openwebdoc/package.json",
    "packages/spec/package.json",
    "packages/core/package.json",
    "packages/cli/package.json",
    "packages/ui/package.json",
  ]) {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    if (packageJson.version !== expectedVersion) {
      failReleaseCheck(
        `${packagePath} version ${packageJson.version} must match root version ${expectedVersion}.`,
      );
    }
  }

  const cliSource = readFileSync("packages/cli/src/index.ts", "utf8");
  if (!cliSource.includes(`.version("${expectedVersion}")`)) {
    failReleaseCheck(`CLI reported version must be ${expectedVersion}.`);
  }

  const staleRefs = findStaleReleaseRefs(expectedVersion);
  if (staleRefs.length > 0) {
    failReleaseCheck(`Stale release references found: ${staleRefs.join(" ")}`);
  }
}

function findStaleReleaseRefs(expectedVersion) {
  const previousAlphaVersion = "0.1.0-alpha." + "3";
  const previousAlphaTag = `v${previousAlphaVersion}`;
  const allowedHistoricalFiles = new Set([
    `docs/releases/${previousAlphaTag}.md`,
    "docs/starter-pr-gate-case-study.md",
  ]);
  const staleVersionPattern = new RegExp(`v?${escapeRegExp(previousAlphaVersion)}`, "g");
  const staleRefs = [];
  for (const path of listTextFiles(".")) {
    if (allowedHistoricalFiles.has(path)) {
      continue;
    }
    const text = readFileSync(path, "utf8");
    const matches = text.match(staleVersionPattern) ?? [];
    if (matches.some((match) => match !== expectedVersion && match !== `v${expectedVersion}`)) {
      staleRefs.push(path);
    }
  }
  return staleRefs;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listTextFiles(directory) {
  const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage"]);
  const ignoredExtensions = new Set([
    ".htmlx",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".zip",
    ".tgz",
    ".gz",
  ]);
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      continue;
    }
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...listTextFiles(join(directory, entry.name)));
      }
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const path = join(directory, entry.name);
    if (ignoredExtensions.has(path.slice(path.lastIndexOf(".")))) {
      continue;
    }
    if (statSync(path).size > 1_000_000) {
      continue;
    }
    files.push(path.replace(/^\.\//, ""));
  }
  return files;
}

function checkExampleGallery() {
  const publicExampleIds = listPublicExampleIds(publicExamplesDirectory);
  const publicExampleSet = new Set(publicExampleIds);
  const galleryPath = join(examplesDirectory, "gallery.json");
  const gallery = JSON.parse(readFileSync(galleryPath, "utf8"));
  if (!Array.isArray(gallery.examples)) {
    failReleaseCheck("examples/gallery.json must contain an examples array.");
  }

  const galleryIds = [];
  for (const [index, example] of gallery.examples.entries()) {
    for (const field of [
      "id",
      "title",
      "type",
      "profile",
      "category",
      "audience",
      "description",
      "bestFor",
    ]) {
      if (typeof example[field] !== "string" || !example[field].trim()) {
        failReleaseCheck(`examples/gallery.json entry ${index} is missing ${field}.`);
      }
    }
    if (typeof example.featured !== "boolean") {
      failReleaseCheck(`examples/gallery.json entry ${example.id} must declare featured.`);
    }
    if (!publicExampleSet.has(example.id)) {
      failReleaseCheck(`Gallery example has no public package: ${example.id}.htmlx.`);
    }
    const sourceManifestPath = join(examplesDirectory, example.id, "manifest.json");
    if (!existsSync(sourceManifestPath)) {
      failReleaseCheck(
        `Gallery example has no source manifest: examples/${example.id}/manifest.json.`,
      );
    }
    const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
    if (sourceManifest.profile !== example.profile) {
      failReleaseCheck(
        `Gallery profile mismatch for ${example.id}: gallery=${example.profile}, manifest=${sourceManifest.profile}.`,
      );
    }
    galleryIds.push(example.id);
  }

  const duplicateIds = galleryIds.filter((id, index) => galleryIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    failReleaseCheck(`examples/gallery.json has duplicate ids: ${duplicateIds.join(", ")}.`);
  }

  const galleryIdSet = new Set(galleryIds);
  const missingFromGallery = publicExampleIds.filter((id) => !galleryIdSet.has(id));
  if (missingFromGallery.length > 0) {
    failReleaseCheck(`Public examples missing from gallery: ${missingFromGallery.join(", ")}.`);
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
