# FAQ

## Is HTMLX the same as HTMX?

No. HTMLX is not HTMX.

HTMLX is a ZIP-based document package for browser-readable, package-local, validated documents. HTMX is a JavaScript library for hypermedia applications.

## Is OpenWebDoc the same as Open Web Docs?

No. OpenWebDoc is the reference implementation and toolchain for the HTMLX Document Package. Open Web Docs is a separate web-platform documentation community.

## Is HTMLX trying to replace PDF or DOCX immediately?

No. The practical starting point is not replacement. HTMLX focuses on verified local editing for browser-readable documents, especially when AI coding agents modify package files.

## Why package HTML instead of just sharing an HTML file?

A single HTML file can be useful, but a document package can declare local assets, metadata, provenance, security constraints, and validation rules. That package boundary lets CI and external agents detect broken resources, unsafe HTML, stale LLM metadata, and undeclared assets.

## Why not put AI calls inside the OpenWebDoc app?

The app is a trusted runtime and micro-editing surface. Large rewrites, new figures, new tables, and structural edits should happen in unpacked package files through external coding agents, then return through validation and packing. This keeps provider API keys, hidden prompts, and browser-side model calls out of the document runtime.

## What is the core workflow?

```sh
htmlx unpack input.htmlx ./input-package --json
# edit package-local HTML, CSS, metadata, and declared assets
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

## What should third-party implementations support first?

Start with validation and opening:

- reject scripts, remote resources, path traversal, and undeclared assets
- parse `manifest.json`
- render package-local HTML and CSS
- expose issue codes compatible with the conformance suite
- keep `metadata/llm.json` as user-visible reference data

See [HTMLX Conformance](conformance.md) for fixture coverage and [Security Brief](security-brief.md) for the short public trust model.
