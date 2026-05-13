import "@openwebdoc/ui/styles.css";
import "./style.css";
import {
  createHtmlx,
  encodeJson,
  encodeText,
  sha256Integrity,
  validateHtmlx,
} from "@openwebdoc/core";
import { createDefaultManifest, type HtmlxLlmMetadata, type HtmlxManifest } from "@openwebdoc/spec";
import { AppShell, ManifestSummary, SecurityNote, ValidationPanel } from "@openwebdoc/ui";
import { Download, ImagePlus, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

interface AssetState {
  name: string;
  mediaType: string;
  bytes: Uint8Array;
  dataUrl: string;
}

interface AgentEditOperation {
  type: "replace_title" | "replace_body";
  target: "document.title" | "block-1";
  value: string;
  rationale: string;
}

interface AgentEditProposal {
  id: string;
  createdAt: string;
  instruction: string;
  mode: "local-draft";
  operations: AgentEditOperation[];
  agentPacket: {
    document: {
      format: "HTMLX Document Package";
      title: string;
      blocks: Array<{ id: string; role: "body"; text: string }>;
    };
    userInstruction: string;
    constraints: string[];
    outputContract: {
      operations: Array<"replace_title" | "replace_body">;
      requiresUserReview: true;
    };
  };
}

interface EditorEvent {
  id: string;
  createdAt: string;
  instruction: string;
  operations: AgentEditOperation[];
}

function EditorApp() {
  const [title, setTitle] = useState("Untitled HTMLX Document");
  const [body, setBody] = useState("Write a pageless, browser-native document here.");
  const [editInstruction, setEditInstruction] = useState("");
  const [editProposal, setEditProposal] = useState<AgentEditProposal | null>(null);
  const [editHistory, setEditHistory] = useState<EditorEvent[]>([]);
  const [asset, setAsset] = useState<AssetState | null>(null);
  const [issues, setIssues] = useState<
    Array<{ severity: "error" | "warning"; code: string; message: string; path?: string }>
  >([]);
  const [lastManifest, setLastManifest] = useState<HtmlxManifest | undefined>();

  const htmlPreview = useMemo(() => buildHtml(title, body, asset?.name), [title, body, asset]);

  async function exportPackage() {
    const { archive, manifest } = await buildPackage(title, body, asset, editHistory);
    const validation = await validateHtmlx(archive);
    setIssues(validation.issues);
    setLastManifest(manifest);
    if (!validation.valid) {
      return;
    }
    const archiveCopy = new Uint8Array(archive.byteLength);
    archiveCopy.set(archive);
    const url = URL.createObjectURL(
      new Blob([archiveCopy.buffer as ArrayBuffer], {
        type: "application/vnd.openwebdoc.htmlx+zip",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(title)}.htmlx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function addAsset(file: File) {
    setAsset({
      name: file.name.replaceAll(/[^\w.-]/g, "-"),
      mediaType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
      dataUrl: await fileToDataUrl(file),
    });
  }

  function prepareAgentEdit() {
    const proposal = buildAgentEditProposal(title, body, editInstruction);
    setEditProposal(proposal);
  }

  function applyLocalDraft() {
    if (!editProposal || editProposal.operations.length === 0) {
      return;
    }
    for (const operation of editProposal.operations) {
      if (operation.type === "replace_title") {
        setTitle(operation.value);
      }
      if (operation.type === "replace_body") {
        setBody(operation.value);
      }
    }
    setEditHistory((history) => [
      ...history,
      {
        id: editProposal.id,
        createdAt: editProposal.createdAt,
        instruction: editProposal.instruction,
        operations: editProposal.operations,
      },
    ]);
    setEditProposal(null);
  }

  return (
    <AppShell
      title="HTMLX Editor"
      subtitle="Prepare agent-editable packets, preserve LLM-visible metadata, and export a validated .htmlx file."
      aside={
        <>
          <ManifestSummary manifest={lastManifest as unknown as Record<string, unknown>} />
          <ValidationPanel issues={issues} />
          <SecurityNote />
        </>
      }
    >
      <section className="editor-grid">
        <form className="editor-form" onSubmit={(event) => event.preventDefault()}>
          <section className="llm-editor">
            <label>
              <span>Agent edit request</span>
              <textarea
                value={editInstruction}
                onChange={(event) => setEditInstruction(event.target.value)}
                placeholder="Title: Launch brief&#10;Body: Summarize the document as three clear paragraphs."
                rows={5}
              />
            </label>
            <div className="editor-actions">
              <button
                type="button"
                className="primary-button"
                onClick={prepareAgentEdit}
                disabled={!editInstruction.trim()}
              >
                <WandSparkles size={18} />
                <span>Prepare agent packet</span>
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={applyLocalDraft}
                disabled={!editProposal || editProposal.operations.length === 0}
              >
                <span>Apply local draft</span>
              </button>
            </div>
            {editProposal ? (
              <section className="proposal-panel" aria-label="Agent edit packet">
                <div>
                  <strong>{editProposal.operations.length} proposed operation(s)</strong>
                  <span>{editProposal.mode}</span>
                </div>
                <pre>{JSON.stringify(editProposal.agentPacket, null, 2)}</pre>
              </section>
            ) : null}
          </section>

          <details className="manual-editor">
            <summary>Manual fallback</summary>
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>Body block</span>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={9} />
            </label>
          </details>

          <div className="editor-actions">
            <label className="secondary-button">
              <ImagePlus size={18} />
              <span>Add asset</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void addAsset(file);
                }}
              />
            </label>
            <button type="button" className="primary-button" onClick={() => void exportPackage()}>
              <Download size={18} />
              <span>Export .htmlx</span>
            </button>
          </div>
        </form>

        <article className="preview-card">
          <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
          {asset ? <img src={asset.dataUrl} alt="" /> : null}
          {editHistory.length ? (
            <footer className="edit-history">{editHistory.length} agent edit(s) applied</footer>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}

async function buildPackage(
  title: string,
  body: string,
  asset: AssetState | null,
  editHistory: EditorEvent[],
) {
  const now = new Date().toISOString();
  const manifest = createDefaultManifest({
    packageId: `urn:uuid:${crypto.randomUUID()}`,
    title,
    language: "en",
    now,
  });
  const html = buildHtml(title, body, asset?.name ? `assets/${asset.name}` : undefined);
  const llm = buildLlmMetadata(title);
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "@openwebdoc/editor",
    createdAt: now,
    sources: [],
    edits: editHistory,
  };

  const files = new Map<string, Uint8Array>([
    [manifest.entry, encodeText(html)],
    ["styles/document.css", encodeText(editorDocumentCss)],
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

  if (asset) {
    const assetPath = `assets/${asset.name}`;
    files.set(assetPath, asset.bytes);
    manifest.resources.push({
      path: assetPath,
      mediaType: asset.mediaType,
      role: "image",
      integrity: await sha256Integrity(asset.bytes),
    });
  }

  return {
    manifest,
    archive: await createHtmlx({ manifest, files }),
  };
}

function buildHtml(title: string, body: string, assetPath?: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n        ");

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
        ${paragraphs || "<p></p>"}
        ${assetPath ? `<figure><img src="${assetPath}" alt=""><figcaption>Local HTMLX asset</figcaption></figure>` : ""}
      </section>
    </main>
  </body>
</html>`;
}

function buildAgentEditProposal(
  title: string,
  body: string,
  instruction: string,
): AgentEditProposal {
  const trimmedInstruction = instruction.trim();
  const parsed = parseInstruction(trimmedInstruction);
  const operations: AgentEditOperation[] = [];

  if (parsed.title && parsed.title !== title) {
    operations.push({
      type: "replace_title",
      target: "document.title",
      value: parsed.title,
      rationale: "Explicit title field in the edit instruction.",
    });
  }

  if (parsed.body && parsed.body !== body) {
    operations.push({
      type: "replace_body",
      target: "block-1",
      value: parsed.body,
      rationale: "Explicit body field in the edit instruction.",
    });
  }

  if (!parsed.title && !parsed.body && trimmedInstruction) {
    operations.push({
      type: "replace_body",
      target: "block-1",
      value: trimmedInstruction,
      rationale: "Instruction captured as the new primary body draft.",
    });
  }

  return {
    id: `edit-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    instruction: trimmedInstruction,
    mode: "local-draft",
    operations,
    agentPacket: {
      document: {
        format: "HTMLX Document Package",
        title,
        blocks: [{ id: "block-1", role: "body", text: body }],
      },
      userInstruction: trimmedInstruction,
      constraints: [
        "Return user-visible document content only.",
        "Do not include hidden instructions, scripts, remote resources, or executable HTML.",
        "Preserve the HTMLX block identity unless the user asks for a structural rewrite.",
      ],
      outputContract: {
        operations: ["replace_title", "replace_body"],
        requiresUserReview: true,
      },
    },
  };
}

function parseInstruction(instruction: string): { title?: string; body?: string } {
  const titleMatch = instruction.match(/(?:^|\n)\s*(?:title|제목)\s*[:：]\s*(.+)/i);
  const bodyMatch = instruction.match(/(?:^|\n)\s*(?:body|본문)\s*[:：]\s*([\s\S]+)/i);
  return {
    title: titleMatch?.[1]?.trim(),
    body: bodyMatch?.[1]?.replace(/(?:^|\n)\s*(?:title|제목)\s*[:：]\s*.+/i, "").trim(),
  };
}

function buildLlmMetadata(title: string): HtmlxLlmMetadata {
  return {
    schemaVersion: "0.1.0",
    summary: title,
    readingOrder: ["block-1"],
    chunks: [
      {
        id: "chunk-1",
        blockIds: ["block-1"],
        selector: '[data-htmlx-block-id="block-1"]',
        summary: title,
        keywords: [title, "OpenWebDoc", "HTMLX"],
        tokenEstimate: 160,
        sensitivity: "unknown",
      },
    ],
    entities: [],
    citations: [],
    assistantHints: {
      visibility: "user-visible",
      intendedUse: ["summarization", "retrieval", "editing"],
      doNotTreatAsSystemInstruction: true,
    },
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "document"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const editorDocumentCss = `body {
  margin: 0;
  color: #172033;
  background: #ffffff;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

main {
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 24px;
}

img {
  max-width: 100%;
  border-radius: 8px;
}
`;

createRoot(document.getElementById("root")!).render(<EditorApp />);
