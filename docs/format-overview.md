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

- packed `.htmlx`: opened through the OpenWebDoc app or CLI validation
- unpacked package directory: opened directly by double-clicking `index.html`

The second mode is a design constraint, not an optional preview. `index.html` should include a
relative stylesheet link such as `<link rel="stylesheet" href="styles/document.css">`, and every
resource it references must stay package-local and be listed in `manifest.resources`. A stock browser
does not render HTML from inside a compressed ZIP file by itself; the OpenWebDoc app provides that
packed-file runtime.

## Resource Resolution

Document-local `src` and `href` references must point to files inside the package and must be declared in `manifest.resources`. The core validator rejects missing local references, and the OpenWebDoc runtime rewrites declared local resources to temporary object URLs before rendering sanitized HTML.

Remote resources are outside the MVP security model and are rejected by validation.

## Self-editable Document Stage

Self-editable HTMLX documents use a fixed logical stage that scales to the browser width. The current rich MVP example uses a `980 x 6500` stage so the document can behave like a long browser-native introduction rather than a short card. Text, existing images, semantic HTML tables, grouped figures, roadmap cards, funnel blocks, and existing simple shapes are positioned in stage-relative coordinates and exported as script-free HTML with `data-htmlx-*` attributes. Inline text formatting uses safe semantic tags such as `<strong>`, `<em>`, and `<u>`. Text font sizes and document border insets use the same stage-relative scale as images and figures, so the composition remains visually stable as the browser width changes.

Self-editable HTMLX documents follow a proportional layout contract:

- the document entry is root `index.html`
- one stage element declares `data-htmlx-editable="document"`, `data-htmlx-stage-width`, and `data-htmlx-stage-height`
- every editable text block declares stage-relative `data-htmlx-x`, `data-htmlx-y`, `data-htmlx-width`, `data-htmlx-font-size`, and `data-htmlx-line-height`
- every editable object block declares stage-relative `data-htmlx-x`, `data-htmlx-y`, `data-htmlx-width`, and `data-htmlx-height`
- package CSS sets `box-sizing: border-box` so object frames include padding and borders
- package CSS does not use `min()`, `max()`, `clamp()`, or media queries to override the stage coordinate scale

This contract belongs to the package format and validator. The OpenWebDoc runtime should not repair
broken ratios with runtime-specific layout overrides.

The app UX is document-first: the document surface remains the primary screen, and editing controls appear as small overlays for opening, paragraph micro-edits, inline formatting, validating, inspecting, and exporting. Large app-side panels are secondary and should not replace the document surface. New figures, new tables, and major layout redesigns are external-agent/package-file work, not internal runtime work.

`metadata/editing.json` declares the editable surface:

- `mode`: `self-editable-document`
- `stage`: logical width, height, unit, and uniform-fit scaling mode
- `blocks`: editable block IDs, selectors, frame coordinates, and roles
- `constraints`: script-free, local-resource-only editing boundaries

The `.htmlx` package does not execute arbitrary runtime code. The trusted OpenWebDoc runtime reads the declarative HTML and editing metadata, activates direct manipulation, and exports a validated package.

See `examples/openwebdoc-introduction/` for a script-free sample that includes editable headings, paragraphs with inline formatting, editable document-owned microcopy, package-local PNG icons, grouped figures, semantic HTML tables, roadmap blocks, and funnel blocks.

## Slide Deck Profile

PPT-style OpenWebDoc documents are HTMLX-native slide decks, not `.pptx` import/export files. A slide deck is still a script-free HTMLX package with `index.html`, package CSS, local assets, and metadata. The package declares the profile through `manifest.metadata.presentation`, which points to `metadata/presentation.json`.

The presentation metadata shape is:

```json
{
  "schemaVersion": "0.1.0",
  "profile": "slide-deck",
  "runtime": "@openwebdoc/runtime",
  "slideSelector": "[data-htmlx-kind='slide']",
  "stage": { "width": 1600, "height": 900, "unit": "px", "scaleMode": "uniform-fit" },
  "navigation": { "loop": false, "advanceOnClick": false }
}
```

The document entry uses a slide deck root and slide sections:

```html
<main
  class="htmlx-slide-deck"
  data-htmlx-profile="slide-deck"
  data-htmlx-stage-width="1600"
  data-htmlx-stage-height="900"
>
  <section
    class="htmlx-slide"
    data-htmlx-kind="slide"
    data-htmlx-slide-id="slide-1"
    data-htmlx-slide-index="1"
  >
    ...
  </section>
</main>
```

In read mode, the OpenWebDoc app shows slides stacked vertically as a normal browser document. In presentation mode, the trusted runtime hides app chrome and shows only the current 16:9 slide centered on a black background. Slide navigation uses `ArrowLeft/Right`, `PageUp/Down`, `Space`, `Home`, `End`, and `Esc`.

Internal app editing remains micro-editing only: correcting text, typography, existing object position/size, and image replacement. New slides, layout redesign, new complex figures, and deck generation belong in unpacked package files through the external-agent workflow.

See `examples/openwebdoc-slide-deck/` for a valid slide deck package.
