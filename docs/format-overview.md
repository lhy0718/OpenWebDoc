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
index.html
styles/document.css
assets/
metadata/llm.json
metadata/editing.json
metadata/provenance.json
previews/thumbnail.png
```

Only `mimetype`, `manifest.json`, and the manifest `entry` are required for MVP packages.

## Standalone Entry Rule

The canonical document entry is the root `index.html`. A valid OpenWebDoc package should be useful
in two modes:

- packed `.htmlx`: opened through OpenWebDoc viewer/editor/CLI validation
- unpacked package directory: opened directly by double-clicking `index.html`

The second mode is a design constraint, not an optional preview. `index.html` should include a
relative stylesheet link such as `<link rel="stylesheet" href="styles/document.css">`, and every
resource it references must stay package-local and be listed in `manifest.resources`. A stock browser
does not render HTML from inside a compressed ZIP file by itself; `.htmlx` viewers provide that
packed-file runtime.

## Resource Resolution

Document-local `src` and `href` references must point to files inside the package and must be declared in `manifest.resources`. The core validator rejects missing local references, and the viewer rewrites declared local resources to temporary object URLs before rendering sanitized HTML.

Remote resources are outside the MVP security model and are rejected by validation.

## Self-editable Document Stage

Editor-generated HTMLX documents use a fixed logical stage that scales to the browser width. The current rich MVP example uses a `980 x 9000` stage so the document can behave like a long browser-native proposal page rather than a short card. Text, images, semantic HTML tables, grouped figures, roadmap cards, funnel blocks, and simple shapes are positioned in stage-relative coordinates and exported as script-free HTML with `data-htmlx-*` attributes. Text font sizes and document border insets use the same stage-relative scale as images and figures, so the composition remains visually stable as the browser width changes.

Self-editable HTMLX documents follow a proportional layout contract:

- the document entry is root `index.html`
- one stage element declares `data-htmlx-editable="document"`, `data-htmlx-stage-width`, and `data-htmlx-stage-height`
- every editable text block declares stage-relative `data-htmlx-x`, `data-htmlx-y`, `data-htmlx-width`, `data-htmlx-font-size`, and `data-htmlx-line-height`
- every editable object block declares stage-relative `data-htmlx-x`, `data-htmlx-y`, `data-htmlx-width`, and `data-htmlx-height`
- package CSS sets `box-sizing: border-box` so object frames include padding and borders
- package CSS does not use `min()`, `max()`, `clamp()`, or media queries to override the stage coordinate scale

This contract belongs to the package format and validator. Viewer and editor runtimes should not
repair broken ratios with runtime-specific layout overrides.

The editor UX is document-first: the document surface remains the primary screen, and editing controls appear as small overlays for opening, inserting, validating, inspecting, and exporting. Large app-side panels are secondary and should not replace the document as the editing canvas.

`metadata/editing.json` declares the editable surface:

- `mode`: `self-editable-document`
- `stage`: logical width, height, unit, and uniform-fit scaling mode
- `blocks`: editable block IDs, selectors, frame coordinates, and roles
- `constraints`: script-free, local-resource-only editing boundaries

The `.htmlx` package does not execute arbitrary editor code. A trusted editor runtime reads the declarative HTML and editing metadata, activates direct manipulation, and exports a validated package.

See `examples/rich-self-editable/` for a script-free sample that includes editable headings, paragraphs, package-local PNG icons, grouped figures, semantic HTML tables, roadmap blocks, and funnel blocks.
