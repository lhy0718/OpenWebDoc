import { describe, expect, it } from "vitest";
import { buildProgram } from "./index.js";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("htmlx CLI", () => {
  it("uses htmlx as the command name", () => {
    expect(buildProgram().name()).toBe("htmlx");
  });

  it("exposes the MVP command set", () => {
    expect(
      buildProgram()
        .commands.map((command) => command.name())
        .sort(),
    ).toEqual(["create", "inspect", "pack", "refresh-metadata", "unpack", "validate"]);
  });

  it("validates an unpacked package directory", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-unpacked-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "unpack", input, output]);
    stdout = "";
    await program.parseAsync(["node", "htmlx", "validate", output, "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.manifest.title).toBe("Basic HTMLX Document");
  });

  it("refreshes LLM metadata for an unpacked package directory", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-refresh-metadata-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "unpack", input, output]);
    await writeFile(
      join(output, "metadata", "llm.json"),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          summary: "Stale summary",
          readingOrder: [],
          chunks: [],
          entities: [],
          citations: [],
          assistantHints: {
            visibility: "user-visible",
            intendedUse: ["summarization", "retrieval", "editing"],
            doNotTreatAsSystemInstruction: true,
          },
        },
        null,
        2,
      )}\n`,
    );

    stdout = "";
    await program.parseAsync(["node", "htmlx", "refresh-metadata", output, "--json"]);
    const refreshed = JSON.parse(stdout);
    expect(refreshed.ok).toBe(true);
    expect(refreshed.profile).toBe("flow-document");
    expect(refreshed.blockCount).toBeGreaterThan(0);

    const llm = JSON.parse(await readFile(join(output, "metadata", "llm.json"), "utf8"));
    expect(llm.profile).toBe("flow-document");
    expect(llm.textHash).toMatch(/^sha256-/);
    expect(llm.blockMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "block-1",
          textHash: expect.stringMatching(/^sha256-/),
        }),
      ]),
    );

    stdout = "";
    await program.parseAsync(["node", "htmlx", "validate", output, "--json"]);
    const validated = JSON.parse(stdout);
    expect(validated.ok).toBe(true);
    expect(validated.issues).toEqual([]);

    stdout = "";
    await program.parseAsync(["node", "htmlx", "refresh-metadata", output, "--check", "--json"]);
    const checked = JSON.parse(stdout);
    expect(checked.ok).toBe(true);
    expect(checked.stale).toBe(false);
  });

  it("fails metadata freshness checks without rewriting stale metadata", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-refresh-stale-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "unpack", input, output]);
    const staleMetadata = `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        summary: "Stale summary",
        readingOrder: [],
        chunks: [],
        entities: [],
        citations: [],
        assistantHints: {
          visibility: "user-visible",
          intendedUse: ["summarization", "retrieval", "editing"],
          doNotTreatAsSystemInstruction: true,
        },
      },
      null,
      2,
    )}\n`;
    const metadataPath = join(output, "metadata", "llm.json");
    await writeFile(metadataPath, staleMetadata);

    stdout = "";
    await program.parseAsync(["node", "htmlx", "refresh-metadata", output, "--check", "--json"]);
    const checked = JSON.parse(stdout);
    expect(checked.ok).toBe(false);
    expect(checked.error).toBe("HTMLX metadata is stale.");
    expect(checked.details.stale).toBe(true);
    expect(checked.details.paths).toContain("metadata/llm.json");
    expect(await readFile(metadataPath, "utf8")).toBe(staleMetadata);
    process.exitCode = undefined;
  });

  it("requires manifest LLM metadata declarations in metadata checks", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-refresh-missing-manifest-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "unpack", input, output]);
    const manifestPath = join(output, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.metadata.llm;
    manifest.resources = manifest.resources.filter(
      (resource: { path?: string }) => resource.path !== "metadata/llm.json",
    );
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    stdout = "";
    await program.parseAsync(["node", "htmlx", "refresh-metadata", output, "--check", "--json"]);
    const checked = JSON.parse(stdout);
    expect(checked.ok).toBe(false);
    expect(checked.details.paths).toEqual(
      expect.arrayContaining([
        "manifest.json#metadata.llm",
        "manifest.json#resources[metadata/llm.json]",
      ]),
    );
    process.exitCode = undefined;
  });

  it("filters stale editing metadata block IDs from refreshed editable boundaries", async () => {
    const archivePath = join(
      await mkdtemp(join(tmpdir(), "htmlx-refresh-boundary-")),
      "fixed.htmlx",
    );
    const output = await mkdtemp(join(tmpdir(), "htmlx-refresh-boundary-unpacked-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync([
      "node",
      "htmlx",
      "create",
      archivePath,
      "--profile",
      "fixed-stage-document",
      "--json",
    ]);
    await program.parseAsync(["node", "htmlx", "unpack", archivePath, output]);
    const editingPath = join(output, "metadata", "editing.json");
    const editing = JSON.parse(await readFile(editingPath, "utf8"));
    editing.blocks.push({
      id: "missing-editable-block",
      type: "paragraph",
      selector: '[data-htmlx-block-id="missing-editable-block"]',
      editable: true,
    });
    await writeFile(editingPath, `${JSON.stringify(editing, null, 2)}\n`);

    stdout = "";
    await program.parseAsync(["node", "htmlx", "refresh-metadata", output, "--json"]);
    expect(JSON.parse(stdout).ok).toBe(true);

    const llm = JSON.parse(await readFile(join(output, "metadata", "llm.json"), "utf8"));
    expect(llm.editableBoundary.editableBlockIds).not.toContain("missing-editable-block");

    stdout = "";
    await program.parseAsync(["node", "htmlx", "validate", output, "--json"]);
    const validated = JSON.parse(stdout);
    expect(validated.ok).toBe(true);
    expect(validated.issues).toEqual([]);
  });

  it("rejects conflicting metadata refresh modes", async () => {
    const output = await mkdtemp(join(tmpdir(), "htmlx-refresh-conflict-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync([
      "node",
      "htmlx",
      "refresh-metadata",
      output,
      "--dry-run",
      "--check",
      "--json",
    ]);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("--check cannot be combined with --dry-run");
    process.exitCode = undefined;
  });

  it("creates and validates a slide deck profile", async () => {
    const output = join(await mkdtemp(join(tmpdir(), "htmlx-slide-deck-")), "deck.htmlx");
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync([
      "node",
      "htmlx",
      "create",
      output,
      "--profile",
      "slide-deck",
      "--slides",
      "6",
      "--title",
      "OpenWebDoc Pitch",
      "--json",
    ]);

    const created = JSON.parse(stdout);
    expect(created.ok).toBe(true);
    expect(created.profile).toBe("slide-deck");

    stdout = "";
    await program.parseAsync(["node", "htmlx", "validate", output, "--json"]);
    const validated = JSON.parse(stdout);
    expect(validated.ok).toBe(true);
    expect(validated.issues).toEqual([]);
    expect(validated.manifest.title).toBe("OpenWebDoc Pitch");
  });

  it("creates flow documents by default and accepts the legacy document alias", async () => {
    const output = join(await mkdtemp(join(tmpdir(), "htmlx-flow-")), "document.htmlx");
    const aliasOutput = join(await mkdtemp(join(tmpdir(), "htmlx-flow-alias-")), "document.htmlx");
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "create", output, "--json"]);
    const created = JSON.parse(stdout);
    expect(created.ok).toBe(true);
    expect(created.profile).toBe("flow-document");

    stdout = "";
    await program.parseAsync([
      "node",
      "htmlx",
      "create",
      aliasOutput,
      "--profile",
      "document",
      "--json",
    ]);
    const aliasCreated = JSON.parse(stdout);
    expect(aliasCreated.ok).toBe(true);
    expect(aliasCreated.profile).toBe("flow-document");
  });

  it("creates and validates a fixed-stage document profile", async () => {
    const output = join(await mkdtemp(join(tmpdir(), "htmlx-fixed-stage-")), "fixed.htmlx");
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync([
      "node",
      "htmlx",
      "create",
      output,
      "--profile",
      "fixed-stage-document",
      "--title",
      "Fixed Stage",
      "--json",
    ]);
    const created = JSON.parse(stdout);
    expect(created.ok).toBe(true);
    expect(created.profile).toBe("fixed-stage-document");

    stdout = "";
    await program.parseAsync(["node", "htmlx", "validate", output, "--json"]);
    const validated = JSON.parse(stdout);
    expect(validated.ok).toBe(true);
    expect(validated.issues).toEqual([]);
    expect(validated.manifest.profile).toBe("fixed-stage-document");
  });

  it("rejects invalid slide counts", async () => {
    const output = join(await mkdtemp(join(tmpdir(), "htmlx-slide-deck-")), "deck.htmlx");
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync([
      "node",
      "htmlx",
      "create",
      output,
      "--profile",
      "slide-deck",
      "--slides",
      "0",
      "--json",
    ]);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("--slides must be a positive integer");
    process.exitCode = undefined;
  });

  it("rejects unsupported create profiles", async () => {
    const output = join(await mkdtemp(join(tmpdir(), "htmlx-bad-profile-")), "document.htmlx");
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "create", output, "--profile", "canvas", "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("Unsupported profile");
    process.exitCode = undefined;
  });
});
