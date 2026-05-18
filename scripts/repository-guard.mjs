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
  "examples/openwebdoc-introduction.htmlx",
  "examples/openwebdoc-slide-deck.htmlx",
  "examples/security-invalid.htmlx",
]);

const failures = [];

checkAbsolutePaths();

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
    if (!existsSync(file)) {
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
