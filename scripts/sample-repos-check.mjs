import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { unpackHtmlx } from "@openwebdoc/core";
import { scanFileMapForAbsolutePaths } from "./release-check-helpers.mjs";

const samplesRoot = "samples";
const templateManifestPath = join(samplesRoot, "template-repos.json");
const expectedActionRef = "lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.1";
const cliPath = "packages/cli/dist/index.js";

const sampleIds = readdirSync(samplesRoot)
  .filter((entry) => entry.startsWith("external-"))
  .sort();

if (sampleIds.length < 3) {
  fail(`Expected at least 3 external sample repositories, found ${sampleIds.length}.`);
}

checkTemplateManifest(sampleIds);

for (const sampleId of sampleIds) {
  const sampleDirectory = join(samplesRoot, sampleId);
  checkRequiredFile(sampleDirectory, "README.md");
  checkRequiredFile(sampleDirectory, "LICENSE");
  const workflowPath = join(sampleDirectory, ".github/workflows/validate-htmlx.yml");
  checkRequiredFile(sampleDirectory, ".github/workflows/validate-htmlx.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  if (!workflow.includes(expectedActionRef)) {
    fail(`${sampleId} workflow must pin the OpenWebDoc action to ${expectedActionRef}.`);
  }
  if (workflow.includes("@main")) {
    fail(`${sampleId} workflow must not use @main for external adoption.`);
  }

  const htmlxFiles = findFiles(sampleDirectory, ".htmlx");
  if (htmlxFiles.length === 0) {
    fail(`${sampleId} must include at least one .htmlx package.`);
  }

  for (const htmlxFile of htmlxFiles) {
    const result = spawnSync(process.execPath, [cliPath, "validate", htmlxFile, "--json"], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      fail(`Sample package failed validation: ${htmlxFile}. ${compactOutput(result)}`);
    }
    const packedPathFailures = scanFileMapForAbsolutePaths(
      unpackHtmlx(readFileSync(htmlxFile)),
      new Set(["mimetype"]),
    );
    if (packedPathFailures.length > 0) {
      fail(`Sample package contains private or absolute paths: ${packedPathFailures.join(" ")}`);
    }
  }
}

console.log(`OpenWebDoc sample repository check passed: ${sampleIds.length} samples.`);

function checkTemplateManifest(sampleIds) {
  checkRequiredFile(samplesRoot, "template-repos.json");
  const manifest = JSON.parse(readFileSync(templateManifestPath, "utf8"));
  if (!Array.isArray(manifest.repositories) || manifest.repositories.length !== sampleIds.length) {
    fail(
      `samples/template-repos.json must declare exactly ${sampleIds.length} repositories matching external samples.`,
    );
  }
  const sampleSourceSet = new Set(sampleIds.map((sampleId) => join(samplesRoot, sampleId)));
  const seenIds = new Set();
  const seenSources = new Set();

  for (const [index, repository] of manifest.repositories.entries()) {
    for (const field of ["id", "source", "description", "url"]) {
      if (typeof repository[field] !== "string" || !repository[field].trim()) {
        fail(`samples/template-repos.json entry ${index} is missing ${field}.`);
      }
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(repository.id)) {
      fail(`Template repository id must be kebab-case: ${repository.id}.`);
    }
    if (seenIds.has(repository.id)) {
      fail(`Duplicate template repository id: ${repository.id}.`);
    }
    seenIds.add(repository.id);
    if (seenSources.has(repository.source)) {
      fail(`Duplicate template repository source: ${repository.source}.`);
    }
    seenSources.add(repository.source);
    if (!sampleSourceSet.has(repository.source)) {
      fail(`Template repository source must match an external sample: ${repository.source}.`);
    }
    const expectedUrl = `https://github.com/lhy0718/${repository.id}`;
    if (repository.url !== expectedUrl) {
      fail(`Template repository URL must be ${expectedUrl}, found ${repository.url}.`);
    }
  }
}

function checkRequiredFile(directory, relativePath) {
  const path = join(directory, relativePath);
  if (!existsSync(path)) {
    fail(`Missing sample file: ${path}`);
  }
}

function findFiles(directory, extension) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(path, extension));
    } else if (entry.isFile() && path.endsWith(extension)) {
      files.push(path);
    }
  }
  return files.sort();
}

function compactOutput(result) {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join(" ");
}

function fail(message) {
  console.error(`Sample repository check failed: ${message}`);
  process.exit(1);
}
