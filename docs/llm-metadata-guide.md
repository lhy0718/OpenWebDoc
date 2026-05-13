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

Agent edit packets are separate from `metadata/llm.json`. The metadata file describes the document for retrieval, summarization, and editing context. Edit requests and applied edit history belong in workflow state and `metadata/provenance.json`, not in hidden instructions.
