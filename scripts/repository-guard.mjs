import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const absolutePathPatterns = [
  { label: "macOS user path", pattern: /\/Users\// },
  { label: "private temp path", pattern: /\/private\// },
  { label: "macOS volume path", pattern: /\/Volumes\// },
  { label: "application path", pattern: /\/Applications\// },
  { label: "Linux home path", pattern: /\/home\// },
  { label: "temporary path", pattern: /\/tmp\// },
  { label: "Homebrew path", pattern: /\/opt\/homebrew/ },
  { label: "absolute file URI", pattern: /file:\/\// },
  { label: "Windows drive path", pattern: /(?<![A-Za-z])[A-Za-z]:[\\/]/ },
];

const ignoredBinaryFiles = new Set([
  "examples/basic.htmlx",
  "examples/rich-self-editable.htmlx",
  "examples/security-invalid.htmlx",
]);

const failures = [];

checkAbsolutePaths();
checkMainScope();

if (failures.length > 0) {
  console.error("Repository guard failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Repository guard passed.");

function checkAbsolutePaths() {
  for (const file of trackedFiles) {
    if (ignoredBinaryFiles.has(file)) {
      continue;
    }
    const bytes = readFileSync(file);
    if (bytes.includes(0)) {
      continue;
    }
    const text = bytes.toString("utf8");
    for (const { label, pattern } of absolutePathPatterns) {
      if (pattern.test(text)) {
        failures.push(`${file} contains ${label}.`);
      }
    }
  }
}

function checkMainScope() {
  if (currentBranchName() !== "main") {
    return;
  }

  const forbiddenFiles = trackedFiles.filter(
    (file) => file.startsWith("benchmarks/") || file.startsWith("docs/paper/"),
  );
  for (const file of forbiddenFiles) {
    failures.push(`main must not track research artifact: ${file}`);
  }

  if (existsSync("package.json")) {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    for (const scriptName of Object.keys(packageJson.scripts ?? {})) {
      if (scriptName.startsWith("bench:")) {
        failures.push(`main must not expose benchmark script: ${scriptName}`);
      }
    }
  }

  if (
    existsSync("pnpm-workspace.yaml") &&
    /benchmarks\/\*/.test(readFileSync("pnpm-workspace.yaml", "utf8"))
  ) {
    failures.push("main must not include benchmarks/* in pnpm-workspace.yaml.");
  }
}

function currentBranchName() {
  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }
  return execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
}
