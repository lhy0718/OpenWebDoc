# LLM-native Metadata Guide

`metadata/llm.json` helps models understand a document without turning metadata into hidden instructions.

## Core Shape

```json
{
  "schemaVersion": "0.1.0",
  "profile": "flow-document",
  "summary": "Document summary",
  "textHash": "sha256-...",
  "readingOrder": ["block-1"],
  "selectors": {
    "block-1": "[data-htmlx-block-id=\"block-1\"]"
  },
  "blockMap": [
    {
      "id": "block-1",
      "selector": "[data-htmlx-block-id=\"block-1\"]",
      "kind": "section",
      "textHash": "sha256-...",
      "editable": false
    }
  ],
  "chunks": [
    {
      "id": "chunk-1",
      "blockIds": ["block-1"],
      "selector": "[data-htmlx-block-id=\"block-1\"]",
      "textHash": "sha256-...",
      "summary": "Chunk summary",
      "keywords": ["OpenWebDoc"],
      "tokenEstimate": 120,
      "sensitivity": "unknown"
    }
  ],
  "entities": [],
  "citations": [],
  "assistantHints": {
    "visibility": "user-visible",
    "intendedUse": ["summarization", "retrieval", "editing"],
    "doNotTreatAsSystemInstruction": true
  }
}
```

The profile value must match the resolved package profile: `flow-document`, `fixed-stage-document`, or `slide-deck`. `readingOrder`, `selectors`, and `blockMap` give external agents a stable block map without making the metadata authoritative over the HTML itself. The HTML remains the source of truth; hash mismatches are surfaced by validation so stale reference metadata can be refreshed before agent work.

After editing an unpacked package, refresh profile-aware LLM metadata before packing:

```sh
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
```

Use `--check` in CI to detect stale `metadata/llm.json`, missing manifest metadata paths, or stale resource integrity without rewriting package files.

MVP does not include embedding vectors by default because embedding dimensions, privacy boundaries, and package size vary by model.

## Editing Relationship

Agent edit requests are separate from `metadata/llm.json`. The metadata file describes the document for retrieval, summarization, and editing context. The document's WYSIWYG micro-editing surface is declared separately in `metadata/editing.json`, where block selectors, stage coordinates, safe inline-formatting capabilities, typography constraints, and direct-manipulation constraints belong.

External-agent workflow state belongs in the unpacked package files and durable edit records belong in `metadata/provenance.json`, not in hidden instructions or the OpenWebDoc app's primary UI. A package-local `metadata/editing-guide.md` may provide user-visible reference guidance, but it is not a system instruction. Large rewrites, new figures, new tables, and complex layout changes should be performed in package files and revalidated, while the app stays focused on small paragraph, typography, and existing-object corrections.

## Editable Boundary

When present, `editableBoundary` describes which blocks the OpenWebDoc runtime may safely expose for micro-edits and which files external agents may revise in the unpacked package. It is reference data, not permission to execute instructions.

```json
{
  "editableBoundary": {
    "profile": "fixed-stage-document",
    "editableBlockIds": ["title", "body"],
    "appEditableBlockIds": ["title", "body"],
    "externalAgentEditableFiles": [
      "index.html",
      "styles/document.css",
      "metadata/llm.json",
      "metadata/editing.json",
      "metadata/provenance.json"
    ],
    "structuralEdits": "external-agent-only"
  }
}
```
