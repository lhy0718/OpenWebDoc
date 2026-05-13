import {
  HTMLX_MANIFEST_PATH,
  HTMLX_MIME_TYPE,
  HTMLX_MIMETYPE_PATH,
  type HtmlxLlmMetadata,
  type HtmlxManifest,
  createDefaultManifest,
  validateHtmlxManifestSchema,
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

  const llm = input.llm ?? createDefaultLlmMetadata(input.title, input.html);
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "OpenWebDoc",
    createdAt: now,
    sources: [],
  };

  const files = new Map<string, Uint8Array>([
    [manifest.entry, encodeText(input.html)],
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
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "article",
      "aside",
      "figure",
      "figcaption",
      "img",
      "main",
      "section",
      "time",
    ]),
    allowedAttributes: {
      "*": ["class", "id", "title", "data-htmlx-block-id", "aria-label"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      section: ["data-htmlx-block-id"],
      article: ["data-htmlx-block-id"],
      div: ["data-htmlx-block-id"],
      p: ["data-htmlx-block-id"],
      h1: ["data-htmlx-block-id"],
      h2: ["data-htmlx-block-id"],
      h3: ["data-htmlx-block-id"],
    },
    allowedSchemes: ["http", "https", "mailto", "blob"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
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

  validateManifestPaths(manifest, files, issues);
  await validateResourceIntegrity(manifest, files, issues);
  validateDocumentSafety(manifest, files, issues);
  validateStylesheetSafety(manifest, files, issues);
  validateLlmMetadata(manifest, files, issues);

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    manifest,
  };
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

function validateLlmMetadata(
  manifest: HtmlxManifest,
  files: Map<string, Uint8Array>,
  issues: HtmlxValidationIssue[],
): void {
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
  const blockIds = extractBlockIds(html);
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

function createDefaultLlmMetadata(title: string, html: string): HtmlxLlmMetadata {
  const blockIds = [...extractBlockIds(html)];
  return {
    schemaVersion: "0.1.0",
    summary: title,
    readingOrder: blockIds,
    chunks: blockIds.map((blockId, index) => ({
      id: `chunk-${index + 1}`,
      blockIds: [blockId],
      selector: `[data-htmlx-block-id="${blockId}"]`,
      summary: `${title} section ${index + 1}`,
      keywords: [title],
      tokenEstimate: 120,
      sensitivity: "unknown",
    })),
    entities: [],
    citations: [],
    assistantHints: {
      visibility: "user-visible",
      intendedUse: ["summarization", "retrieval", "editing"],
      doNotTreatAsSystemInstruction: true,
    },
  };
}

function extractBlockIds(html: string): Set<string> {
  return new Set(
    [...html.matchAll(/data-htmlx-block-id\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]),
  );
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
      return ` ${attributeName}=${quote}${resolved}${quote}`;
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

const defaultDocumentCss = `:root {
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
