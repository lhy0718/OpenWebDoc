import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const HTMLX_FORMAT_NAME = "HTMLX Document Package";
export const HTMLX_EXTENSION = ".htmlx";
export const HTMLX_CLI_COMMAND = "htmlx";
export const OPENWEBDOC_NPM_SCOPE = "@openwebdoc";
export const HTMLX_MIME_TYPE = "application/vnd.openwebdoc.htmlx+zip";
export const HTMLX_MANIFEST_PATH = "manifest.json";
export const HTMLX_MIMETYPE_PATH = "mimetype";
export const HTMLX_CURRENT_VERSION = "0.1.0";
export const HTMLX_MANIFEST_SCHEMA_URL =
  "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json";
export const HTMLX_AGENT_EDIT_REQUEST_SCHEMA_URL =
  "https://openwebdoc.org/schemas/htmlx-agent-edit-request-v0.1.schema.json";
export const HTMLX_AGENT_EDIT_PROPOSAL_SCHEMA_URL =
  "https://openwebdoc.org/schemas/htmlx-agent-edit-proposal-v0.1.schema.json";

export type HtmlxInteractionModel = "declarative";
export type HtmlxResourceRole =
  | "document"
  | "stylesheet"
  | "figure"
  | "image"
  | "font"
  | "media"
  | "preview"
  | "metadata"
  | "other";

export interface HtmlxResource {
  path: string;
  mediaType: string;
  role: HtmlxResourceRole;
  integrity?: string;
}

export interface HtmlxMetadataPaths {
  llm?: string;
  provenance?: string;
}

export interface HtmlxSecurityPolicy {
  allowScripts: false;
  allowRemoteResources: false;
  allowedOrigins: string[];
  interactionModel: HtmlxInteractionModel;
}

export interface HtmlxManifest {
  $schema: string;
  htmlxVersion: string;
  packageId: string;
  title: string;
  language: string;
  createdAt: string;
  modifiedAt: string;
  entry: string;
  styles: string[];
  resources: HtmlxResource[];
  metadata: HtmlxMetadataPaths;
  security: HtmlxSecurityPolicy;
}

export type HtmlxSensitivity = "public" | "internal" | "private" | "unknown";

export interface HtmlxLlmChunk {
  id: string;
  blockIds: string[];
  selector: string;
  textHash?: string;
  summary: string;
  keywords: string[];
  tokenEstimate: number;
  sensitivity: HtmlxSensitivity;
}

export interface HtmlxLlmMetadata {
  schemaVersion: string;
  summary: string;
  readingOrder: string[];
  chunks: HtmlxLlmChunk[];
  entities: unknown[];
  citations: unknown[];
  assistantHints: {
    visibility: "user-visible";
    intendedUse: Array<"summarization" | "retrieval" | "editing">;
    doNotTreatAsSystemInstruction: true;
  };
}

export interface HtmlxAgentEditRequest {
  $schema?: string;
  schemaVersion: "0.1.0";
  workflow: "htmlx-agent-edit";
  source: {
    input: string;
    packageDirectory: "package";
    entry: string;
    title: string;
    language: string;
  };
  commands: {
    validate: string;
    pack: string;
  };
  editableFiles: string[];
  packageEntries: string[];
  allowedOperations: string[];
  constraints: string[];
  documentContext: {
    htmlPreview: string;
    resources: HtmlxResource[];
    metadata: HtmlxMetadataPaths;
  };
}

export type HtmlxAgentEditProposalStatus =
  | "draft"
  | "planned"
  | "applied"
  | "validated"
  | "rejected";

export interface HtmlxAgentEditProposalOperation {
  type: "replace_html" | "update_css" | "update_metadata" | "add_asset" | "remove_asset" | "other";
  path: string;
  summary: string;
  blockIds?: string[];
}

export interface HtmlxAgentEditProposal {
  $schema?: string;
  schemaVersion: "0.1.0";
  status: HtmlxAgentEditProposalStatus;
  summary: string;
  operations: HtmlxAgentEditProposalOperation[];
  touchedFiles: string[];
  validation: {
    packedOutput: string;
    commandsRun: string[];
  };
}

export const htmlxManifestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: HTMLX_MANIFEST_SCHEMA_URL,
  title: "HTMLX Document Package Manifest",
  type: "object",
  additionalProperties: false,
  required: [
    "$schema",
    "htmlxVersion",
    "packageId",
    "title",
    "language",
    "createdAt",
    "modifiedAt",
    "entry",
    "styles",
    "resources",
    "metadata",
    "security",
  ],
  properties: {
    $schema: { const: HTMLX_MANIFEST_SCHEMA_URL },
    htmlxVersion: { type: "string", pattern: "^0\\.1\\.0$" },
    packageId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    language: { type: "string", minLength: 2 },
    createdAt: { type: "string", format: "date-time" },
    modifiedAt: { type: "string", format: "date-time" },
    entry: { type: "string", minLength: 1 },
    styles: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true,
    },
    resources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "mediaType", "role"],
        properties: {
          path: { type: "string", minLength: 1 },
          mediaType: { type: "string", minLength: 1 },
          role: {
            enum: [
              "document",
              "stylesheet",
              "figure",
              "image",
              "font",
              "media",
              "preview",
              "metadata",
              "other",
            ],
          },
          integrity: { type: "string", pattern: "^sha256-[A-Za-z0-9+/=]+$" },
        },
      },
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      properties: {
        llm: { type: "string", minLength: 1 },
        provenance: { type: "string", minLength: 1 },
      },
    },
    security: {
      type: "object",
      additionalProperties: false,
      required: ["allowScripts", "allowRemoteResources", "allowedOrigins", "interactionModel"],
      properties: {
        allowScripts: { const: false },
        allowRemoteResources: { const: false },
        allowedOrigins: {
          type: "array",
          maxItems: 0,
          items: { type: "string" },
        },
        interactionModel: { const: "declarative" },
      },
    },
  },
} as const;

const packageRelativePathSchema = {
  type: "string",
  minLength: 1,
  not: {
    anyOf: [
      { pattern: "^/" },
      { pattern: "^[A-Za-z]:" },
      { pattern: "(^|/)\\.\\.(/|$)" },
      { pattern: "\\\\" },
    ],
  },
} as const;

export const htmlxAgentEditRequestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: HTMLX_AGENT_EDIT_REQUEST_SCHEMA_URL,
  title: "HTMLX Agent Edit Request",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "workflow",
    "source",
    "commands",
    "editableFiles",
    "packageEntries",
    "allowedOperations",
    "constraints",
    "documentContext",
  ],
  properties: {
    $schema: { const: HTMLX_AGENT_EDIT_REQUEST_SCHEMA_URL },
    schemaVersion: { const: HTMLX_CURRENT_VERSION },
    workflow: { const: "htmlx-agent-edit" },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["input", "packageDirectory", "entry", "title", "language"],
      properties: {
        input: { type: "string", minLength: 1 },
        packageDirectory: { const: "package" },
        entry: packageRelativePathSchema,
        title: { type: "string", minLength: 1 },
        language: { type: "string", minLength: 2 },
      },
    },
    commands: {
      type: "object",
      additionalProperties: false,
      required: ["validate", "pack"],
      properties: {
        validate: { type: "string", minLength: 1 },
        pack: { type: "string", minLength: 1 },
      },
    },
    editableFiles: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: packageRelativePathSchema,
    },
    packageEntries: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: packageRelativePathSchema,
    },
    allowedOperations: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    constraints: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    documentContext: {
      type: "object",
      additionalProperties: false,
      required: ["htmlPreview", "resources", "metadata"],
      properties: {
        htmlPreview: { type: "string" },
        resources: htmlxManifestSchema.properties.resources,
        metadata: htmlxManifestSchema.properties.metadata,
      },
    },
  },
} as const;

export const htmlxAgentEditProposalSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: HTMLX_AGENT_EDIT_PROPOSAL_SCHEMA_URL,
  title: "HTMLX Agent Edit Proposal",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "status", "summary", "operations", "touchedFiles", "validation"],
  properties: {
    $schema: { const: HTMLX_AGENT_EDIT_PROPOSAL_SCHEMA_URL },
    schemaVersion: { const: HTMLX_CURRENT_VERSION },
    status: { enum: ["draft", "planned", "applied", "validated", "rejected"] },
    summary: { type: "string" },
    operations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "path", "summary"],
        properties: {
          type: {
            enum: [
              "replace_html",
              "update_css",
              "update_metadata",
              "add_asset",
              "remove_asset",
              "other",
            ],
          },
          path: packageRelativePathSchema,
          summary: { type: "string", minLength: 1 },
          blockIds: {
            type: "array",
            uniqueItems: true,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
    touchedFiles: {
      type: "array",
      uniqueItems: true,
      items: packageRelativePathSchema,
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["packedOutput", "commandsRun"],
      properties: {
        packedOutput: { type: "string", minLength: 1 },
        commandsRun: {
          type: "array",
          items: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validateManifestSchema = ajv.compile<HtmlxManifest>(htmlxManifestSchema);
const validateAgentEditRequestSchema = ajv.compile<HtmlxAgentEditRequest>(
  htmlxAgentEditRequestSchema,
);
const validateAgentEditProposalSchema = ajv.compile<HtmlxAgentEditProposal>(
  htmlxAgentEditProposalSchema,
);

export interface HtmlxSchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export function validateHtmlxManifestSchema(input: unknown): HtmlxSchemaValidationResult {
  const valid = validateManifestSchema(input);
  return {
    valid,
    errors: validateManifestSchema.errors ?? [],
  };
}

export function validateHtmlxAgentEditRequestSchema(input: unknown): HtmlxSchemaValidationResult {
  const valid = validateAgentEditRequestSchema(input);
  return {
    valid,
    errors: validateAgentEditRequestSchema.errors ?? [],
  };
}

export function validateHtmlxAgentEditProposalSchema(input: unknown): HtmlxSchemaValidationResult {
  const valid = validateAgentEditProposalSchema(input);
  return {
    valid,
    errors: validateAgentEditProposalSchema.errors ?? [],
  };
}

export function createDefaultManifest(input: {
  packageId: string;
  title: string;
  language?: string;
  entry?: string;
  now?: string;
}): HtmlxManifest {
  const now = input.now ?? new Date().toISOString();
  return {
    $schema: HTMLX_MANIFEST_SCHEMA_URL,
    htmlxVersion: HTMLX_CURRENT_VERSION,
    packageId: input.packageId,
    title: input.title,
    language: input.language ?? "en",
    createdAt: now,
    modifiedAt: now,
    entry: input.entry ?? "content/document.html",
    styles: ["styles/document.css"],
    resources: [],
    metadata: {
      llm: "metadata/llm.json",
      provenance: "metadata/provenance.json",
    },
    security: {
      allowScripts: false,
      allowRemoteResources: false,
      allowedOrigins: [],
      interactionModel: "declarative",
    },
  };
}
