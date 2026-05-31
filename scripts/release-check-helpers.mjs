import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const absolutePathPatterns = [
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

export function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function isTextBytes(bytes) {
  return !bytes.includes(0);
}

export function scanTextForAbsolutePaths(text) {
  return absolutePathPatterns.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

export function scanFileMapForAbsolutePaths(files, ignoredPaths = new Set()) {
  const failures = [];
  for (const [path, bytes] of files) {
    if (ignoredPaths.has(path) || !isTextBytes(bytes)) continue;
    const labels = scanTextForAbsolutePaths(Buffer.from(bytes).toString("utf8"));
    for (const label of labels) {
      failures.push(`${path} contains ${label}.`);
    }
  }
  return failures;
}

export function compareFileMaps(sourceFiles, packageFiles, ignoredPackagePaths = new Set()) {
  const source = normalizeComparableMap(sourceFiles);
  const packed = normalizeComparableMap(
    new Map([...packageFiles].filter(([path]) => !ignoredPackagePaths.has(path))),
  );
  const paths = new Set([...source.keys(), ...packed.keys()]);
  const missing = [];
  const extra = [];
  const different = [];

  for (const path of [...paths].sort()) {
    const sourceBytes = source.get(path);
    const packedBytes = packed.get(path);
    if (!sourceBytes) {
      extra.push(path);
    } else if (!packedBytes) {
      missing.push(path);
    } else if (!bytesEqual(sourceBytes, packedBytes)) {
      different.push(path);
    }
  }

  return {
    ok: missing.length === 0 && extra.length === 0 && different.length === 0,
    missing,
    extra,
    different,
  };
}

export function readDirectoryFileMap(directory) {
  const files = new Map();
  walkDirectory(directory, (path) => {
    const packagePath = relative(directory, path).split("\\").join("/");
    files.set(packagePath, readFileSync(path));
  });
  return files;
}

export function listHtmlxPackageIds(directory) {
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".htmlx"))
    .map((entry) => entry.slice(0, -".htmlx".length))
    .sort();
}

export function listPublicExampleIds(publicExamplesDirectory) {
  if (!existsSync(publicExamplesDirectory)) return [];
  return listHtmlxPackageIds(publicExamplesDirectory);
}

function normalizeComparableMap(files) {
  return new Map([...files].map(([path, bytes]) => [path, Buffer.from(bytes)]));
}

function walkDirectory(directory, onFile) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const entryStat = statSync(path);
    if (entryStat.isDirectory()) {
      walkDirectory(path, onFile);
    } else if (entryStat.isFile()) {
      onFile(path);
    }
  }
}
