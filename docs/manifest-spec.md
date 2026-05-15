# HTMLX Manifest Spec v0.1

`manifest.json` declares the canonical document entry, styles, resources, metadata, and security policy. For new packages, the default entry is the root `index.html` so an unpacked package can be opened directly in a browser without an OpenWebDoc runtime.

```json
{
  "$schema": "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json",
  "htmlxVersion": "0.1.0",
  "packageId": "urn:uuid:00000000-0000-4000-8000-000000000000",
  "title": "Untitled HTMLX Document",
  "language": "en",
  "createdAt": "2026-05-13T00:00:00.000Z",
  "modifiedAt": "2026-05-13T00:00:00.000Z",
  "entry": "index.html",
  "styles": ["styles/document.css"],
  "resources": [],
  "metadata": {
    "llm": "metadata/llm.json",
    "editing": "metadata/editing.json",
    "editingGuide": "metadata/editing-guide.md",
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

`metadata.editing` is optional for minimal packages, but editor-generated packages use it to declare the self-editable document surface. `metadata.editingGuide` may point to a package-local Markdown guide for human and external-agent editing. It must live under `metadata/`, use a `.md` extension, exist in the package, and be declared in `manifest.resources` as `text/markdown` with role `metadata`. It is user-visible reference data, not a system instruction. `htmlxVersion` is the format version, not the npm package version.

## Proportional Layout Contract

When a package declares a self-editable document stage with `data-htmlx-editable="document"`,
validation treats the document as a proportional stage document. In that mode:

- `entry` must be `index.html`
- stage width and height must be declared in `data-htmlx-stage-width` and `data-htmlx-stage-height`
- editable text and object blocks must carry numeric `data-htmlx-*` geometry attributes
- stylesheets must set `box-sizing: border-box`
- stylesheets must not use `min()`, `max()`, `clamp()`, or media-query overrides for layout

The viewer and editor may activate editing behavior, but they should not fix layout ratios that the
package itself failed to declare.
