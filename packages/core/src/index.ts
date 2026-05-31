import {
  HTMLX_MANIFEST_PATH,
  HTMLX_MIME_TYPE,
  HTMLX_MIMETYPE_PATH,
  normalizeHtmlxDocumentProfile,
  type HtmlxDocumentProfile,
  type HtmlxEditingMetadata,
  type HtmlxLlmBlockKind,
  type HtmlxLlmMetadata,
  type HtmlxManifest,
  type HtmlxPresentationMetadata,
  createDefaultManifest,
  validateHtmlxManifestSchema,
  validateHtmlxPresentationMetadataSchema,
} from "@openwebdoc/spec";
import sanitizeHtml from "sanitize-html";
import { unzipSync, zipSync } from "fflate";

export type HtmlxSeverity = "error" | "warning";

export interface HtmlxValidationIssue {
  severity: HtmlxSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface HtmlxValidationResult {
  valid: boolean;
  issues: HtmlxValidationIssue[];
  profile?: HtmlxDocumentProfile;
  manifest?: HtmlxManifest;
}

export interface HtmlxPackage {
  manifest: HtmlxManifest;
  files: Map<string, Uint8Array>;
  validation: HtmlxValidationResult;
}

export interface HtmlxResolvedDocument {
  html: string;
  objectUrls: string[];
  revoke: () => void;
}

export interface HtmlxResolveOptions {
  createObjectUrl?: (blob: Blob, path: string) => string;
}

export interface HtmlxCreateInput {
  manifest: HtmlxManifest;
  files: Map<string, Uint8Array> | Record<string, Uint8Array | string>;
}

export interface HtmlxCreateDocumentInput {
  title: string;
  language?: string;
  html: string;
  css?: string;
  llm?: HtmlxLlmMetadata;
  packageId?: string;
}

export interface HtmlxLlmMetadataInput {
  title: string;
  html: string;
  profile?: HtmlxDocumentProfile;
  summary?: string;
  keywords?: string[];
  editableBlockIds?: string[];
  appEditableBlockIds?: string[];
  externalAgentEditableFiles?: string[];
  entities?: unknown[];
  citations?: unknown[];
}

export interface HtmlxPackInput {
  files: Map<string, Uint8Array> | Record<string, Uint8Array | string>;
}

export interface HtmlxLimits {
  maxEntries: number;
  maxTotalUncompressedBytes: number;
  maxEntryBytes: number;
}

export interface HtmlxOpenOptions {
  limits?: Partial<HtmlxLimits>;
}

export const defaultHtmlxLimits: HtmlxLimits = {
  maxEntries: 512,
  maxTotalUncompressedBytes: 50 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class HtmlxError extends Error {
  constructor(
    message: string,
    public readonly issues: HtmlxValidationIssue[],
  ) {
    super(message);
    this.name = "HtmlxError";
  }
}

export async function createHtmlx(
  input: HtmlxCreateInput | HtmlxCreateDocumentInput,
): Promise<Uint8Array> {
  if ("manifest" in input) {
    return createHtmlxFromManifest(input);
  }
  return createHtmlxDocument(input);
}

export async function createHtmlxDocument(input: HtmlxCreateDocumentInput): Promise<Uint8Array> {
  const now = new Date().toISOString();
  const manifest = createDefaultManifest({
    packageId: input.packageId ?? `urn:uuid:${crypto.randomUUID()}`,
    title: input.title,
    language: input.language ?? "en",
    now,
  });

  const llm =
    input.llm ??
    (await createHtmlxLlmMetadata({
      title: input.title,
      html: input.html,
      profile: "flow-document",
    }));
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "OpenWebDoc",
    createdAt: now,
    sources: [],
  };

  const standaloneHtml = ensureStandaloneHtmlEntry(input.html, "styles/document.css", input.title);
  const files = new Map<string, Uint8Array>([
    [manifest.entry, encodeText(standaloneHtml)],
    ["styles/document.css", encodeText(input.css ?? defaultDocumentCss)],
    ["metadata/llm.json", encodeJson(llm)],
    ["metadata/provenance.json", encodeJson(provenance)],
  ]);

  manifest.resources = [
    {
      path: "styles/document.css",
      mediaType: "text/css",
      role: "stylesheet",
      integrity: await sha256Integrity(files.get("styles/document.css")!),
    },
    {
      path: "metadata/llm.json",
      mediaType: "application/json",
      role: "metadata",
      integrity: await sha256Integrity(files.get("metadata/llm.json")!),
    },
    {
      path: "metadata/provenance.json",
      mediaType: "application/json",
      role: "metadata",
      integrity: await sha256Integrity(files.get("metadata/provenance.json")!),
    },
  ];

  return createHtmlxFromManifest({ manifest, files });
}

export async function createHtmlxFromManifest(input: HtmlxCreateInput): Promise<Uint8Array> {
  const files = normalizeFileMap(input.files);
  files.set(HTMLX_MIMETYPE_PATH, encodeText(HTMLX_MIME_TYPE));
  files.set(HTMLX_MANIFEST_PATH, encodeJson(input.manifest));

  const validation = await validateFileMap(files);
  if (!validation.valid) {
    throw new HtmlxError("Cannot create invalid HTMLX package.", validation.issues);
  }

  return zipSync(Object.fromEntries(files));
}

export async function openHtmlx(
  input: Uint8Array,
  options: HtmlxOpenOptions = {},
): Promise<HtmlxPackage> {
  const files = unzipHtmlx(input, options);
  const validation = await validateFileMap(files, options);
  if (!validation.valid || !validation.manifest) {
    throw new HtmlxError("Invalid HTMLX package.", validation.issues);
  }
  return {
    manifest: validation.manifest,
    files,
    validation,
  };
}

export async function validateHtmlx(
  input: Uint8Array | Map<string, Uint8Array> | Record<string, Uint8Array | string>,
  options: HtmlxOpenOptions = {},
): Promise<HtmlxValidationResult> {
  if (input instanceof Uint8Array) {
    try {
      return await validateFileMap(unzipHtmlx(input, options), options);
    } catch (error) {
      return {
        valid: false,
        issues: [
          {
            severity: "error",
            code: "zip.invalid",
            message: error instanceof Error ? error.message : "Invalid ZIP package.",
          },
        ],
      };
    }
  }
  return validateFileMap(normalizeFileMap(input), options);
}

export async function packHtmlx(input: HtmlxPackInput): Promise<Uint8Array> {
  const validation = await validateFileMap(normalizeFileMap(input.files));
  if (!validation.valid) {
    throw new HtmlxError("Cannot pack invalid HTMLX files.", validation.issues);
  }
  return zipSync(Object.fromEntries(normalizeFileMap(input.files)));
}

export function unpackHtmlx(
  input: Uint8Array,
  options: HtmlxOpenOptions = {},
): Map<string, Uint8Array> {
  return unzipHtmlx(input, options);
}

export function sanitizeHtmlxDocument(html: string): string {
  return sanitizeHtml(extractHtmlBody(html), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "article",
      "aside",
      "figure",
      "figcaption",
      "htmlx-inline",
      "img",
      "main",
      "section",
      "time",
      "u",
    ]),
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "style",
        "title",
        "data-htmlx-block-id",
        "data-htmlx-kind",
        "data-htmlx-editable",
        "data-htmlx-stage-width",
        "data-htmlx-stage-height",
        "data-htmlx-x",
        "data-htmlx-y",
        "data-htmlx-width",
        "data-htmlx-height",
        "data-htmlx-font-size",
        "data-htmlx-line-height",
        "data-htmlx-color",
        "data-htmlx-asset-id",
        "data-htmlx-original-src",
        "data-htmlx-original-href",
        "data-htmlx-runtime-origin-x",
        "data-htmlx-runtime-origin-y",
        "data-htmlx-shape",
        "data-htmlx-fill",
        "data-htmlx-card-x",
        "data-htmlx-card-y",
        "data-htmlx-card-width",
        "data-htmlx-card-height",
        "data-htmlx-variant",
        "data-htmlx-object-text",
        "data-htmlx-profile",
        "data-htmlx-slide-id",
        "data-htmlx-slide-index",
        "aria-label",
      ],
      a: ["href", "name", "target", "rel", "data-htmlx-original-href"],
      img: ["src", "alt", "width", "height", "data-htmlx-original-src"],
      section: ["data-htmlx-block-id"],
      article: ["data-htmlx-block-id"],
      div: ["data-htmlx-block-id"],
      p: ["data-htmlx-block-id"],
      h1: ["data-htmlx-block-id"],
      h2: ["data-htmlx-block-id"],
      h3: ["data-htmlx-block-id"],
    },
    allowedSchemes: ["http", "https", "mailto", "blob"],
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
        background: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
        display: [/^inline$/i],
        "font-size": [/^\d+(\.\d+)?(px|rem|em|cqw|%)$/i],
        "line-height": [/^\d+(\.\d+)?$/],
        width: [/^\d+(\.\d+)?(px|cqw|%)$/i],
        height: [/^\d+(\.\d+)?(px|cqw|%)$/i],
        transform: [/^translate\(-?\d+(\.\d+)?(px|cqw|%),\s*-?\d+(\.\d+)?(px|cqw|%)\)$/i],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}

export function resolveHtmlxProfile(
  manifest: HtmlxManifest,
  files?: Map<string, Uint8Array>,
): HtmlxDocumentProfile {
  const explicitProfile = normalizeHtmlxDocumentProfile(manifest.profile);
  if (explicitProfile) return explicitProfile;
  if (manifest.metadata.presentation) return "slide-deck";
  if (hasEditingStageMetadata(manifest, files)) return "fixed-stage-document";
  if (hasSelfEditableStageEntry(manifest, files)) return "fixed-stage-document";
  return "flow-document";
}

function extractHtmlBody(html: string): string {
  const match = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] ?? html;
}

export function resolveHtmlxDocument(
  htmlxPackage: HtmlxPackage,
  options: HtmlxResolveOptions = {},
): HtmlxResolvedDocument {
  const { manifest, files } = htmlxPackage;
  const objectUrls: string[] = [];
  const resources = new Map(manifest.resources.map((resource) => [resource.path, resource]));
  const createObjectUrl =
    options.createObjectUrl ??
    ((blob: Blob) => {
      if (!globalThis.URL?.createObjectURL) {
        throw new Error("URL.createObjectURL is not available in this environment.");
      }
      return globalThis.URL.createObjectURL(blob);
    });

  const toObjectUrl = (packagePath: string): string | null => {
    const normalizedPath = normalizePackagePath(packagePath);
    if (!normalizedPath || !files.has(normalizedPath) || !resources.has(normalizedPath)) {
      return null;
    }
    const resource = resources.get(normalizedPath)!;
    const url = createObjectUrl(
      new Blob([copyToArrayBuffer(files.get(normalizedPath)!)], {
        type: resource.mediaType,
      }),
      normalizedPath,
    );
    objectUrls.push(url);
    return url;
  };

  const rawHtml = decodeText(files.get(manifest.entry)!);
  const rewrittenHtml = rewriteHtmlResourceAttributes(rawHtml, toObjectUrl);
  const sanitizedBody = sanitizeHtmlxDocument(rewrittenHtml);
  const styles = manifest.styles
    .map((stylePath) => {
      const normalizedPath = normalizePackagePath(stylePath);
      if (!normalizedPath || !files.has(normalizedPath)) {
        return "";
      }
      return `<style data-htmlx-style="${escapeHtmlAttribute(normalizedPath)}">${escapeStyleText(
        decodeText(files.get(normalizedPath)!),
      )}</style>`;
    })
    .join("\n");

  return {
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    ${styles}
  </head>
  <body>
    ${sanitizedBody}
  </body>
</html>`,
    objectUrls,
    revoke: () => {
      for (const url of objectUrls) {
        globalThis.URL?.revokeObjectURL?.(url);
      }
    },
  };
}

export function decodeText(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function encodeText(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function encodeJson(value: unknown): Uint8Array {
  return encodeText(`${JSON.stringify(value, null, 2)}\n`);
}

export function normalizePackagePath(path: string): string | null {
  if (!path || path.includes("\0") || path.includes("\\")) {
    return null;
  }
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    return null;
  }

  const parts: string[] = [];
  for (const rawPart of path.split("/")) {
    if (!rawPart || rawPart === ".") {
      continue;
    }
    if (rawPart === "..") {
      return null;
    }
    parts.push(rawPart);
  }

  return parts.length > 0 ? parts.join("/") : null;
}

export async function sha256Integrity(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer);
  return `sha256-${base64FromBytes(new Uint8Array(digest))}`;
}

async function validateFileMap(
  files: Map<string, Uint8Array>,
  options: HtmlxOpenOptions = {},
): Promise<HtmlxValidationResult> {
  const limits = { ...defaultHtmlxLimits, ...options.limits };
  const issues: HtmlxValidationIssue[] = [];
  let totalBytes = 0;
  const normalized = new Set<string>();

  if (files.size > limits.maxEntries) {
    issues.push({
      severity: "error",
      code: "zip.too_many_entries",
      message: `Package has ${files.size} entries; limit is ${limits.maxEntries}.`,
    });
  }

  for (const [path, bytes] of files) {
    const normalizedPath = normalizePackagePath(path);
    if (!normalizedPath || normalizedPath !== path) {
      issues.push({
        severity: "error",
        code: "path.invalid",
        message: `Invalid package path: ${path}`,
        path,
      });
    }
    if (normalized.has(path)) {
      issues.push({
        severity: "error",
        code: "zip.duplicate_entry",
        message: `Duplicate package path: ${path}`,
        path,
      });
    }
    normalized.add(path);
    totalBytes += bytes.byteLength;
    if (bytes.byteLength > limits.maxEntryBytes) {
      issues.push({
        severity: "error",
        code: "zip.entry_too_large",
        message: `Entry exceeds per-entry limit: ${path}`,
        path,
      });
    }
  }

  if (totalBytes > limits.maxTotalUncompressedBytes) {
    issues.push({
      severity: "error",
      code: "zip.package_too_large",
      message: `Package exceeds uncompressed size limit: ${totalBytes} bytes.`,
    });
  }

  if (decodeText(files.get(HTMLX_MIMETYPE_PATH) ?? new Uint8Array()) !== HTMLX_MIME_TYPE) {
    issues.push({
      severity: "error",
      code: "mimetype.invalid",
      message: `Missing or invalid ${HTMLX_MIMETYPE_PATH}.`,
      path: HTMLX_MIMETYPE_PATH,
    });
  }

  const manifestBytes = files.get(HTMLX_MANIFEST_PATH);
  if (!manifestBytes) {
    issues.push({
      severity: "error",
      code: "manifest.missing",
      message: "Missing manifest.json.",
      path: HTMLX_MANIFEST_PATH,
    });
    return { valid: false, issues };
  }

  let manifest: HtmlxManifest | undefined;
  try {
    manifest = JSON.parse(decodeText(manifestBytes)) as HtmlxManifest;
  } catch {
    issues.push({
      severity: "error",
      code: "manifest.invalid_json",
      message: "manifest.json is not valid JSON.",
      path: HTMLX_MANIFEST_PATH,
    });
    return { valid: false, issues };
  }

  const schemaResult = validateHtmlxManifestSchema(manifest);
  if (!schemaResult.valid) {
    for (const error of schemaResult.errors) {
      issues.push({
        severity: "error",
        code: "manifest.schema",
        message: `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
        path: HTMLX_MANIFEST_PATH,
      });
    }
  }

  const profile = resolveHtmlxProfile(manifest, files);
  validateProfileContract(manifest, files, profile, issues);
  validateManifestPaths(manifest, files, issues);
  validateMetadataDeclarations(manifest, files, issues);
  await validateResourceIntegrity(manifest, files, issues);
  validateDocumentSafety(manifest, files, issues);
  validateStylesheetSafety(manifest, files, issues);
  validateProportionalLayoutContract(manifest, files, profile, issues);
  validateEditingMetadata(manifest, files, issues);
  validatePresentationMetadata(manifest, files, issues);
  await validateLlmMetadata(manifest, files, profile, issues);

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    profile,
    manifest,
  };
}

function validateProfileContract(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  profile: HtmlxDocumentProfile,
  issues: HtmlxValidationIssue[],
): void {
  const explicitProfile = manifest.profile;
  const normalizedExplicitProfile = normalizeHtmlxDocumentProfile(explicitProfile);
  if (explicitProfile !== undefined && !normalizedExplicitProfile) {
    issues.push({
      severity: "error",
      code: "profile.invalid",
      message: "HTMLX profile must be one of flow-document, fixed-stage-document, or slide-deck.",
      path: HTMLX_MANIFEST_PATH,
    });
    return;
  }

  if (
    manifest.metadata.presentation &&
    explicitProfile !== undefined &&
    normalizedExplicitProfile !== "slide-deck"
  ) {
    issues.push({
      severity: "error",
      code: "profile.presentation_mismatch",
      message: "Packages with metadata.presentation must use the slide-deck profile.",
      path: HTMLX_MANIFEST_PATH,
    });
  }

  if (profile === "slide-deck" && !manifest.metadata.presentation) {
    issues.push({
      severity: "error",
      code: "profile.presentation_missing",
      message: "Slide deck packages must declare metadata.presentation.",
      path: HTMLX_MANIFEST_PATH,
    });
  }

  const htmlBytes = files.get(manifest.entry);
  const html = htmlBytes ? decodeText(htmlBytes) : "";
  const hasStage = hasSelfEditableStage(html);
  if (profile === "fixed-stage-document" && !hasStage) {
    issues.push({
      severity: "error",
      code: "profile.fixed_stage_missing",
      message: "Fixed-stage document packages must declare a data-htmlx-editable document stage.",
      path: manifest.entry,
    });
  }

  if (normalizedExplicitProfile === "flow-document" && hasStage) {
    issues.push({
      severity: "error",
      code: "profile.flow_stage_conflict",
      message:
        "Flow document packages must not use fixed-stage document geometry; use fixed-stage-document instead.",
      path: manifest.entry,
    });
  }
}

function validateManifestPaths(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
  const referenced = [
    manifest.entry,
    ...manifest.styles,
    ...manifest.resources.map((resource) => resource.path),
    ...Object.values(manifest.metadata),
  ].filter(Boolean);

  for (const path of referenced) {
    if (typeof path !== "string") {
      continue;
    }
    if (normalizePackagePath(path) !== path) {
      issues.push({
        severity: "error",
        code: "manifest.path_invalid",
        message: `Manifest references an invalid path: ${path}`,
        path,
      });
      continue;
    }
    if (!files.has(path)) {
      issues.push({
        severity: "error",
        code: "manifest.path_missing",
        message: `Manifest references a missing file: ${path}`,
        path,
      });
    }
  }
}

function validateMetadataDeclarations(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
  const resources = new Map(manifest.resources.map((resource) => [resource.path, resource]));
  for (const [metadataKind, metadataPath] of Object.entries(manifest.metadata)) {
    if (!metadataPath) {
      continue;
    }

    const resource = resources.get(metadataPath);
    if (!resource) {
      issues.push({
        severity: "error",
        code: "metadata.resource_missing",
        message: `Metadata path must be declared in manifest.resources: ${metadataPath}`,
        path: metadataPath,
      });
      continue;
    }

    if (resource.role !== "metadata") {
      issues.push({
        severity: "error",
        code: "metadata.role_invalid",
        message: `Metadata resource must use role "metadata": ${metadataPath}`,
        path: metadataPath,
      });
    }

    if (
      metadataKind !== "editingGuide" &&
      metadataPath.endsWith(".json") &&
      resource.mediaType !== "application/json"
    ) {
      issues.push({
        severity: "error",
        code: "metadata.media_type_invalid",
        message: `JSON metadata must use application/json: ${metadataPath}`,
        path: metadataPath,
      });
    }
  }

  validateEditingGuideMetadata(manifest, files, resources, issues);
}

function validateEditingGuideMetadata(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  resources: Map<string, HtmlxManifest["resources"][number]>,
  issues: HtmlxValidationIssue[],
): void {
  const editingGuidePath = manifest.metadata.editingGuide;
  if (!editingGuidePath) {
    return;
  }

  const resource = resources.get(editingGuidePath);
  if (resource && resource.mediaType !== "text/markdown") {
    issues.push({
      severity: "error",
      code: "editing_guide.media_type_invalid",
      message: "Editing guides must use text/markdown.",
      path: editingGuidePath,
    });
  }

  if (!editingGuidePath.startsWith("metadata/") || !editingGuidePath.endsWith(".md")) {
    issues.push({
      severity: "error",
      code: "editing_guide.path_invalid",
      message: "Editing guides must live under metadata/ and use a .md extension.",
      path: editingGuidePath,
    });
  }

  const bytes = files.get(editingGuidePath);
  if (!bytes) {
    return;
  }

  const guideText = decodeText(bytes).trim();
  if (!guideText) {
    issues.push({
      severity: "error",
      code: "editing_guide.empty",
      message: "Editing guide metadata must not be empty.",
      path: editingGuidePath,
    });
    return;
  }

  const unsafeInstructionPatterns: Array<[RegExp, string]> = [
    [/ignore (all )?(previous|prior) instructions/i, "ignore previous instructions"],
    [/system instruction\s*:/i, "system instruction block"],
    [/developer message\s*:/i, "developer message block"],
    [/assistant must/i, "assistant command phrasing"],
  ];
  for (const [pattern, label] of unsafeInstructionPatterns) {
    if (pattern.test(guideText)) {
      issues.push({
        severity: "error",
        code: "editing_guide.system_instruction_guard",
        message: `Editing guide must remain reference data, not hidden instructions: ${label}.`,
        path: editingGuidePath,
      });
    }
  }
}

async function validateResourceIntegrity(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): Promise<void> {
  for (const resource of manifest.resources) {
    if (!resource.integrity || !files.has(resource.path)) {
      continue;
    }
    const actual = await sha256Integrity(files.get(resource.path)!);
    if (actual !== resource.integrity) {
      issues.push({
        severity: "error",
        code: "resource.integrity_mismatch",
        message: `Integrity mismatch for ${resource.path}.`,
        path: resource.path,
      });
    }
  }
}

function validateDocumentSafety(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
  const htmlBytes = files.get(manifest.entry);
  if (!htmlBytes) {
    return;
  }
  const html = decodeText(htmlBytes);
  const checks: Array<[RegExp, string, string]> = [
    [/<script[\s>]/i, "html.script", "Scripts are not allowed in HTMLX documents."],
    [/\son[a-z]+\s*=/i, "html.event_handler", "Inline event handlers are not allowed."],
    [/javascript:/i, "html.javascript_url", "javascript: URLs are not allowed."],
    [/<iframe[\s>]/i, "html.iframe", "Iframes are not allowed in MVP packages."],
    [/<form[\s>]/i, "html.form", "Forms are not allowed in MVP packages."],
    [
      /\sstyle\s*=\s*["'][^"']*(?:url\s*\(|@import|javascript:|https?:\/\/|file:)/i,
      "html.inline_style_resource",
      "Inline styles must not reference scripts or remote/file resources.",
    ],
    [
      /\s(?:src|href)\s*=\s*["']https?:\/\//i,
      "html.remote_resource",
      "Remote resources are not allowed.",
    ],
    [/\s(?:src|href)\s*=\s*["']file:/i, "html.file_resource", "file: resources are not allowed."],
  ];

  for (const [pattern, code, message] of checks) {
    if (pattern.test(html)) {
      issues.push({ severity: "error", code, message, path: manifest.entry });
    }
  }

  const localRefs = extractHtmlResourceRefs(html);
  const manifestResourcePaths = new Set(manifest.resources.map((resource) => resource.path));
  for (const ref of localRefs) {
    const normalizedPath = normalizePackagePath(ref);
    if (
      !normalizedPath ||
      !files.has(normalizedPath) ||
      !manifestResourcePaths.has(normalizedPath)
    ) {
      issues.push({
        severity: "error",
        code: "html.local_resource_missing",
        message: `Local resource reference is missing from package resources: ${ref}`,
        path: manifest.entry,
      });
    }
  }
}

function validateStylesheetSafety(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
  for (const stylePath of manifest.styles) {
    const styleBytes = files.get(stylePath);
    if (!styleBytes) {
      continue;
    }
    const css = decodeText(styleBytes);
    const checks: Array<[RegExp, string, string]> = [
      [/@import/i, "css.import", "CSS @import is not allowed in MVP packages."],
      [/url\(\s*["']?https?:\/\//i, "css.remote_resource", "Remote CSS resources are not allowed."],
      [/url\(\s*["']?file:/i, "css.file_resource", "file: CSS resources are not allowed."],
      [/javascript:/i, "css.javascript_url", "javascript: URLs are not allowed in CSS."],
    ];
    for (const [pattern, code, message] of checks) {
      if (pattern.test(css)) {
        issues.push({ severity: "error", code, message, path: stylePath });
      }
    }
  }
}

function validateProportionalLayoutContract(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  profile: HtmlxDocumentProfile,
  issues: HtmlxValidationIssue[],
): void {
  const htmlBytes = files.get(manifest.entry);
  if (!htmlBytes) return;

  const html = decodeText(htmlBytes);
  if (!hasSelfEditableStage(html)) return;
  if (profile === "flow-document") return;

  if (manifest.entry !== "index.html") {
    issues.push({
      severity: "error",
      code: "layout.entry_not_standalone",
      message: "Self-editable HTMLX documents must use root index.html as the package entry.",
      path: HTMLX_MANIFEST_PATH,
    });
  }

  const stageTag = extractTagsWithAttribute(html, "data-htmlx-editable", "document")[0];
  if (!stageTag) {
    return;
  }
  validateNumericAttributes(
    stageTag,
    ["data-htmlx-stage-width", "data-htmlx-stage-height"],
    "layout.stage_geometry_missing",
    "Self-editable HTMLX stage must declare data-htmlx-stage-width and data-htmlx-stage-height.",
    manifest.entry,
    issues,
  );

  for (const tag of extractTagsWithAttribute(html, "data-htmlx-editable", "text")) {
    validateNumericAttributes(
      tag,
      [
        "data-htmlx-x",
        "data-htmlx-y",
        "data-htmlx-width",
        "data-htmlx-font-size",
        "data-htmlx-line-height",
      ],
      "layout.text_geometry_missing",
      "Editable text blocks must declare stage-relative geometry and typography data attributes.",
      manifest.entry,
      issues,
    );
  }

  for (const tag of extractTagsWithAttribute(html, "data-htmlx-editable", "object")) {
    validateNumericAttributes(
      tag,
      ["data-htmlx-x", "data-htmlx-y", "data-htmlx-width", "data-htmlx-height"],
      "layout.object_geometry_missing",
      "Editable object blocks must declare stage-relative geometry data attributes.",
      manifest.entry,
      issues,
    );
  }

  let hasBorderBoxSizing = false;
  for (const stylePath of manifest.styles) {
    const styleBytes = files.get(stylePath);
    if (!styleBytes) continue;
    const css = decodeText(styleBytes);
    hasBorderBoxSizing ||= /box-sizing\s*:\s*border-box/i.test(css);
    if (/\b(?:min|max|clamp)\s*\(/i.test(css)) {
      issues.push({
        severity: "error",
        code: "layout.non_proportional_css_function",
        message:
          "Self-editable HTMLX styles must not use min(), max(), or clamp(); use the stage coordinate scale instead.",
        path: stylePath,
      });
    }
    if (/@media\b/i.test(css)) {
      issues.push({
        severity: "error",
        code: "layout.media_query_override",
        message:
          "Self-editable HTMLX styles must not use media queries that override the stage coordinate scale.",
        path: stylePath,
      });
    }
  }
  if (!hasBorderBoxSizing) {
    issues.push({
      severity: "error",
      code: "layout.box_sizing_missing",
      message:
        "Self-editable HTMLX styles must set box-sizing: border-box so declared object frames include border and padding.",
      path: manifest.styles[0] ?? manifest.entry,
    });
  }
}

async function validateLlmMetadata(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  profile: HtmlxDocumentProfile,
  issues: HtmlxValidationIssue[],
): Promise<void> {
  const llmPath = manifest.metadata.llm;
  if (!llmPath || !files.has(llmPath) || !files.has(manifest.entry)) {
    return;
  }

  let metadata: HtmlxLlmMetadata;
  try {
    metadata = JSON.parse(decodeText(files.get(llmPath)!)) as HtmlxLlmMetadata;
  } catch {
    issues.push({
      severity: "error",
      code: "llm.invalid_json",
      message: "LLM metadata is not valid JSON.",
      path: llmPath,
    });
    return;
  }

  if (metadata.assistantHints?.doNotTreatAsSystemInstruction !== true) {
    issues.push({
      severity: "error",
      code: "llm.system_instruction_guard",
      message: "LLM metadata must explicitly opt out of system-instruction treatment.",
      path: llmPath,
    });
  }

  const html = decodeText(files.get(manifest.entry)!);
  const blockMap = extractHtmlxBlocks(html);
  const blockIds = new Set(blockMap.keys());

  if (metadata.profile && metadata.profile !== profile) {
    issues.push({
      severity: "error",
      code: "llm.profile_mismatch",
      message: `LLM metadata profile ${metadata.profile} does not match resolved package profile ${profile}.`,
      path: llmPath,
    });
  }

  if (metadata.textHash) {
    const actualTextHash = await textHash(extractVisibleText(html));
    if (metadata.textHash !== actualTextHash) {
      issues.push({
        severity: "warning",
        code: "llm.text_hash_mismatch",
        message: "LLM metadata document textHash does not match current document text.",
        path: llmPath,
      });
    }
  }

  for (const blockId of metadata.readingOrder ?? []) {
    if (!blockIds.has(blockId)) {
      issues.push({
        severity: "error",
        code: "llm.block_missing",
        message: `readingOrder references missing block ID: ${blockId}`,
        path: llmPath,
      });
    }
  }

  if (metadata.selectors && typeof metadata.selectors === "object") {
    for (const [blockId, selector] of Object.entries(metadata.selectors)) {
      if (!blockIds.has(blockId)) {
        issues.push({
          severity: "error",
          code: "llm.selector_block_missing",
          message: `selectors references missing block ID: ${blockId}`,
          path: llmPath,
        });
      }
      if (typeof selector !== "string" || selector.trim() === "") {
        issues.push({
          severity: "error",
          code: "llm.selector_invalid",
          message: `selectors.${blockId} must be a non-empty selector string.`,
          path: llmPath,
        });
      }
    }
  }

  if (metadata.blockMap !== undefined && !Array.isArray(metadata.blockMap)) {
    issues.push({
      severity: "error",
      code: "llm.block_map_invalid",
      message: "LLM metadata blockMap must be an array when present.",
      path: llmPath,
    });
  }

  for (const entry of Array.isArray(metadata.blockMap) ? metadata.blockMap : []) {
    if (!entry || typeof entry !== "object") {
      issues.push({
        severity: "error",
        code: "llm.block_map_invalid",
        message: "LLM metadata blockMap entries must be objects.",
        path: llmPath,
      });
      continue;
    }
    if (!blockIds.has(entry.id)) {
      issues.push({
        severity: "error",
        code: "llm.block_map_block_missing",
        message: `blockMap references missing block ID: ${entry.id}`,
        path: llmPath,
      });
      continue;
    }
    if (typeof entry.selector !== "string" || entry.selector.trim() === "") {
      issues.push({
        severity: "error",
        code: "llm.block_map_selector_invalid",
        message: `blockMap entry ${entry.id} must declare a non-empty selector.`,
        path: llmPath,
      });
    }
    if (!isHtmlxLlmBlockKind(entry.kind)) {
      issues.push({
        severity: "error",
        code: "llm.block_map_kind_invalid",
        message: `blockMap entry ${entry.id} has an unsupported kind.`,
        path: llmPath,
      });
    }
    if (typeof entry.editable !== "boolean") {
      issues.push({
        severity: "error",
        code: "llm.block_map_editable_invalid",
        message: `blockMap entry ${entry.id} must declare editable as a boolean.`,
        path: llmPath,
      });
    }
    if (entry.textHash) {
      const actualBlockHash = await textHash(blockMap.get(entry.id)?.text ?? "");
      if (entry.textHash !== actualBlockHash) {
        issues.push({
          severity: "warning",
          code: "llm.block_text_hash_mismatch",
          message: `blockMap entry ${entry.id} textHash does not match current block text.`,
          path: llmPath,
        });
      }
    }
  }

  for (const chunk of metadata.chunks ?? []) {
    for (const blockId of chunk.blockIds ?? []) {
      if (!blockIds.has(blockId)) {
        issues.push({
          severity: "error",
          code: "llm.chunk_block_missing",
          message: `Chunk ${chunk.id} references missing block ID: ${blockId}`,
          path: llmPath,
        });
      }
    }
    if (chunk.textHash) {
      const actualChunkHash = await textHash(
        (chunk.blockIds ?? []).map((blockId) => blockMap.get(blockId)?.text ?? "").join("\n"),
      );
      if (chunk.textHash !== actualChunkHash) {
        issues.push({
          severity: "warning",
          code: "llm.chunk_text_hash_mismatch",
          message: `Chunk ${chunk.id} textHash does not match current chunk text.`,
          path: llmPath,
        });
      }
    }
  }

  if (metadata.editableBoundary) {
    if (metadata.editableBoundary.profile !== profile) {
      issues.push({
        severity: "error",
        code: "llm.editable_boundary_profile_mismatch",
        message: `editableBoundary profile ${metadata.editableBoundary.profile} does not match resolved package profile ${profile}.`,
        path: llmPath,
      });
    }
    for (const blockId of metadata.editableBoundary.editableBlockIds ?? []) {
      if (!blockIds.has(blockId)) {
        issues.push({
          severity: "error",
          code: "llm.editable_boundary_block_missing",
          message: `editableBoundary references missing block ID: ${blockId}`,
          path: llmPath,
        });
      }
    }
    for (const blockId of metadata.editableBoundary.appEditableBlockIds ?? []) {
      if (!blockIds.has(blockId)) {
        issues.push({
          severity: "error",
          code: "llm.editable_boundary_block_missing",
          message: `editableBoundary appEditableBlockIds references missing block ID: ${blockId}`,
          path: llmPath,
        });
      }
    }
  }
}

function validateEditingMetadata(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
  const editingPath = manifest.metadata.editing;
  if (!editingPath || !files.has(editingPath)) {
    return;
  }

  let metadata: HtmlxEditingMetadata;
  try {
    metadata = JSON.parse(decodeText(files.get(editingPath)!)) as HtmlxEditingMetadata;
  } catch {
    issues.push({
      severity: "error",
      code: "editing.invalid_json",
      message: "Editing metadata is not valid JSON.",
      path: editingPath,
    });
    return;
  }

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    issues.push({
      severity: "error",
      code: "editing.schema_invalid",
      message: "Editing metadata must be a JSON object.",
      path: editingPath,
    });
    return;
  }

  if (metadata.schemaVersion !== "0.1.0") {
    issues.push({
      severity: "error",
      code: "editing.schema_version_invalid",
      message: "Editing metadata must use schemaVersion 0.1.0.",
      path: editingPath,
    });
  }
  if (metadata.mode !== "self-editable-document") {
    issues.push({
      severity: "error",
      code: "editing.mode_invalid",
      message: "Editing metadata mode must be self-editable-document.",
      path: editingPath,
    });
  }
  if (metadata.runtime !== "@openwebdoc/runtime") {
    issues.push({
      severity: "error",
      code: "editing.runtime_invalid",
      message: "Editing metadata runtime must be @openwebdoc/runtime.",
      path: editingPath,
    });
  }
  if (
    !metadata.stage ||
    !Number.isFinite(metadata.stage.width) ||
    !Number.isFinite(metadata.stage.height) ||
    metadata.stage.width <= 0 ||
    metadata.stage.height <= 0 ||
    metadata.stage.unit !== "px" ||
    metadata.stage.scaleMode !== "uniform-fit"
  ) {
    issues.push({
      severity: "error",
      code: "editing.stage_invalid",
      message: "Editing metadata stage must declare a positive px uniform-fit stage.",
      path: editingPath,
    });
  }
  if (!Array.isArray(metadata.blocks)) {
    issues.push({
      severity: "error",
      code: "editing.blocks_invalid",
      message: "Editing metadata blocks must be an array.",
      path: editingPath,
    });
  }
  if (
    metadata.constraints?.scripts !== false ||
    metadata.constraints?.remoteResources !== false ||
    metadata.constraints?.coordinates !== "stage-relative" ||
    metadata.constraints?.textScaling !== "stage-uniform"
  ) {
    issues.push({
      severity: "error",
      code: "editing.constraints_invalid",
      message:
        "Editing metadata constraints must keep scripts and remote resources disabled with stage-relative coordinates.",
      path: editingPath,
    });
  }
}

function validatePresentationMetadata(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
  const presentationPath = manifest.metadata.presentation;
  if (!presentationPath || !files.has(presentationPath)) {
    return;
  }

  let metadata: HtmlxPresentationMetadata;
  try {
    metadata = JSON.parse(decodeText(files.get(presentationPath)!)) as HtmlxPresentationMetadata;
  } catch {
    issues.push({
      severity: "error",
      code: "presentation.invalid_json",
      message: "Presentation metadata is not valid JSON.",
      path: presentationPath,
    });
    return;
  }

  const schemaResult = validateHtmlxPresentationMetadataSchema(metadata);
  if (!schemaResult.valid) {
    for (const error of schemaResult.errors) {
      issues.push({
        severity: "error",
        code: "presentation.schema_invalid",
        message: `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
        path: presentationPath,
      });
    }
    return;
  }

  const htmlBytes = files.get(manifest.entry);
  if (!htmlBytes) return;
  const html = decodeText(htmlBytes);
  const deckTags = extractTagsWithAttribute(html, "data-htmlx-profile", "slide-deck");
  if (deckTags.length === 0) {
    issues.push({
      severity: "error",
      code: "presentation.deck_missing",
      message: 'Slide deck packages must declare data-htmlx-profile="slide-deck" on the deck root.',
      path: manifest.entry,
    });
    return;
  }

  const deckTag = deckTags[0]!;
  const stageWidth = Number(getHtmlAttribute(deckTag, "data-htmlx-stage-width"));
  const stageHeight = Number(getHtmlAttribute(deckTag, "data-htmlx-stage-height"));
  if (stageWidth !== metadata.stage.width || stageHeight !== metadata.stage.height) {
    issues.push({
      severity: "error",
      code: "presentation.stage_mismatch",
      message: "Slide deck root stage geometry must match metadata/presentation.json.",
      path: manifest.entry,
    });
  }

  const slideTags = extractTagsWithAttribute(html, "data-htmlx-kind", "slide");
  if (slideTags.length === 0) {
    issues.push({
      severity: "error",
      code: "presentation.slides_missing",
      message: 'Slide deck packages must contain at least one data-htmlx-kind="slide" section.',
      path: manifest.entry,
    });
  }
}

function unzipHtmlx(input: Uint8Array, options: HtmlxOpenOptions): Map<string, Uint8Array> {
  const unzipped = unzipSync(input);
  const files = new Map<string, Uint8Array>();
  const limits = { ...defaultHtmlxLimits, ...options.limits };
  let totalBytes = 0;

  for (const [path, bytes] of Object.entries(unzipped)) {
    totalBytes += bytes.byteLength;
    if (files.size + 1 > limits.maxEntries) {
      throw new Error(`Package exceeds entry limit of ${limits.maxEntries}.`);
    }
    if (bytes.byteLength > limits.maxEntryBytes) {
      throw new Error(`Entry exceeds size limit: ${path}`);
    }
    if (totalBytes > limits.maxTotalUncompressedBytes) {
      throw new Error("Package exceeds total uncompressed size limit.");
    }
    files.set(path, bytes);
  }

  return files;
}

function normalizeFileMap(
  files: Map<string, Uint8Array> | Record<string, Uint8Array | string>,
): Map<string, Uint8Array> {
  if (files instanceof Map) {
    return new Map(files);
  }

  return new Map(
    Object.entries(files).map(([path, value]) => [
      path,
      typeof value === "string" ? encodeText(value) : value,
    ]),
  );
}

export async function createHtmlxLlmMetadata(
  input: HtmlxLlmMetadataInput,
): Promise<HtmlxLlmMetadata> {
  const {
    title,
    html,
    profile = "flow-document",
    summary = title,
    keywords = [title],
    editableBlockIds = [],
    appEditableBlockIds = editableBlockIds,
    externalAgentEditableFiles = [],
    entities = [],
    citations = [],
  } = input;
  const blocks = [...extractHtmlxBlocks(html).values()];
  const blockIds = blocks.map((block) => block.id);
  const editableIds = new Set(editableBlockIds);
  const selectors = Object.fromEntries(
    blockIds.map((blockId) => [blockId, createHtmlxBlockSelector(blockId)]),
  );
  const textByBlock = Object.fromEntries(blocks.map((block) => [block.id, block.text]));
  const documentText = extractVisibleText(html);
  const shouldWriteEditableBoundary =
    editableBlockIds.length > 0 ||
    appEditableBlockIds.length > 0 ||
    externalAgentEditableFiles.length > 0;
  return {
    schemaVersion: "0.1.0",
    profile,
    summary,
    textHash: await textHash(documentText),
    selectors,
    blockMap: await Promise.all(
      blocks.map(async (block) => ({
        id: block.id,
        selector: selectors[block.id],
        kind: block.kind,
        textHash: await textHash(block.text),
        editable: block.editable || editableIds.has(block.id),
      })),
    ),
    readingOrder: blockIds,
    chunks: await Promise.all(
      blockIds.map(async (blockId, index) => ({
        id: `chunk-${index + 1}`,
        blockIds: [blockId],
        selector: selectors[blockId],
        textHash: await textHash(textByBlock[blockId] ?? ""),
        summary: summarizeBlockText(title, textByBlock[blockId], index),
        keywords,
        tokenEstimate: estimateTokenCount(textByBlock[blockId] ?? ""),
        sensitivity: "unknown",
      })),
    ),
    entities,
    citations,
    ...(shouldWriteEditableBoundary
      ? {
          editableBoundary: {
            profile,
            editableBlockIds,
            appEditableBlockIds,
            externalAgentEditableFiles,
            structuralEdits: "external-agent-only" as const,
          },
        }
      : {}),
    assistantHints: {
      visibility: "user-visible",
      intendedUse: ["summarization", "retrieval", "editing"],
      doNotTreatAsSystemInstruction: true,
    },
  };
}

function createHtmlxBlockSelector(blockId: string): string {
  return `[data-htmlx-block-id="${blockId.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

function summarizeBlockText(title: string, text: string | undefined, index: number): string {
  const normalized = text?.replaceAll(/\s+/g, " ").trim() ?? "";
  if (!normalized) return `${title} block ${index + 1}`;
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function estimateTokenCount(text: string): number {
  const words = text.replaceAll(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return Math.max(1, Math.ceil(words.length * 1.35));
}

interface ExtractedHtmlxBlock {
  id: string;
  kind: HtmlxLlmBlockKind;
  text: string;
  editable: boolean;
}

const htmlxLlmBlockKinds = new Set<HtmlxLlmBlockKind>([
  "document",
  "section",
  "slide",
  "heading",
  "paragraph",
  "table",
  "figure",
  "image",
  "shape",
  "list",
  "code",
  "unknown",
]);

function isHtmlxLlmBlockKind(value: unknown): value is HtmlxLlmBlockKind {
  return typeof value === "string" && htmlxLlmBlockKinds.has(value as HtmlxLlmBlockKind);
}

function extractHtmlxBlocks(html: string): Map<string, ExtractedHtmlxBlock> {
  const blocks = new Map<string, ExtractedHtmlxBlock>();
  const tagPattern =
    /<([a-z][a-z0-9-]*)\b([^>]*\bdata-htmlx-block-id\s*=\s*["'][^"']+["'][^>]*)>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const openingTag = match[0];
    const id = getHtmlAttribute(openingTag, "data-htmlx-block-id");
    if (!id || blocks.has(id)) continue;
    const kind = inferBlockKind(tag, openingTag);
    blocks.set(id, {
      id,
      kind,
      text: extractElementText(html, tag, openingTag, match.index ?? 0),
      editable:
        getHtmlAttribute(openingTag, "data-htmlx-editable") !== null ||
        getHtmlAttribute(openingTag, "contenteditable") === "true",
    });
  }
  return blocks;
}

function inferBlockKind(tag: string, openingTag: string): HtmlxLlmBlockKind {
  const explicitKind = getHtmlAttribute(openingTag, "data-htmlx-kind");
  if (isHtmlxLlmBlockKind(explicitKind)) return explicitKind;
  if (getHtmlAttribute(openingTag, "data-htmlx-editable") === "document") return "document";
  if (tag === "main" || tag === "section" || tag === "article") return "section";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "p" || tag === "blockquote") return "paragraph";
  if (tag === "table") return "table";
  if (tag === "figure") return "figure";
  if (tag === "img") return "image";
  if (tag === "ul" || tag === "ol" || tag === "li") return "list";
  if (tag === "pre" || tag === "code") return "code";
  return "unknown";
}

function extractElementText(
  html: string,
  tag: string,
  openingTag: string,
  startIndex: number,
): string {
  if (tag === "img") {
    return getHtmlAttribute(openingTag, "alt") ?? "";
  }
  const closePattern = new RegExp(`</${tag}\\s*>`, "i");
  const afterOpening = startIndex + openingTag.length;
  const closeMatch = closePattern.exec(html.slice(afterOpening));
  const rawContent = closeMatch ? html.slice(afterOpening, afterOpening + closeMatch.index) : "";
  return extractVisibleText(rawContent);
}

function extractVisibleText(html: string): string {
  return html
    .replaceAll(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&nbsp;/g, " ")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&#39;/g, "'")
    .replaceAll(/\s+/g, " ")
    .trim();
}

async function textHash(value: string): Promise<string> {
  return sha256Integrity(encodeText(value.replaceAll(/\s+/g, " ").trim()));
}

function hasEditingStageMetadata(
  manifest: HtmlxManifest,
  files?: Map<string, Uint8Array>,
): boolean {
  const editingPath = manifest.metadata.editing;
  if (!editingPath || !files?.has(editingPath)) return false;
  try {
    const metadata = JSON.parse(
      decodeText(files.get(editingPath)!),
    ) as Partial<HtmlxEditingMetadata>;
    return (
      !!metadata.stage &&
      Number.isFinite(metadata.stage.width) &&
      Number.isFinite(metadata.stage.height)
    );
  } catch {
    return false;
  }
}

function hasSelfEditableStageEntry(
  manifest: HtmlxManifest,
  files?: Map<string, Uint8Array>,
): boolean {
  const htmlBytes = files?.get(manifest.entry);
  return htmlBytes ? hasSelfEditableStage(decodeText(htmlBytes)) : false;
}

function hasSelfEditableStage(html: string): boolean {
  return extractTagsWithAttribute(html, "data-htmlx-editable", "document").length > 0;
}

function extractTagsWithAttribute(html: string, attribute: string, value: string): string[] {
  const tags: string[] = [];
  const tagPattern = /<([a-z][a-z0-9-]*)\b[^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0];
    const actual = getHtmlAttribute(tag, attribute);
    if (actual === value) {
      tags.push(tag);
    }
  }
  return tags;
}

function validateNumericAttributes(
  tag: string,
  attributes: string[],
  code: string,
  message: string,
  path: string,
  issues: HtmlxValidationIssue[],
): void {
  const missing = attributes.filter((attribute) => {
    const value = getHtmlAttribute(tag, attribute);
    return (
      value === null ||
      value.trim() === "" ||
      Number.isNaN(Number(value)) ||
      !Number.isFinite(Number(value))
    );
  });
  if (missing.length > 0) {
    issues.push({
      severity: "error",
      code,
      message: `${message} Missing or invalid: ${missing.join(", ")}.`,
      path,
    });
  }
}

function getHtmlAttribute(tag: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(attribute)}\\s*=\\s*["']([^"']*)["']`, "i");
  return pattern.exec(tag)?.[1] ?? null;
}

function ensureStandaloneHtmlEntry(html: string, stylesheetPath: string, title: string): string {
  if (hasStylesheetLink(html, stylesheetPath)) return html;
  const link = `<link rel="stylesheet" href="${escapeHtmlAttribute(stylesheetPath)}">`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${link}\n  </head>`);
  }
  const head = `<head>\n    <meta charset="utf-8">\n    <title>${escapeHtmlAttribute(title)}</title>\n    ${link}\n  </head>`;
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1>\n  ${head}`);
  }
  return `<!doctype html>\n<html>\n  ${head}\n  <body>\n    ${html}\n  </body>\n</html>`;
}

function hasStylesheetLink(html: string, stylesheetPath: string): boolean {
  const stylesheetPattern = new RegExp(
    `<link\\b(?=[^>]*\\brel=["'][^"']*stylesheet[^"']*["'])(?=[^>]*\\bhref=["']${escapeRegExp(
      stylesheetPath,
    )}["'])[^>]*>`,
    "i",
  );
  return stylesheetPattern.test(html);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractHtmlResourceRefs(html: string): string[] {
  return [...html.matchAll(/\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((ref) => {
      const lowerRef = ref.toLowerCase();
      return (
        !lowerRef.startsWith("http://") &&
        !lowerRef.startsWith("https://") &&
        !lowerRef.startsWith("mailto:") &&
        !lowerRef.startsWith("javascript:") &&
        !lowerRef.startsWith("file:") &&
        !lowerRef.startsWith("blob:") &&
        !lowerRef.startsWith("data:") &&
        !lowerRef.startsWith("#")
      );
    });
}

function rewriteHtmlResourceAttributes(
  html: string,
  resolveResource: (packagePath: string) => string | null,
): string {
  return html.replace(
    /\s(src|href)\s*=\s*(["'])([^"']+)\2/gi,
    (fullMatch: string, attributeName: string, quote: string, ref: string) => {
      const resolved = resolveResource(ref);
      if (!resolved) {
        return fullMatch;
      }
      const originalAttributeName = `data-htmlx-original-${attributeName.toLowerCase()}`;
      return ` ${attributeName}=${quote}${resolved}${quote} ${originalAttributeName}=${quote}${escapeHtmlAttribute(ref)}${quote}`;
    },
  );
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeStyleText(value: string): string {
  return value.replaceAll("</style", "<\\/style");
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const defaultDocumentCss = `*,
*::before,
*::after {
  box-sizing: border-box;
}

:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}

body {
  margin: 0;
  color: #172033;
  background: #ffffff;
}

main {
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 24px;
}
`;
