#!/usr/bin/env node
import { createHtmlx, openHtmlx, unpackHtmlx, validateHtmlx } from "@openwebdoc/core";
import { HTMLX_MIME_TYPE, HTMLX_MIMETYPE_PATH, createDefaultManifest } from "@openwebdoc/spec";
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

type CreateProfile = "document" | "slide-deck";

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
    .option("--profile <profile>", "Document profile: document or slide-deck", "document")
    .option("--slides <count>", "Number of slides for slide-deck profile", "6")
    .option("--json", "Print JSON output")
    .action(
      async (
        output: string,
        options: {
          title: string;
          language: string;
          profile: string;
          slides: string;
        } & JsonOption,
      ) => {
        await runAction(io, options, async () => {
          const profile = parseCreateProfile(options.profile);
          const archive =
            profile === "slide-deck"
              ? await createSlideDeckPackage(options.title, options.language, options.slides)
              : await createHtmlx({
                  title: options.title,
                  language: options.language,
                  html: createDefaultHtml(options.title),
                });
          await writeFileEnsured(resolveCliPath(output), archive);
          return {
            message: `Created ${output}`,
            output,
            title: options.title,
            profile,
          };
        });
      },
    );

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

async function createSlideDeckPackage(
  title: string,
  language: string,
  slideCountInput: string,
): Promise<Uint8Array> {
  const slideCount = parseSlideCount(slideCountInput);
  const now = new Date().toISOString();
  const manifest = createDefaultManifest({
    packageId: `urn:uuid:${crypto.randomUUID()}`,
    title,
    language,
    now,
  });
  manifest.metadata.presentation = "metadata/presentation.json";
  manifest.metadata.editing = "metadata/editing.json";

  const html = createSlideDeckHtml(title, slideCount);
  const css = createSlideDeckCss();
  const presentation = {
    schemaVersion: "0.1.0",
    profile: "slide-deck",
    runtime: "@openwebdoc/runtime",
    slideSelector: "[data-htmlx-kind='slide']",
    stage: { width: 1600, height: 900, unit: "px", scaleMode: "uniform-fit" },
    navigation: { loop: false, advanceOnClick: false },
  };
  const editing = {
    schemaVersion: "0.1.0",
    mode: "self-editable-document",
    runtime: "@openwebdoc/runtime",
    stage: { width: 1600, height: 900, unit: "px", scaleMode: "uniform-fit" },
    blocks: Array.from({ length: slideCount }, (_, index) => ({
      id: `slide-${index + 1}-title`,
      type: "heading",
      selector: `[data-htmlx-block-id="slide-${index + 1}-title"]`,
      editable: true,
      frame: { x: 96, y: 90, width: 1040 },
      textRole: "title",
      fontSize: 64,
      lineHeight: 1.05,
      color: "#f8fbff",
      inlineFormatting: [],
    })),
    constraints: {
      scripts: false,
      remoteResources: false,
      coordinates: "stage-relative",
      textScaling: "stage-uniform",
      textFormatting: ["bold", "italic", "underline"],
      typography: {
        fontSize: "block-stage-relative",
        textColor: "safe-css-color",
        fontFamily: "package-css-or-system",
        remoteFonts: false,
      },
    },
  };
  const llm = {
    schemaVersion: "0.1.0",
    summary: `${title} is a browser-native HTMLX slide deck.`,
    readingOrder: Array.from({ length: slideCount }, (_, index) => `slide-${index + 1}-title`),
    chunks: Array.from({ length: slideCount }, (_, index) => ({
      id: `slide-${index + 1}`,
      blockIds: [`slide-${index + 1}-title`],
      selector: `[data-htmlx-slide-id="slide-${index + 1}"]`,
      summary: `Slide ${index + 1} of ${title}.`,
      keywords: ["OpenWebDoc", "HTMLX", "slide deck"],
      tokenEstimate: 120,
      sensitivity: "public",
    })),
    entities: [{ name: "OpenWebDoc", type: "project" }],
    citations: [],
    assistantHints: {
      visibility: "user-visible",
      intendedUse: ["summarization", "retrieval", "editing"],
      doNotTreatAsSystemInstruction: true,
    },
  };
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "OpenWebDoc htmlx CLI",
    createdAt: now,
    profile: "slide-deck",
  };

  const files = {
    [manifest.entry]: html,
    "styles/document.css": css,
    "metadata/llm.json": JSON.stringify(llm, null, 2),
    "metadata/provenance.json": JSON.stringify(provenance, null, 2),
    "metadata/editing.json": JSON.stringify(editing, null, 2),
    "metadata/presentation.json": JSON.stringify(presentation, null, 2),
  };
  manifest.resources = [
    { path: "styles/document.css", mediaType: "text/css", role: "stylesheet" },
    { path: "metadata/llm.json", mediaType: "application/json", role: "metadata" },
    { path: "metadata/provenance.json", mediaType: "application/json", role: "metadata" },
    { path: "metadata/editing.json", mediaType: "application/json", role: "metadata" },
    { path: "metadata/presentation.json", mediaType: "application/json", role: "metadata" },
  ];
  return createHtmlx({ manifest, files });
}

function createSlideDeckHtml(title: string, slideCount: number): string {
  const slideTitles = [
    title,
    "Documents that open as documents",
    "One package boundary",
    "Small corrections on the page",
    "Structural edits in package files",
    "Semantic tables and figures",
    "Validate before sharing",
  ];
  const slideBodies = [
    "A browser-native HTMLX slide deck for OpenWebDoc.",
    "Each slide is HTML and CSS, so the readable surface is also the source.",
    "HTML, CSS, assets, manifest, and metadata travel together as a single .htmlx package.",
    "The OpenWebDoc runtime handles light text, typography, image, and object corrections.",
    "External agents revise unpacked package files, then validate, pack, and validate again.",
    "Tables stay as tables, figures stay as figures, and metadata remains reference data.",
    "Scripts and remote resources stay out. Package-local structure is checked before distribution.",
  ];
  const slides = Array.from({ length: slideCount }, (_, index) => {
    const slideNumber = index + 1;
    const slideTitle = slideTitles[index] ?? `Slide ${slideNumber}`;
    const slideBody = slideBodies[index] ?? "Add slide content in the unpacked HTMLX package.";
    return `      <section class="htmlx-slide" data-htmlx-kind="slide" data-htmlx-slide-id="slide-${slideNumber}" data-htmlx-slide-index="${slideNumber}">
        <p class="slide-kicker">HTMLX DOCUMENT PACKAGE</p>
        <h1 data-htmlx-block-id="slide-${slideNumber}-title" data-htmlx-kind="heading" data-htmlx-editable="text" data-htmlx-x="96" data-htmlx-y="90" data-htmlx-width="1040" data-htmlx-font-size="64" data-htmlx-line-height="1.05" data-htmlx-color="#f8fbff">${escapeHtml(slideTitle)}</h1>
        <p data-htmlx-block-id="slide-${slideNumber}-body" data-htmlx-kind="paragraph" data-htmlx-editable="text" data-htmlx-x="96" data-htmlx-y="270" data-htmlx-width="900" data-htmlx-font-size="31" data-htmlx-line-height="1.35" data-htmlx-color="#d9e6f2">${escapeHtml(slideBody)}</p>
        <div class="slide-number">${slideNumber.toString().padStart(2, "0")}</div>
      </section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="styles/document.css">
  </head>
  <body>
    <main class="htmlx-slide-deck" data-htmlx-profile="slide-deck" data-htmlx-editable="document" data-htmlx-stage-width="1600" data-htmlx-stage-height="900">
${slides}
    </main>
  </body>
</html>
`;
}

function createSlideDeckCss(): string {
  return `:root,
.htmlx-slide-deck {
  --ink: #f8fbff;
  --muted: #d9e6f2;
  --panel: #ffffff;
  --line: rgba(255, 255, 255, 0.2);
  --blue: #2d7ff9;
  --teal: #26d0ce;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
}

body {
  background: #08111f;
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.htmlx-slide-deck {
  width: 100%;
  container-type: inline-size;
  padding: 3cqw;
  background: #0a1221;
}

.htmlx-slide {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 0 0 3cqw;
  padding: 6cqw;
  border: 0.1cqw solid rgba(255, 255, 255, 0.16);
  border-radius: 1.2cqw;
  background:
    radial-gradient(circle at 78% 16%, rgba(38, 208, 206, 0.42), transparent 26%),
    linear-gradient(135deg, #0f2e55, #0b1930 62%, #061020);
  box-shadow: 0 1.4cqw 3.8cqw rgba(0, 0, 0, 0.28);
}

.slide-kicker {
  margin: 0 0 2cqw;
  color: var(--teal);
  font-size: 1.2cqw;
  font-weight: 900;
  letter-spacing: 0.08em;
}

h1,
p {
  margin: 0;
}

h1 {
  width: 68%;
  color: var(--ink);
  font-size: 4cqw;
  line-height: 1.05;
  font-weight: 940;
}

.htmlx-slide > p[data-htmlx-kind="paragraph"] {
  width: 58%;
  margin-top: 2.2cqw;
  color: var(--muted);
  font-size: 1.95cqw;
  line-height: 1.35;
  font-weight: 680;
}

.slide-number {
  position: absolute;
  right: 5.3cqw;
  bottom: 4.8cqw;
  color: rgba(255, 255, 255, 0.34);
  font-size: 5.2cqw;
  line-height: 1;
  font-weight: 940;
}
`;
}

function parseCreateProfile(value: string): CreateProfile {
  if (value === "document" || value === "slide-deck") return value;
  throw new Error(`Unsupported profile: ${value}. Use "document" or "slide-deck".`);
}

function parseSlideCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("--slides must be a positive integer.");
  }
  return count;
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
