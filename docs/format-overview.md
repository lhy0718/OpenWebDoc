# HTMLX Document Package Format Overview

HTMLX Document Package is the OpenWebDoc file format. It uses the `.htmlx` extension and stores browser-readable HTML, local assets, a manifest, and metadata in one ZIP package.

## Naming

- Project: OpenWebDoc
- Format: HTMLX Document Package
- Extension: `.htmlx`
- CLI command: `htmlx`
- npm packages: `@openwebdoc/*`

The unscoped npm package name `htmlx` is not used.

## Package Layout

```text
mimetype
manifest.json
content/document.html
styles/document.css
assets/
metadata/llm.json
metadata/provenance.json
previews/thumbnail.png
```

Only `mimetype`, `manifest.json`, and the manifest `entry` are required for MVP packages.

## Resource Resolution

Document-local `src` and `href` references must point to files inside the package and must be declared in `manifest.resources`. The core validator rejects missing local references, and the viewer rewrites declared local resources to temporary object URLs before rendering sanitized HTML.

Remote resources are outside the MVP security model and are rejected by validation.
