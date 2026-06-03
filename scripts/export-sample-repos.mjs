import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const manifestPath = "samples/template-repos.json";
const outputRoot = "dist/sample-repos";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!Array.isArray(manifest.repositories) || manifest.repositories.length === 0) {
  fail("samples/template-repos.json must declare at least one repository.");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const repository of manifest.repositories) {
  validateRepositoryEntry(repository);
  const destination = join(outputRoot, repository.id);
  await cp(repository.source, destination, { recursive: true });
  await writeFile(join(destination, "TEMPLATE_REPOSITORY.md"), templateReadme(repository), "utf8");
}

console.log(
  `Exported ${manifest.repositories.length} OpenWebDoc sample repositories to ${outputRoot}.`,
);

function validateRepositoryEntry(repository) {
  if (!repository || typeof repository !== "object") {
    fail("Template repository entries must be objects.");
  }
  for (const field of ["id", "source", "description"]) {
    if (typeof repository[field] !== "string" || !repository[field].trim()) {
      fail(`Template repository entry is missing ${field}.`);
    }
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(repository.id)) {
    fail(`Template repository id must be kebab-case: ${repository.id}`);
  }
  if (!existsSync(repository.source)) {
    fail(`Template repository source does not exist: ${repository.source}`);
  }
  for (const required of ["README.md", ".github/workflows/validate-htmlx.yml"]) {
    if (!existsSync(join(repository.source, required))) {
      fail(`Template repository source missing ${required}: ${repository.source}`);
    }
  }
}

function templateReadme(repository) {
  return `# Template Repository Notes

Repository candidate: \`${repository.id}\`

${repository.description}

This directory was exported from the OpenWebDoc sample skeleton at \`${repository.source}\`.

Before publishing it as a separate repository:

1. Run the HTMLX validation workflow on a pull request.
2. Keep the OpenWebDoc validator action pinned to a release tag or full commit SHA.
3. Confirm the README describes what CI proves and what remains human review.
4. Confirm the package opens in the public OpenWebDoc app after download.

See the OpenWebDoc repository for conformance, issue-code recovery, and action-pinning guidance.
`;
}

function fail(message) {
  console.error(`Sample repository export failed: ${message}`);
  process.exit(1);
}
