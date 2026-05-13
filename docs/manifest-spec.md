# HTMLX Manifest Spec v0.1

`manifest.json` is the single entry point for an HTMLX Document Package. It declares the document entry, styles, resources, metadata, and security policy.

```json
{
  "$schema": "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json",
  "htmlxVersion": "0.1.0",
  "packageId": "urn:uuid:00000000-0000-4000-8000-000000000000",
  "title": "Untitled HTMLX Document",
  "language": "en",
  "createdAt": "2026-05-13T00:00:00.000Z",
  "modifiedAt": "2026-05-13T00:00:00.000Z",
  "entry": "content/document.html",
  "styles": ["styles/document.css"],
  "resources": [],
  "metadata": {
    "llm": "metadata/llm.json",
    "provenance": "metadata/provenance.json"
  },
  "security": {
    "allowScripts": false,
    "allowRemoteResources": false,
    "allowedOrigins": [],
    "interactionModel": "declarative"
  }
}
```

`htmlxVersion` is the format version, not the npm package version.
