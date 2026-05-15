# LLM-native Metadata Guide

`metadata/llm.json` helps models understand a document without turning metadata into hidden instructions.

## Core Shape

```json
{
  "schemaVersion": "0.1.0",
  "summary": "Document summary",
  "readingOrder": ["block-1"],
  "chunks": [
    {
      "id": "chunk-1",
      "blockIds": ["block-1"],
      "selector": "[data-htmlx-block-id=\"block-1\"]",
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

MVP does not include embedding vectors by default because embedding dimensions, privacy boundaries, and package size vary by model.

## Editing Relationship

Agent edit requests are separate from `metadata/llm.json`. The metadata file describes the document for retrieval, summarization, and editing context. The document's WYSIWYG surface is declared separately in `metadata/editing.json`, where block selectors, stage coordinates, and direct-manipulation constraints belong.

External-agent workflow state belongs in the unpacked package files and durable edit records belong in `metadata/provenance.json`, not in hidden instructions or the browser editor's primary UI. A package-local `metadata/editing-guide.md` may provide user-visible reference guidance, but it is not a system instruction.
