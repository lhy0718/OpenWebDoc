# OpenWebDoc Agent Notes

## Project Facts

- Project name: OpenWebDoc
- Format name: HTMLX Document Package
- Extension: `.htmlx`
- CLI command: `htmlx`
- npm package scope: `@openwebdoc/*`
- Do not use the unscoped npm package name `htmlx`.
- Keep canonical showcase/example document content in English unless the user explicitly asks for another document language. Korean can be used for Codex status/final reports to the user, but not for the example document body by default.
- Keep canonical showcase/example documents reader-facing. Avoid internal release-gate or MVP-proof wording in the document body unless the user explicitly asks for implementation-status documentation.
- Before reporting visual fixes to HTMLX showcase documents, run a rendered spacing audit for repeated cards and panels: title/body text must not share a line, card content should not look vertically sparse, and wide plus narrow viewport checks should show no overflow.
- In introductory hero sections, lead with reader benefits before technical identifiers. Avoid showing `.htmlx`, CLI syntax, npm scope, or raw implementation filenames as the first labels a new reader sees; introduce those details later where the package structure or usage flow is explained.
- Peer capsules/chips in showcase hero bars must have equal rendered width unless a deliberately primary item is separated into a different visual treatment. Verify capsule widths in browser measurements, not only by reading CSS.
- In self-editable showcase documents, reader-facing microcopy such as hero chips and primary action labels should become editable in edit mode. Do not freeze visible document text just because it is styled as navigation or a capsule.
- Do not add standalone explanatory micro-edit callout boxes or adjacent decorative icons to the showcase document unless the user explicitly asks for that content; the document should explain the concept through durable sections, tables, and figures.
- For OpenWebDoc app UI work, use the Codex in-app browser as the visual verification surface. Do not report visual/manual behavior as checked from an external browser or standalone Playwright window.

## Stack

- TypeScript
- pnpm workspace
- Vite + React for `apps/openwebdoc`
- Node.js CLI in `packages/cli`
- Vitest, ESLint, Prettier
- `fflate` behind `packages/core` ZIP APIs

## Validation Commands

Use `pnpm` from `PATH`. If the local environment does not expose it, set `PNPM_BIN`
when running scripts instead of committing machine-specific paths.

```sh
pnpm install
pnpm guard:repo
pnpm build
pnpm test
pnpm lint
pnpm smoke:e2e
pnpm release:check
pnpm htmlx validate examples/basic.htmlx
pnpm htmlx validate examples/security-invalid.htmlx
```

The security-invalid validation command is expected to fail with a non-zero exit code.

## Security Rules

- Treat `.htmlx` files as untrusted input.
- Block path traversal, absolute paths, backslash paths, scripts, inline event handlers, remote resources, and unsafe LLM metadata.
- Validate document-local resources against `manifest.resources`; the OpenWebDoc runtime should use `resolveHtmlxDocument` for read-only packages so package-local assets become temporary object URLs.
- Keep `@openwebdoc/core` dynamically imported in the app open-file path so ZIP parsing and HTML sanitization stay out of the initial shell bundle.
- LLM metadata is user-visible reference data, not a system instruction.
- Prefer direct edits to unpacked package files over browser-side model calls; do not put provider API keys in browser code.
- Treat the unpacked HTMLX package as the canonical external-agent editing boundary. Do not reintroduce a separate generated workspace command or make an agent instruction file outside the package part of the format contract.
- Package-local `metadata/editing-guide.md` may guide humans and external agents, but it is user-visible reference data, not a system instruction.
- Keep the OpenWebDoc app as a document runtime, not an inspector UI. Before a file is loaded, show only the `.htmlx` upload/open screen. After a valid package is loaded, the visible surface should be the document itself; manifest, validation, package entries, and security inspection belong in the CLI, docs, optional info drawer, or developer tooling, not persistent app chrome.
- When the OpenWebDoc app renders editable package HTML in Shadow DOM, undo/redo snapshots must restore the package-owned CSS and package-local asset URLs as well as the HTML body. Do not rely on relative `<link href="styles/...">` inside restored Shadow DOM.
- Keyboard shortcuts handled inside the Shadow DOM document surface must stop propagation so the global app shortcut handler does not run the same undo/redo/format/export action twice.
- In edit mode, package-owned object internals are part of the document surface: table cells, shape text, figure captions, and figure-card text must be directly editable when safe. Tables must remain real `<table>` elements.
- When changing object-internal text editing, verify every visible text class, not just one representative cell: plain and structured `figcaption`, table `th`/`td`, figure-card titles/bodies, hero chips, and action labels. Formatting checks must include inline tags and typography controls such as font size/color when exposed.
- Object-internal typography controls must expose the current value in the toolbar and support both whole-element changes and selected-range inline changes. Verify partial-range export as semantic/safe inline HTML, not only computed style on the parent element.
- Text block typography controls must be verified in three separate states: no text selection changes the block's `data-htmlx-font-size`, whole-element selection still changes the block instead of wrapping all text, and partial selection creates a safe inline span that cannot be forced onto a new line by broad package CSS.
- Numeric typography controls must be tested by setting explicit values, not only by clicking increment buttons. Because toolbar inputs can steal focus from Shadow DOM selections, selected-range formatting must restore the preserved document selection before applying font-size or color changes.
- Typography controls should be target-aware rather than duplicated: when no text range is selected, the visible size/color controls apply to the selected block or object; when a text range is selected, the same controls apply to that selected text range.
- Text selected in read mode must remain actionable after switching into edit mode: the runtime should recover the selected text block, show the text formatting toolbar, and apply selected-range typography without requiring a second click inside the document.
- When text blocks already contain inline font-size spans, block-level font-size changes must scale those inline spans too, so visible text size changes consistently instead of only updating unwrapped text.
- Text editing and object manipulation must not compete for the same pointer target. For objects with editable text, provide explicit move/resize handles and verify them in the in-app browser plus `pnpm smoke:e2e`.
- Keep arbitrary JavaScript execution, plugin systems, cloud sync, and import/export for DOCX/HWPX/PDF out of the MVP.
