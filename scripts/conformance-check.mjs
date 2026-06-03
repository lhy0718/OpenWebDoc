import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const manifestPath = "examples/conformance/cases.json";
const { cases } = JSON.parse(readFileSync(manifestPath, "utf8"));
const cliPath = "packages/cli/dist/index.js";

if (!Array.isArray(cases)) {
  fail("examples/conformance/cases.json must contain a cases array.");
}

for (const testCase of cases) {
  validateCaseShape(testCase);
  const casePath = join("examples/conformance", testCase.path);
  const result = spawnSync(process.execPath, [cliPath, "validate", casePath, "--json"], {
    encoding: "utf8",
  });
  const payload = parseJsonOutput(result.stdout, testCase.id);
  const passed = result.status === 0 && payload.ok === true;

  if (testCase.valid) {
    if (!passed) {
      fail(
        `Conformance case ${testCase.id} should pass validation. Output: ${compactOutput(result)}`,
      );
    }
    if (testCase.profile && payload.manifest?.profile !== testCase.profile) {
      fail(
        `Conformance case ${testCase.id} expected profile ${testCase.profile}, got ${payload.manifest?.profile}.`,
      );
    }
    continue;
  }

  if (passed) {
    fail(`Conformance case ${testCase.id} should fail validation.`);
  }

  const issueCodes = collectIssueCodes(payload);
  for (const expectedIssueCode of testCase.expectedIssueCodes ?? []) {
    if (!issueCodes.has(expectedIssueCode)) {
      fail(
        `Conformance case ${testCase.id} expected issue ${expectedIssueCode}, got ${
          [...issueCodes].join(", ") || "none"
        }.`,
      );
    }
  }
}

console.log(`HTMLX conformance check passed: ${cases.length} cases.`);

function validateCaseShape(testCase) {
  if (typeof testCase.id !== "string" || !testCase.id) {
    fail("Each conformance case must declare an id.");
  }
  if (typeof testCase.path !== "string" || !testCase.path) {
    fail(`Conformance case ${testCase.id} must declare a path.`);
  }
  if (typeof testCase.valid !== "boolean") {
    fail(`Conformance case ${testCase.id} must declare valid.`);
  }
  if (!testCase.valid && !Array.isArray(testCase.expectedIssueCodes)) {
    fail(`Invalid conformance case ${testCase.id} must declare expectedIssueCodes.`);
  }
}

function parseJsonOutput(stdout, caseId) {
  try {
    return JSON.parse(stdout);
  } catch {
    fail(`Conformance case ${caseId} did not return JSON output: ${stdout}`);
  }
}

function collectIssueCodes(payload) {
  const issues = payload.details?.issues;
  if (!Array.isArray(issues)) return new Set();
  return new Set(issues.map((issue) => issue.code).filter(Boolean));
}

function compactOutput(result) {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join(" ");
}

function fail(message) {
  console.error(`Conformance check failed: ${message}`);
  process.exit(1);
}
