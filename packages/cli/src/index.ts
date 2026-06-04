#!/usr/bin/env node
import {
  createHtmlx,
  createHtmlxLlmMetadata,
  decodeText,
  openHtmlx,
  resolveHtmlxProfile,
  sha256Integrity,
  unpackHtmlx,
  validateHtmlx,
} from "@openwebdoc/core";
import {
  HTMLX_MIME_TYPE,
  HTMLX_MIMETYPE_PATH,
  createDefaultManifest,
  type HtmlxDocumentProfile,
  type HtmlxEditingMetadata,
  type HtmlxLlmMetadata,
  type HtmlxManifest,
  type HtmlxResource,
} from "@openwebdoc/spec";
import { Command } from "commander";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface CliIo {
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
}

interface JsonOption {
  json?: boolean;
}

type CreateProfile = HtmlxDocumentProfile;

export function buildProgram(io: CliIo = process): Command {
  const program = new Command();
  program
    .name("htmlx")
    .description(
      "Create, convert, validate, inspect, pack, unpack, export, and refresh HTMLX Document Package files.",
    )
    .version("0.1.0-alpha.4");

  program
    .command("create")
    .description("Create a basic .htmlx document.")
    .argument("<output>", "Output .htmlx path")
    .option("--title <title>", "Document title", "Untitled HTMLX Document")
    .option("--language <language>", "Document language", "en")
    .option(
      "--profile <profile>",
      "Document profile: flow-document, fixed-stage-document, or slide-deck",
      "flow-document",
    )
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
              : profile === "fixed-stage-document"
                ? await createFixedStagePackage(options.title, options.language)
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
    .command("from-markdown")
    .description("Convert a Markdown file into a flow-document .htmlx package.")
    .argument("<input>", "Input Markdown file")
    .argument("<output>", "Output .htmlx path")
    .option("--title <title>", "Document title")
    .option("--language <language>", "Document language", "en")
    .option("--json", "Print JSON output")
    .action(
      async (
        input: string,
        output: string,
        options: {
          title?: string;
          language: string;
        } & JsonOption,
      ) => {
        await runAction(io, options, async () => {
          const inputPath = resolveCliPath(input);
          const markdown = await readFile(inputPath, "utf8");
          const title = options.title?.trim() || deriveMarkdownTitle(markdown, inputPath);
          const html = createHtmlFromMarkdown(markdown, title, options.language);
          const archive = await createHtmlx({
            title,
            language: options.language,
            html,
            css: flowDocumentCss,
          });
          await writeFileEnsured(resolveCliPath(output), archive);
          return {
            message: `Converted ${input} -> ${output}`,
            input,
            output,
            title,
            profile: "flow-document",
          };
        });
      },
    );

  program
    .command("from-html")
    .description("Convert a safe standalone HTML file into a flow-document .htmlx package.")
    .argument("<input>", "Input HTML file")
    .argument("<output>", "Output .htmlx path")
    .option("--title <title>", "Document title")
    .option("--language <language>", "Document language", "en")
    .option("--json", "Print JSON output")
    .action(
      async (
        input: string,
        output: string,
        options: {
          title?: string;
          language: string;
        } & JsonOption,
      ) => {
        await runAction(io, options, async () => {
          const inputPath = resolveCliPath(input);
          const sourceHtml = await readFile(inputPath, "utf8");
          assertConvertibleHtmlSource(sourceHtml);
          const title = options.title?.trim() || deriveHtmlTitle(sourceHtml, inputPath);
          const html = createHtmlFromHtmlSource(sourceHtml, title, options.language);
          const archive = await createHtmlx({
            title,
            language: options.language,
            html,
            css: flowDocumentCss,
          });
          await writeFileEnsured(resolveCliPath(output), archive);
          return {
            message: `Converted ${input} -> ${output}`,
            input,
            output,
            title,
            profile: "flow-document",
          };
        });
      },
    );

  program
    .command("to-static-html")
    .description("Export a validated .htmlx package as a static HTML directory.")
    .argument("<input>", "Input .htmlx path")
    .argument("<directory>", "Output static directory")
    .option("--include-metadata", "Copy manifest and metadata files into the static directory")
    .option("--overwrite", "Overwrite existing output files")
    .option("--json", "Print JSON output")
    .action(
      async (
        input: string,
        directory: string,
        options: JsonOption & { includeMetadata?: boolean; overwrite?: boolean },
      ) => {
        await runAction(io, options, async () => {
          const htmlx = await openHtmlx(await readFile(resolveCliPath(input)));
          const outputDirectory = resolveCliPath(directory);
          const exported = await writeStaticHtmlExport({
            htmlx,
            outputDirectory,
            includeMetadata: Boolean(options.includeMetadata),
            overwrite: Boolean(options.overwrite),
          });
          return {
            message: `Exported ${input} -> ${directory}`,
            input,
            directory,
            profile: resolveHtmlxProfile(htmlx.manifest, htmlx.files),
            entry: "index.html",
            files: exported,
            includeMetadata: Boolean(options.includeMetadata),
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
    .command("refresh-metadata")
    .description("Refresh metadata/llm.json for an unpacked HTMLX package directory.")
    .argument("<directory>", "Unpacked HTMLX package directory")
    .option("--dry-run", "Print refreshed metadata without writing files")
    .option("--check", "Fail if metadata/llm.json is stale without writing files")
    .option("--json", "Print JSON output")
    .action(
      async (directory: string, options: JsonOption & { dryRun?: boolean; check?: boolean }) => {
        await runAction(io, options, async () => {
          if (options.dryRun && options.check) {
            throw new Error("--check cannot be combined with --dry-run.");
          }
          const directoryPath = resolveCliPath(directory);
          const files = await readDirectoryAsPackage(directoryPath);
          const manifest = readJsonFromPackage<HtmlxManifest>(files, "manifest.json");
          const profile = resolveHtmlxProfile(manifest, files);
          const entryHtml = decodeText(readRequiredPackageFile(files, manifest.entry));
          const llmPath = manifest.metadata.llm ?? "metadata/llm.json";
          const existingLlm = files.has(llmPath)
            ? readJsonFromPackage<Partial<HtmlxLlmMetadata>>(files, llmPath)
            : undefined;
          const htmlBlockIds = extractHtmlxBlockIds(entryHtml);
          const editableBlockIds = readEditableBlockIds(files, manifest).filter((blockId) =>
            htmlBlockIds.has(blockId),
          );
          const refreshedMetadata = await createHtmlxLlmMetadata({
            title: manifest.title,
            html: entryHtml,
            profile,
            summary: existingLlm?.summary ?? `${manifest.title} package metadata.`,
            entities: existingLlm?.entities ?? [],
            citations: existingLlm?.citations ?? [],
            editableBlockIds,
            appEditableBlockIds: editableBlockIds,
            externalAgentEditableFiles: collectExternalAgentEditableFiles(manifest, llmPath),
          });
          const manifestResourceAdded = !manifest.metadata.llm || !hasResource(manifest, llmPath);
          const metadataBytes = new TextEncoder().encode(
            `${JSON.stringify(refreshedMetadata, null, 2)}\n`,
          );
          const expectedIntegrity = await sha256Integrity(metadataBytes);

          if (options.check) {
            const stalePaths = collectStaleMetadataPaths(
              manifest,
              files,
              llmPath,
              metadataBytes,
              expectedIntegrity,
            );
            if (stalePaths.length > 0) {
              const error = new CliValidationError("HTMLX metadata is stale.");
              error.payload = {
                stale: true,
                paths: stalePaths,
                profile,
                metadata: llmPath,
              };
              throw error;
            }
            return {
              message: `Metadata is fresh: ${llmPath}`,
              directory,
              metadata: llmPath,
              profile,
              blockCount: refreshedMetadata.readingOrder.length,
              stale: false,
            };
          }

          if (!options.dryRun) {
            if (!manifest.metadata.llm) manifest.metadata.llm = llmPath;
            const metadataResource = ensureMetadataResource(manifest, llmPath);
            metadataResource.integrity = expectedIntegrity;
            manifest.modifiedAt = new Date().toISOString();
            const manifestBytes = new TextEncoder().encode(
              `${JSON.stringify(manifest, null, 2)}\n`,
            );
            files.set(llmPath, metadataBytes);
            files.set("manifest.json", manifestBytes);
            await writeFileEnsured(join(directoryPath, llmPath), metadataBytes);
            await writeFileEnsured(join(directoryPath, "manifest.json"), manifestBytes);

            const validation = await validateHtmlx(await readDirectoryAsPackage(directoryPath));
            if (!validation.valid) {
              const error = new CliValidationError(
                "Metadata refreshed, but the package is not valid.",
              );
              error.payload = validation;
              throw error;
            }
          }

          return {
            message: options.dryRun
              ? `Prepared refreshed metadata for ${directory}`
              : `Refreshed ${llmPath}`,
            directory,
            metadata: llmPath,
            profile,
            blockCount: refreshedMetadata.readingOrder.length,
            manifestUpdated: !options.dryRun,
            manifestResourceAdded,
            dryRun: Boolean(options.dryRun),
            ...(options.dryRun ? { llm: refreshedMetadata } : {}),
          };
        });
      },
    );

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

function createHtmlFromMarkdown(markdown: string, title: string, language: string): string {
  const body = renderMarkdownBlocks(markdown);
  return `<!doctype html>
<html lang="${escapeHtmlAttribute(language)}">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="styles/document.css">
  </head>
  <body>
    <main class="htmlx-flow-document" data-htmlx-profile="flow-document">
      <article>
${body}
      </article>
    </main>
  </body>
</html>
`;
}

function createHtmlFromHtmlSource(sourceHtml: string, title: string, language: string): string {
  const body = ensureFlowBlockIds(extractHtmlBodyContent(sourceHtml));
  return `<!doctype html>
<html lang="${escapeHtmlAttribute(language)}">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="styles/document.css">
  </head>
  <body>
    <main class="htmlx-flow-document" data-htmlx-profile="flow-document">
      <article>
${body || '        <p data-htmlx-block-id="html-block-1" data-htmlx-kind="paragraph"></p>'}
      </article>
    </main>
  </body>
</html>
`;
}

function assertConvertibleHtmlSource(sourceHtml: string): void {
  const unsafeChecks: Array<[RegExp, string]> = [
    [/<script[\s>]/i, "Scripts are not allowed in HTMLX packages."],
    [/\son[a-z]+\s*=/i, "Inline event handlers are not allowed in HTMLX packages."],
    [/javascript:/i, "javascript: URLs are not allowed in HTMLX packages."],
    [/<iframe[\s>]/i, "Iframes are not allowed in HTMLX packages."],
    [/<form[\s>]/i, "Forms are not allowed in HTMLX packages."],
    [/\s(?:src|href)\s*=\s*["']https?:\/\//i, "Remote resources are not allowed."],
    [/\s(?:src|href)\s*=\s*["']file:/i, "file: resources are not allowed."],
    [/\s(?:src|href)\s*=\s*["']data:/i, "data: resources are not allowed."],
    [
      /(?:<style\b[\s\S]*?(?:@import|url\s*\(\s*["']?(?:https?:\/\/|file:))|style\s*=\s*["'][^"']*(?:url\s*\(|@import|javascript:|https?:\/\/|file:))/i,
      "CSS must not reference scripts, remote resources, or file resources.",
    ],
  ];
  for (const [pattern, message] of unsafeChecks) {
    if (pattern.test(sourceHtml)) {
      throw new Error(`Cannot convert unsafe HTML source. ${message}`);
    }
  }

  const body = extractHtmlBodyContent(sourceHtml);
  for (const match of body.matchAll(/\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const ref = match[1].trim().toLowerCase();
    if (!ref || ref.startsWith("#") || ref.startsWith("mailto:")) {
      continue;
    }
    throw new Error(
      "Cannot convert HTML source with local resource references yet. Remove the reference or add assets after unpacking the package.",
    );
  }
}

function extractHtmlBodyContent(sourceHtml: string): string {
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(sourceHtml);
  return (bodyMatch?.[1] ?? sourceHtml).trim();
}

function ensureFlowBlockIds(html: string): string {
  let blockNumber = 1;
  return html.replace(
    /<(h[1-6]|p|section|article|blockquote|ul|ol|pre|table|figure)\b([^>]*)>/gi,
    (fullMatch: string, tagName: string, attributes: string) => {
      if (/\bdata-htmlx-block-id\s*=/.test(attributes)) return fullMatch;
      const blockId = `html-block-${blockNumber++}`;
      const kind = inferHtmlSourceKind(tagName.toLowerCase());
      return `<${tagName}${attributes} data-htmlx-block-id="${blockId}" data-htmlx-kind="${kind}">`;
    },
  );
}

function inferHtmlSourceKind(tagName: string): string {
  if (/^h[1-6]$/.test(tagName)) return "heading";
  if (tagName === "ul" || tagName === "ol") return "list";
  if (tagName === "pre") return "code";
  if (tagName === "table") return "table";
  if (tagName === "figure") return "figure";
  if (tagName === "section" || tagName === "article") return "section";
  return "paragraph";
}

function renderMarkdownBlocks(markdown: string): string {
  const lines = stripMarkdownFrontMatter(markdown).replaceAll("\r\n", "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  let blockNumber = 1;

  const nextBlockId = () => `md-block-${blockNumber++}`;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      const languageClass = fenceMatch[1]
        ? ` class="language-${escapeHtmlAttribute(fenceMatch[1])}"`
        : "";
      blocks.push(
        `        <pre data-htmlx-block-id="${nextBlockId()}" data-htmlx-kind="code"><code${languageClass}>${escapeHtml(
          codeLines.join("\n"),
        )}</code></pre>`,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = `h${level}`;
      blocks.push(
        `        <${tag} data-htmlx-block-id="${nextBlockId()}" data-htmlx-kind="heading">${renderMarkdownInline(
          headingMatch[2],
        )}</${tag}>`,
      );
      index += 1;
      continue;
    }

    const blockquoteLines: string[] = [];
    while (index < lines.length) {
      const quoteMatch = (lines[index] ?? "").match(/^>\s?(.*)$/);
      if (!quoteMatch) break;
      blockquoteLines.push(quoteMatch[1]);
      index += 1;
    }
    if (blockquoteLines.length > 0) {
      blocks.push(
        `        <blockquote data-htmlx-block-id="${nextBlockId()}" data-htmlx-kind="paragraph"><p>${renderMarkdownInline(
          blockquoteLines.join(" "),
        )}</p></blockquote>`,
      );
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+[.)]/.test(listMatch[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = (lines[index] ?? "").match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
        if (!itemMatch || /\d+[.)]/.test(itemMatch[2]) !== ordered) break;
        items.push(`          <li>${renderMarkdownInline(itemMatch[3])}</li>`);
        index += 1;
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push(
        `        <${tag} data-htmlx-block-id="${nextBlockId()}" data-htmlx-kind="list">\n${items.join(
          "\n",
        )}\n        </${tag}>`,
      );
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^(#{1,6})\s+/.test(lines[index] ?? "") &&
      !/^```/.test(lines[index] ?? "") &&
      !/^>\s?/.test(lines[index] ?? "") &&
      !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[index] ?? "")
    ) {
      paragraphLines.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push(
      `        <p data-htmlx-block-id="${nextBlockId()}" data-htmlx-kind="paragraph">${renderMarkdownInline(
        paragraphLines.join(" "),
      )}</p>`,
    );
  }

  if (blocks.length > 0) return blocks.join("\n");
  return `        <p data-htmlx-block-id="${nextBlockId()}" data-htmlx-kind="paragraph"></p>`;
}

function stripMarkdownFrontMatter(markdown: string): string {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) return markdown;
  const normalized = markdown.replaceAll("\r\n", "\n");
  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) return markdown;
  return normalized.slice(endIndex + "\n---\n".length);
}

function renderMarkdownInline(value: string): string {
  const linkFlattened = value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, "$1 ($2)");
  return escapeHtml(linkFlattened)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function deriveMarkdownTitle(markdown: string, inputPath: string): string {
  const heading = stripMarkdownFrontMatter(markdown).match(/^#\s+(.+?)\s*#*\s*$/m);
  if (heading?.[1]) return heading[1].trim();
  const name = basename(inputPath)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return name ? name.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Untitled HTMLX Document";
}

function deriveHtmlTitle(sourceHtml: string, inputPath: string): string {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(sourceHtml)?.[1];
  if (title?.trim()) return title.replaceAll(/\s+/g, " ").trim();
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(sourceHtml)?.[1];
  const h1Text = h1
    ?.replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (h1Text) return h1Text;
  const name = basename(inputPath)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return name ? name.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Untitled HTMLX Document";
}

async function writeStaticHtmlExport(input: {
  htmlx: Awaited<ReturnType<typeof openHtmlx>>;
  outputDirectory: string;
  includeMetadata: boolean;
  overwrite: boolean;
}): Promise<string[]> {
  const { htmlx, outputDirectory, includeMetadata, overwrite } = input;
  const manifest = htmlx.manifest;
  const outputPaths = new Map<string, Uint8Array>();

  outputPaths.set("index.html", readRequiredPackageFile(htmlx.files, manifest.entry));

  const copyPaths = new Set<string>([
    ...manifest.styles,
    ...manifest.resources
      .filter((resource) => includeMetadata || resource.role !== "metadata")
      .map((resource) => resource.path),
  ]);

  if (includeMetadata) {
    copyPaths.add("manifest.json");
  }

  copyPaths.delete(manifest.entry);
  copyPaths.delete(HTMLX_MIMETYPE_PATH);

  for (const path of [...copyPaths].sort()) {
    const bytes = htmlx.files.get(path);
    if (bytes) {
      outputPaths.set(path, bytes);
    }
  }

  const exported: string[] = [];
  for (const [path, bytes] of outputPaths) {
    const destination = resolveStaticOutputPath(outputDirectory, path);
    await writeFileEnsured(destination, bytes, { overwrite });
    exported.push(path);
  }
  return exported.sort();
}

function resolveStaticOutputPath(outputDirectory: string, packagePath: string): string {
  if (!packagePath || isAbsolute(packagePath) || packagePath.includes("\\")) {
    throw new Error(`Refusing to export invalid package path: ${packagePath}`);
  }
  const destination = resolve(outputDirectory, packagePath);
  const relativePath = relative(outputDirectory, destination);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Refusing to export outside output directory: ${packagePath}`);
  }
  return destination;
}

async function createFixedStagePackage(title: string, language: string): Promise<Uint8Array> {
  const now = new Date().toISOString();
  const manifest = createDefaultManifest({
    packageId: `urn:uuid:${crypto.randomUUID()}`,
    title,
    language,
    profile: "fixed-stage-document",
    now,
  });
  manifest.metadata.editing = "metadata/editing.json";

  const html = `<!doctype html>
<html lang="${escapeHtmlAttribute(language)}">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="styles/document.css">
  </head>
  <body>
    <main class="htmlx-document" data-htmlx-profile="fixed-stage-document" data-htmlx-block-id="document-root" data-htmlx-editable="document" data-htmlx-stage-width="980" data-htmlx-stage-height="720">
      <h1 data-htmlx-block-id="title" data-htmlx-kind="heading" data-htmlx-editable="text" data-htmlx-x="56" data-htmlx-y="64" data-htmlx-width="760" data-htmlx-font-size="44" data-htmlx-line-height="1.1" data-htmlx-color="#10233f">${escapeHtml(title)}</h1>
      <p data-htmlx-block-id="body" data-htmlx-kind="paragraph" data-htmlx-editable="text" data-htmlx-x="56" data-htmlx-y="142" data-htmlx-width="760" data-htmlx-font-size="22" data-htmlx-line-height="1.45" data-htmlx-color="#334155">This fixed-stage HTMLX document keeps proportional text and object geometry for visual documents while remaining script-free and package-local.</p>
    </main>
  </body>
</html>
`;
  const css = `.htmlx-document, .htmlx-document * {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #eef4fb;
  color: #10233f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.htmlx-document {
  position: relative;
  width: 100%;
  container-type: inline-size;
  aspect-ratio: 980 / 720;
  overflow: hidden;
  background: #ffffff;
}

[data-htmlx-editable="text"] {
  position: absolute;
  margin: 0;
}

[data-htmlx-block-id="title"] {
  left: 5.714%;
  top: 8.889%;
  width: 77.551%;
  color: #10233f;
  font-size: 4.49cqw;
  line-height: 1.1;
}

[data-htmlx-block-id="body"] {
  left: 5.714%;
  top: 19.722%;
  width: 77.551%;
  color: #334155;
  font-size: 2.245cqw;
  line-height: 1.45;
}
`;
  const editing = {
    schemaVersion: "0.1.0",
    mode: "self-editable-document",
    runtime: "@openwebdoc/runtime",
    stage: { width: 980, height: 720, unit: "px", scaleMode: "uniform-fit" },
    blocks: [
      {
        id: "title",
        type: "heading",
        selector: '[data-htmlx-block-id="title"]',
        editable: true,
        frame: { x: 56, y: 64, width: 760 },
        textRole: "title",
        fontSize: 44,
        lineHeight: 1.1,
        color: "#10233f",
        inlineFormatting: [],
      },
      {
        id: "body",
        type: "paragraph",
        selector: '[data-htmlx-block-id="body"]',
        editable: true,
        frame: { x: 56, y: 142, width: 760 },
        textRole: "body",
        fontSize: 22,
        lineHeight: 1.45,
        color: "#334155",
        inlineFormatting: [],
      },
    ],
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
  const llm = await createHtmlxLlmMetadata({
    title,
    html,
    profile: "fixed-stage-document",
    summary: `${title} is a fixed-stage HTMLX document.`,
    keywords: ["OpenWebDoc", "HTMLX", "fixed-stage-document"],
    entities: [{ name: "OpenWebDoc", type: "project" }],
    editableBlockIds: ["title", "body"],
    appEditableBlockIds: ["title", "body"],
    externalAgentEditableFiles: [
      "index.html",
      "styles/document.css",
      "metadata/llm.json",
      "metadata/editing.json",
      "metadata/provenance.json",
    ],
  });
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "OpenWebDoc htmlx CLI",
    createdAt: now,
    profile: "fixed-stage-document",
  };

  const files = {
    [manifest.entry]: html,
    "styles/document.css": css,
    "metadata/llm.json": JSON.stringify(llm, null, 2),
    "metadata/provenance.json": JSON.stringify(provenance, null, 2),
    "metadata/editing.json": JSON.stringify(editing, null, 2),
  };
  manifest.resources = [
    { path: "styles/document.css", mediaType: "text/css", role: "stylesheet" },
    { path: "metadata/llm.json", mediaType: "application/json", role: "metadata" },
    { path: "metadata/provenance.json", mediaType: "application/json", role: "metadata" },
    { path: "metadata/editing.json", mediaType: "application/json", role: "metadata" },
  ];
  return createHtmlx({ manifest, files });
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
    profile: "slide-deck",
    now,
  });
  manifest.metadata.presentation = "metadata/presentation.json";
  manifest.metadata.editing = "metadata/editing.json";

  const html = createSlideDeckHtml(title, slideCount);
  const css = createSlideDeckCss();
  const slideTextModel = createSlideDeckTextModel(title, slideCount);
  const editableSlideBlockIds = slideTextModel.flatMap((slide) => [
    `slide-${slide.index}-title`,
    `slide-${slide.index}-body`,
  ]);
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
    blocks: slideTextModel.flatMap((slide) => [
      {
        id: `slide-${slide.index}-title`,
        type: "heading",
        selector: `[data-htmlx-block-id="slide-${slide.index}-title"]`,
        editable: true,
        frame: { x: 96, y: 90, width: 1040 },
        textRole: "title",
        fontSize: 64,
        lineHeight: 1.05,
        color: "#f8fbff",
        inlineFormatting: [],
      },
      {
        id: `slide-${slide.index}-body`,
        type: "paragraph",
        selector: `[data-htmlx-block-id="slide-${slide.index}-body"]`,
        editable: true,
        frame: { x: 96, y: 270, width: 900 },
        textRole: "body",
        fontSize: 31,
        lineHeight: 1.35,
        color: "#d9e6f2",
        inlineFormatting: [],
      },
    ]),
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
  const llm = await createHtmlxLlmMetadata({
    title,
    html,
    profile: "slide-deck",
    summary: `${title} is a browser-native HTMLX slide deck.`,
    keywords: ["OpenWebDoc", "HTMLX", "slide deck"],
    entities: [{ name: "OpenWebDoc", type: "project" }],
    editableBlockIds: editableSlideBlockIds,
    appEditableBlockIds: editableSlideBlockIds,
    externalAgentEditableFiles: [
      "index.html",
      "styles/document.css",
      "metadata/llm.json",
      "metadata/editing.json",
      "metadata/presentation.json",
      "metadata/provenance.json",
    ],
  });
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
  const slideTextModel = createSlideDeckTextModel(title, slideCount);
  const slides = slideTextModel
    .map((slide) => {
      return `      <section class="htmlx-slide" data-htmlx-kind="slide" data-htmlx-slide-id="slide-${slide.index}" data-htmlx-slide-index="${slide.index}">
        <p class="slide-kicker">HTMLX DOCUMENT PACKAGE</p>
        <h1 data-htmlx-block-id="slide-${slide.index}-title" data-htmlx-kind="heading" data-htmlx-editable="text" data-htmlx-x="96" data-htmlx-y="90" data-htmlx-width="1040" data-htmlx-font-size="64" data-htmlx-line-height="1.05" data-htmlx-color="#f8fbff">${escapeHtml(slide.title)}</h1>
        <p data-htmlx-block-id="slide-${slide.index}-body" data-htmlx-kind="paragraph" data-htmlx-editable="text" data-htmlx-x="96" data-htmlx-y="270" data-htmlx-width="900" data-htmlx-font-size="31" data-htmlx-line-height="1.35" data-htmlx-color="#d9e6f2">${escapeHtml(slide.body)}</p>
        <div class="slide-number">${slide.index.toString().padStart(2, "0")}</div>
      </section>`;
    })
    .join("\n");
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

function createSlideDeckTextModel(title: string, slideCount: number) {
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
  return Array.from({ length: slideCount }, (_, index) => {
    const slideNumber = index + 1;
    return {
      index: slideNumber,
      title: slideTitles[index] ?? `Slide ${slideNumber}`,
      body: slideBodies[index] ?? "Add slide content in the unpacked HTMLX package.",
    };
  });
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
  if (value === "document" || value === "flow-document") return "flow-document";
  if (value === "fixed-stage-document" || value === "slide-deck") return value;
  throw new Error(
    `Unsupported profile: ${value}. Use "flow-document", "fixed-stage-document", or "slide-deck".`,
  );
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

function readRequiredPackageFile(files: Map<string, Uint8Array>, path: string): Uint8Array {
  const bytes = files.get(path);
  if (!bytes) {
    throw new Error(`Missing package file: ${path}`);
  }
  return bytes;
}

function readJsonFromPackage<T>(files: Map<string, Uint8Array>, path: string): T {
  try {
    return JSON.parse(decodeText(readRequiredPackageFile(files, path))) as T;
  } catch (error) {
    throw new Error(
      `Cannot read JSON package file ${path}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

function readEditableBlockIds(files: Map<string, Uint8Array>, manifest: HtmlxManifest): string[] {
  const editingPath = manifest.metadata.editing;
  if (!editingPath || !files.has(editingPath)) return [];
  try {
    const editing = readJsonFromPackage<Partial<HtmlxEditingMetadata>>(files, editingPath);
    return [
      ...new Set(
        (editing.blocks ?? [])
          .map((block) => block.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
  } catch {
    return [];
  }
}

function extractHtmlxBlockIds(html: string): Set<string> {
  const blockIds = new Set<string>();
  const tagPattern = /<[a-z][a-z0-9-]*\b[^>]*\bdata-htmlx-block-id\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    if (match[1]) blockIds.add(match[1]);
  }
  return blockIds;
}

function collectExternalAgentEditableFiles(manifest: HtmlxManifest, llmPath: string): string[] {
  return [
    ...new Set(
      [
        manifest.entry,
        ...manifest.styles,
        llmPath,
        manifest.metadata.editing,
        manifest.metadata.editingGuide,
        manifest.metadata.presentation,
        manifest.metadata.provenance,
      ].filter((path): path is string => typeof path === "string" && path.length > 0),
    ),
  ];
}

function hasResource(manifest: HtmlxManifest, path: string): boolean {
  return manifest.resources.some((resource) => resource.path === path);
}

function collectStaleMetadataPaths(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  llmPath: string,
  expectedMetadataBytes: Uint8Array,
  expectedIntegrity: string,
): string[] {
  const stalePaths = new Set<string>();
  if (manifest.metadata.llm !== llmPath) {
    stalePaths.add("manifest.json#metadata.llm");
  }

  const currentMetadataBytes = files.get(llmPath);
  if (!currentMetadataBytes) {
    stalePaths.add(llmPath);
  } else if (!bytesEqual(currentMetadataBytes, expectedMetadataBytes)) {
    stalePaths.add(llmPath);
  }

  const resource = manifest.resources.find((entry) => entry.path === llmPath);
  if (!resource) {
    stalePaths.add(`manifest.json#resources[${llmPath}]`);
  } else if (resource.integrity !== expectedIntegrity) {
    stalePaths.add(`manifest.json#resources[${llmPath}].integrity`);
  }

  return [...stalePaths].sort();
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function ensureMetadataResource(manifest: HtmlxManifest, path: string): HtmlxResource {
  const existingResource = manifest.resources.find((resource) => resource.path === path);
  if (existingResource) return existingResource;
  const resource: HtmlxResource = {
    path,
    mediaType: "application/json",
    role: "metadata",
  };
  manifest.resources.push(resource);
  return resource;
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
    profile?: string;
    entry?: string;
    language?: string;
  };
  return {
    title: typed.title,
    htmlxVersion: typed.htmlxVersion,
    profile: typed.profile,
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

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

const flowDocumentCss = `*,
*::before,
*::after {
  box-sizing: border-box;
}

:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.65;
}

body {
  margin: 0;
  color: #172033;
  background: #f6f8fb;
}

.htmlx-flow-document {
  width: min(100%, 920px);
  margin: 0 auto;
  padding: clamp(32px, 6vw, 72px) clamp(20px, 5vw, 56px);
  background: #ffffff;
}

article {
  max-width: 760px;
  margin: 0 auto;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 1.6em 0 0.45em;
  color: #10233f;
  line-height: 1.12;
}

h1:first-child {
  margin-top: 0;
}

h1 {
  font-size: clamp(2.25rem, 7vw, 4.5rem);
  letter-spacing: 0;
}

h2 {
  font-size: clamp(1.65rem, 4vw, 2.5rem);
}

h3 {
  font-size: clamp(1.25rem, 3vw, 1.6rem);
}

p,
li,
blockquote {
  font-size: clamp(1rem, 2.2vw, 1.15rem);
}

p,
ul,
ol,
blockquote,
pre {
  margin: 0 0 1.15em;
}

ul,
ol {
  padding-left: 1.35em;
}

li + li {
  margin-top: 0.42em;
}

blockquote {
  padding: 0.2em 0 0.2em 1em;
  border-left: 4px solid #1d8f8a;
  color: #40516b;
}

pre {
  overflow-x: auto;
  padding: 1em;
  border: 1px solid #d6e0ea;
  border-radius: 8px;
  background: #0e1a2b;
  color: #eef6ff;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

p code,
li code {
  padding: 0.1em 0.32em;
  border-radius: 4px;
  background: #e8eef5;
  color: #12304d;
}
`;

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
