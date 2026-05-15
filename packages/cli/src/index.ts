#!/usr/bin/env node
import { createHtmlx, openHtmlx, unpackHtmlx, validateHtmlx } from "@openwebdoc/core";
import { HTMLX_MIME_TYPE, HTMLX_MIMETYPE_PATH } from "@openwebdoc/spec";
import { Command } from "commander";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface CliIo {
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
}

interface JsonOption {
  json?: boolean;
}

export function buildProgram(io: CliIo = process): Command {
  const program = new Command();
  program
    .name("htmlx")
    .description("Create, validate, inspect, pack, and unpack HTMLX Document Package files.")
    .version("0.1.0-alpha.0");

  program
    .command("create")
    .description("Create a basic .htmlx document.")
    .argument("<output>", "Output .htmlx path")
    .option("--title <title>", "Document title", "Untitled HTMLX Document")
    .option("--language <language>", "Document language", "en")
    .option("--json", "Print JSON output")
    .action(async (output: string, options: { title: string; language: string } & JsonOption) => {
      await runAction(io, options, async () => {
        const archive = await createHtmlx({
          title: options.title,
          language: options.language,
          html: createDefaultHtml(options.title),
        });
        await writeFileEnsured(resolveCliPath(output), archive);
        return {
          message: `Created ${output}`,
          output,
          title: options.title,
        };
      });
    });

  program
    .command("validate")
    .description("Validate a .htmlx package or an unpacked HTMLX package directory.")
    .argument("<input>", "Input .htmlx path or unpacked package directory")
    .option("--json", "Print JSON output")
    .action(async (input: string, options: JsonOption) => {
      await runAction(io, options, async () => {
        const inputPath = resolveCliPath(input);
        const inputStat = await stat(inputPath);
        const result = inputStat.isDirectory()
          ? await validateHtmlx(await readDirectoryAsPackage(inputPath))
          : await validateHtmlx(await readFile(inputPath));
        if (!result.valid) {
          const error = new CliValidationError("HTMLX validation failed.");
          error.payload = result;
          throw error;
        }
        return {
          message: `Valid HTMLX ${inputStat.isDirectory() ? "directory" : "package"}: ${input}`,
          input,
          issues: result.issues,
          manifest: summarizeManifest(result.manifest),
        };
      });
    });

  program
    .command("inspect")
    .description("Inspect a .htmlx package manifest and entries.")
    .argument("<input>", "Input .htmlx path")
    .option("--json", "Print JSON output")
    .action(async (input: string, options: JsonOption) => {
      await runAction(io, options, async () => {
        const archive = await openHtmlx(await readFile(resolveCliPath(input)));
        const payload = {
          input,
          manifest: summarizeManifest(archive.manifest),
          entries: [...archive.files.keys()].sort(),
          issues: archive.validation.issues,
        };
        return {
          ...payload,
          message: `${archive.manifest.title}\n${payload.entries.length} entries`,
        };
      });
    });

  program
    .command("pack")
    .description("Pack a directory containing manifest.json into a .htmlx file.")
    .argument("<directory>", "Directory to pack")
    .argument("<output>", "Output .htmlx path")
    .option("--json", "Print JSON output")
    .action(async (directory: string, output: string, options: JsonOption) => {
      await runAction(io, options, async () => {
        const files = await readDirectoryAsPackage(resolveCliPath(directory));
        if (!files.has(HTMLX_MIMETYPE_PATH)) {
          files.set(HTMLX_MIMETYPE_PATH, new TextEncoder().encode(HTMLX_MIME_TYPE));
        }
        const result = await validateHtmlx(files);
        if (!result.valid) {
          const error = new CliValidationError("Directory is not a valid HTMLX package.");
          error.payload = result;
          throw error;
        }
        const archive = await createHtmlx({ manifest: result.manifest!, files });
        await writeFileEnsured(resolveCliPath(output), archive);
        return {
          message: `Packed ${directory} -> ${output}`,
          directory,
          output,
          manifest: summarizeManifest(result.manifest),
        };
      });
    });

  program
    .command("unpack")
    .description("Unpack a .htmlx package into a directory.")
    .argument("<input>", "Input .htmlx path")
    .argument("<directory>", "Output directory")
    .option("--json", "Print JSON output")
    .action(async (input: string, directory: string, options: JsonOption) => {
      await runAction(io, options, async () => {
        const archive = await readFile(resolveCliPath(input));
        const validation = await validateHtmlx(archive);
        if (!validation.valid) {
          const error = new CliValidationError("Refusing to unpack an invalid HTMLX package.");
          error.payload = validation;
          throw error;
        }
        const files = unpackHtmlx(archive);
        for (const [path, bytes] of files) {
          await writeFileEnsured(join(resolveCliPath(directory), path), bytes, {
            overwrite: false,
          });
        }
        return {
          message: `Unpacked ${input} -> ${directory}`,
          input,
          directory,
          entries: [...files.keys()].sort(),
        };
      });
    });

  return program;
}

export async function runCli(argv = process.argv, io: CliIo = process): Promise<void> {
  await buildProgram(io).parseAsync(argv);
}

class CliValidationError extends Error {
  payload?: unknown;
}

async function runAction<T extends { message?: string }>(
  io: CliIo,
  options: JsonOption,
  action: () => Promise<T>,
): Promise<void> {
  try {
    const payload = await action();
    if (options.json) {
      io.stdout.write(`${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`);
      return;
    }
    io.stdout.write(`${payload.message ?? "OK"}\n`);
  } catch (error) {
    const payload = error instanceof CliValidationError ? error.payload : undefined;
    if (options.json) {
      io.stdout.write(
        `${JSON.stringify(
          {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
            details: payload,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      io.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
      if (payload && typeof payload === "object" && "issues" in payload) {
        for (const issue of payload.issues as Array<{
          code: string;
          message: string;
          path?: string;
        }>) {
          io.stderr.write(
            `- ${issue.code}${issue.path ? ` (${issue.path})` : ""}: ${issue.message}\n`,
          );
        }
      }
    }
    process.exitCode = 1;
  }
}

function createDefaultHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <section data-htmlx-block-id="block-1">
        <h1>${escapeHtml(title)}</h1>
        <p>This document was created with the OpenWebDoc htmlx CLI.</p>
      </section>
    </main>
  </body>
</html>
`;
}

function resolveCliPath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

async function readDirectoryAsPackage(directory: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  await walk(directory, async (path) => {
    const packagePath = relative(directory, path).split("\\").join("/");
    files.set(packagePath, await readFile(path));
  });
  if (!files.has(HTMLX_MIMETYPE_PATH)) {
    files.set(HTMLX_MIMETYPE_PATH, new TextEncoder().encode(HTMLX_MIME_TYPE));
  }
  return files;
}

async function walk(directory: string, onFile: (path: string) => Promise<void>): Promise<void> {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const entryStat = await stat(path);
    if (entryStat.isDirectory()) {
      await walk(path, onFile);
    } else if (entryStat.isFile()) {
      await onFile(path);
    }
  }
}

async function writeFileEnsured(
  path: string,
  bytes: Uint8Array,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  if (options.overwrite === false) {
    try {
      await stat(path);
      throw new Error(`Refusing to overwrite existing file: ${path}`);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        // Continue.
      } else if (error instanceof Error && !("code" in error)) {
        throw error;
      }
    }
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

function summarizeManifest(manifest: unknown): unknown {
  if (!manifest || typeof manifest !== "object") {
    return undefined;
  }
  const typed = manifest as {
    title?: string;
    htmlxVersion?: string;
    entry?: string;
    language?: string;
  };
  return {
    title: typed.title,
    htmlxVersion: typed.htmlxVersion,
    language: typed.language,
    entry: typed.entry,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const entryPoint = isEntrypoint();
if (entryPoint) {
  await runCli();
}

function isEntrypoint(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}
