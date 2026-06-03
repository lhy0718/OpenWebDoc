import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { unpackHtmlx } from "@openwebdoc/core";
import {
  compareFileMaps,
  readDirectoryFileMap,
  scanFileMapForAbsolutePaths,
} from "./release-check-helpers.mjs";

const manifestPath = "samples/template-repos.json";
const outputRoot = "dist/sample-repos";
const expectedActionRef = "lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.1";
const cliPath = "packages/cli/dist/index.js";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.repositories) || manifest.repositories.length === 0) {
  fail("samples/template-repos.json must declare at least one repository.");
}
if (!existsSync(outputRoot)) {
  fail(`Missing exported sample repository directory: ${outputRoot}. Run pnpm samples:export.`);
}

for (const repository of manifest.repositories) {
  verifyRepository(repository);
}

console.log(`Verified ${manifest.repositories.length} exported OpenWebDoc sample repositories.`);

function verifyRepository(repository) {
  const directory = join(outputRoot, repository.id);
  for (const field of ["id", "source", "description", "url"]) {
    if (typeof repository[field] !== "string" || !repository[field].trim()) {
      fail(`Template repository entry is missing ${field}.`);
    }
  }
  if (!existsSync(directory)) {
    fail(`Missing exported sample repository: ${directory}.`);
  }
  const expectedUrl = `https://github.com/lhy0718/${repository.id}`;
  if (repository.url !== expectedUrl) {
    fail(`Template repository URL must be ${expectedUrl}, found ${repository.url}.`);
  }
  for (const required of [
    "README.md",
    "LICENSE",
    "TEMPLATE_REPOSITORY.md",
    ".github/workflows/validate-htmlx.yml",
  ]) {
    if (!existsSync(join(directory, required))) {
      fail(`Exported sample repository missing ${required}: ${directory}.`);
    }
  }

  const workflow = readFileSync(join(directory, ".github/workflows/validate-htmlx.yml"), "utf8");
  if (!workflow.includes(expectedActionRef)) {
    fail(`${repository.id} workflow must pin the OpenWebDoc action to ${expectedActionRef}.`);
  }
  if (workflow.includes("@main")) {
    fail(`${repository.id} workflow must not use @main for external adoption.`);
  }

  const sourceFiles = readDirectoryFileMap(repository.source);
  const exportedFiles = readDirectoryFileMap(directory);
  exportedFiles.delete("TEMPLATE_REPOSITORY.md");
  const comparison = compareFileMaps(sourceFiles, exportedFiles);
  if (!comparison.ok) {
    fail(
      [
        `Exported sample repository drift detected: ${repository.id}.`,
        comparison.missing.length ? `Missing from export: ${comparison.missing.join(", ")}.` : "",
        comparison.extra.length ? `Extra in export: ${comparison.extra.join(", ")}.` : "",
        comparison.different.length ? `Different content: ${comparison.different.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const pathFailures = scanFileMapForAbsolutePaths(readDirectoryFileMap(directory));
  if (pathFailures.length > 0) {
    fail(
      `Exported sample repository contains private or absolute paths: ${repository.id}: ${pathFailures.join(
        " ",
      )}`,
    );
  }

  const htmlxFiles = [...exportedFiles.keys()]
    .filter((path) => path.endsWith(".htmlx"))
    .map((path) => join(directory, path))
    .sort();
  if (htmlxFiles.length === 0) {
    fail(`Exported sample repository has no .htmlx package: ${repository.id}.`);
  }
  for (const htmlxFile of htmlxFiles) {
    const result = spawnSync(process.execPath, [cliPath, "validate", htmlxFile, "--json"], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      fail(`Exported sample package failed validation: ${htmlxFile}. ${compactOutput(result)}`);
    }
    const packedPathFailures = scanFileMapForAbsolutePaths(
      unpackHtmlx(readFileSync(htmlxFile)),
      new Set(["mimetype"]),
    );
    if (packedPathFailures.length > 0) {
      fail(
        `Exported sample package contains private or absolute paths: ${packedPathFailures.join(
          " ",
        )}`,
      );
    }
  }
}

function compactOutput(result) {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join(" ");
}

function fail(message) {
  console.error(`Sample repository export verification failed: ${message}`);
  process.exit(1);
}
