# Accessibility, Mobile, and Export QA

This note defines the public-alpha QA bar for the OpenWebDoc app. It is intentionally focused on the trusted runtime, not on a full layout-authoring studio.

## Keyboard and Focus

- The empty state must expose only the package-open surface and bundled example links.
- `Command/Ctrl+O` opens the file picker.
- `Command/Ctrl+E` toggles read and edit mode when the package declares `metadata/editing.json`.
- `Command/Ctrl+S` exports the current package.
- `Command/Ctrl+Z` and `Command/Ctrl+Shift+Z` run undo and redo repeatedly without dropping package-owned CSS.
- `Command/Ctrl+B`, `Command/Ctrl+I`, and `Command/Ctrl+U` toggle inline formatting and preserve the selected text range.
- `Delete` and `Backspace` remove selected objects only when text editing is not active.
- `Escape` closes the info drawer or clears the current selection.
- Slide-deck presentation mode supports `ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `Space`, `Home`, `End`, and `Esc`.

## Floating Controls

- Read mode keeps the document as the dominant surface.
- The floating toolbar starts collapsed and exposes only the handle, mode chip, and menu button.
- Expanded actions open below the toolbar header when there is room, or flip direction near viewport edges.
- The object-selection arrow is enabled only in edit mode and clears the current selection when an object is selected.
- Tooltips, disabled states, hover states, and focus rings must remain visible against the document surface.

## Micro-Editing Scope

The runtime supports corrections that a reader naturally performs on the document surface:

- paragraph add, delete, duplicate, and heading/paragraph toggle
- inline bold, italic, underline, text color, and font-size changes
- table caption, header, and cell text edits while preserving real `<table>` markup
- grouped figure movement plus inner-card movement through explicit handles
- existing image replacement
- existing object move, resize, delete, and shape fill color changes

The runtime must not expose new table, new figure, new slide, or large layout-generation tools. Structural redesign belongs in unpacked package files and returns through `htmlx validate`, `htmlx pack`, and `htmlx validate`.

## Mobile

The public-alpha mobile bar is readability and safe file operations:

- 390px-wide viewports must not produce horizontal page overflow.
- The document surface should remain full-width and proportional.
- Floating controls must stay inside the viewport and avoid covering the main reading path.
- Edit mode remains available for small corrections, but complex structural work is still external-agent package editing.

## Export and Round Trip

Export is only successful when validation passes. The app announces successful export through a small status message and blocks export by opening the info drawer when validation issues exist.

Round-trip QA must verify:

- exported `.htmlx` passes `htmlx validate`
- unpacked export still contains semantic table markup
- runtime-only editing attributes are not leaked into `index.html`
- package-local assets reopen through the app
- typography and inline formatting survive export and reopen

## Automated Coverage

`pnpm smoke:e2e` covers the core runtime path:

- empty state
- read-only package opening
- editable introduction package
- slide-deck read and presentation modes
- status-review deck presentation readability
- mobile overflow checks
- table and figure micro-editing
- keyboard shortcuts
- export, CLI validation, unpack, and reopen

`pnpm pages:smoke` covers the deployed GitHub Pages path and can optionally refresh screenshots with:

```sh
OPENWEBDOC_PAGES_SCREENSHOTS=1 pnpm pages:smoke
```
