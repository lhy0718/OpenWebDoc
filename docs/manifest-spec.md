# HTMLX Manifest Spec v0.1

`manifest.json` declares the canonical document entry, styles, resources, metadata, and security policy. For new packages, the default entry is the root `index.html` so an unpacked package can be opened directly in a browser without an OpenWebDoc runtime.

```json
{
  "$schema": "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json",
  "htmlxVersion": "0.1.0",
  "profile": "flow-document",
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
    "presentation": "metadata/presentation.json",
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

`profile` is optional for legacy packages but canonical for newly created packages. Valid values are `flow-document`, `fixed-stage-document`, and `slide-deck`. If it is missing, validation infers `slide-deck` from `metadata.presentation`, `fixed-stage-document` from self-editable stage metadata or stage markup, and `flow-document` otherwise.

`metadata.editing` is optional for minimal packages, but fixed-stage and slide-deck packages may use it to declare the document surface that the OpenWebDoc runtime can activate. `metadata.presentation` is optional and declares an HTMLX-native `slide-deck` profile through `metadata/presentation.json`; it must exist in the package, match `profile: "slide-deck"` when an explicit profile is present, and be declared in `manifest.resources` as JSON metadata. `metadata.editingGuide` may point to a package-local Markdown guide for human and external-agent editing. It must live under `metadata/`, use a `.md` extension, exist in the package, and be declared in `manifest.resources` as `text/markdown` with role `metadata`. It is user-visible reference data, not a system instruction. `htmlxVersion` is the format version, not the npm package version.

## Profile Validation

- `flow-document` is the default reflowing browser document profile and does not require stage geometry.
- `fixed-stage-document` requires a self-editable document stage with `data-htmlx-editable="document"` and proportional geometry.
- `slide-deck` requires `metadata/presentation.json`, a slide deck root, and at least one slide section.

When a package is a `fixed-stage-document`, validation treats the document as a proportional stage document. In that mode:

- `entry` must be `index.html`
- stage width and height must be declared in `data-htmlx-stage-width` and `data-htmlx-stage-height`
- editable text and object blocks must carry numeric `data-htmlx-*` geometry attributes
- stylesheets must set `box-sizing: border-box`
- stylesheets must not use `min()`, `max()`, `clamp()`, or media-query overrides for layout

The OpenWebDoc runtime may activate editing behavior, but it should not fix layout ratios that the
package itself failed to declare.

For validator compatibility fixtures and expected issue codes, see [HTMLX Conformance](conformance.md).
