import { describe, expect, it } from "vitest";
import {
  HTMLX_CLI_COMMAND,
  OPENWEBDOC_NPM_SCOPE,
  createDefaultManifest,
  validateHtmlxAgentEditProposalSchema,
  validateHtmlxAgentEditRequestSchema,
  validateHtmlxManifestSchema,
} from "./index.js";

describe("HTMLX manifest schema", () => {
  it("accepts the default manifest", () => {
    const manifest = createDefaultManifest({
      packageId: "urn:uuid:00000000-0000-4000-8000-000000000000",
      title: "Example",
      now: "2026-05-13T00:00:00.000Z",
    });

    expect(validateHtmlxManifestSchema(manifest).valid).toBe(true);
    expect(manifest.entry).toBe("index.html");
  });

  it("rejects script-enabled manifests", () => {
    const manifest = createDefaultManifest({
      packageId: "urn:uuid:00000000-0000-4000-8000-000000000000",
      title: "Example",
      now: "2026-05-13T00:00:00.000Z",
    });

    const result = validateHtmlxManifestSchema({
      ...manifest,
      security: { ...manifest.security, allowScripts: true },
    });

    expect(result.valid).toBe(false);
  });

  it("keeps npm scope and CLI naming separate", () => {
    expect(OPENWEBDOC_NPM_SCOPE).toBe("@openwebdoc");
    expect(HTMLX_CLI_COMMAND).toBe("htmlx");
  });
});

describe("HTMLX agent edit schemas", () => {
  it("accepts an agent edit request", () => {
    const result = validateHtmlxAgentEditRequestSchema({
      schemaVersion: "0.1.0",
      workflow: "htmlx-agent-edit",
      source: {
        input: "example.htmlx",
        packageDirectory: "package",
        entry: "index.html",
        title: "Example",
        language: "en",
      },
      commands: {
        validate: "htmlx validate edited.htmlx --json",
        pack: "htmlx pack package edited.htmlx --json",
      },
      editableFiles: ["index.html", "metadata/llm.json"],
      packageEntries: ["index.html", "metadata/llm.json", "manifest.json"],
      allowedOperations: ["edit safe HTML"],
      constraints: ["Do not add scripts."],
      documentContext: {
        htmlPreview: "<main></main>",
        resources: [],
        metadata: {
          llm: "metadata/llm.json",
        },
      },
    });

    expect(result.valid).toBe(true);
  });

  it("rejects traversal paths in agent edit requests", () => {
    const result = validateHtmlxAgentEditRequestSchema({
      schemaVersion: "0.1.0",
      workflow: "htmlx-agent-edit",
      source: {
        input: "example.htmlx",
        packageDirectory: "package",
        entry: "../index.html",
        title: "Example",
        language: "en",
      },
      commands: {
        validate: "htmlx validate edited.htmlx --json",
        pack: "htmlx pack package edited.htmlx --json",
      },
      editableFiles: ["../index.html"],
      packageEntries: ["manifest.json"],
      allowedOperations: ["edit safe HTML"],
      constraints: ["Do not add scripts."],
      documentContext: {
        htmlPreview: "<main></main>",
        resources: [],
        metadata: {},
      },
    });

    expect(result.valid).toBe(false);
  });

  it("accepts an agent edit proposal", () => {
    const result = validateHtmlxAgentEditProposalSchema({
      schemaVersion: "0.1.0",
      status: "planned",
      summary: "Update one block.",
      operations: [
        {
          type: "replace_html",
          path: "index.html",
          summary: "Revise block wording.",
          blockIds: ["block-1"],
        },
      ],
      touchedFiles: ["index.html"],
      validation: {
        packedOutput: "edited.htmlx",
        commandsRun: ["htmlx pack package edited.htmlx --json"],
      },
    });

    expect(result.valid).toBe(true);
  });
});
