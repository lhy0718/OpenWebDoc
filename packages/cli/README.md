# @openwebdoc/cli

Command line interface for agent-safe HTMLX Document Package workflows. This package provides the `htmlx` binary for creating, converting, validating, packing, unpacking, exporting, and refreshing package metadata.

## Public Preview Availability

OpenWebDoc does not publish npm packages during the public preview phase. Use the
repository checkout with `pnpm htmlx ...`, the tag-pinned GitHub Action, or the
GitHub release tarballs for inspection. The future published package will remain
scoped as `@openwebdoc/cli`; only the binary name is `htmlx`.

## Usage

```sh
htmlx create document.htmlx --title "My Document"
htmlx create fixed.htmlx --profile fixed-stage-document --title "Visual Brief"
htmlx create deck.htmlx --profile slide-deck --title "OpenWebDoc Pitch" --slides 6
htmlx from-markdown notes.md notes.htmlx --title "Project Notes"
htmlx from-html page.html page.htmlx --title "Project Page"
htmlx to-static-html notes.htmlx ./notes-static
htmlx validate document.htmlx
htmlx inspect document.htmlx --json
htmlx unpack document.htmlx ./document-package
htmlx refresh-metadata ./document-package --json
htmlx refresh-metadata ./document-package --check --json
htmlx validate ./document-package --json
```

For external coding agents, unpack the package, edit package-local files directly, refresh `metadata/llm.json`, run the metadata freshness check, validate the directory, pack it, and validate the edited `.htmlx`. The `--check` option fails without rewriting files when `metadata/llm.json`, `manifest.metadata.llm`, or the manifest resource integrity is stale.

`htmlx from-markdown` is the first lightweight entry converter. It produces a `flow-document` package from safe Markdown blocks and keeps external links as visible text rather than remote package resources.

`htmlx from-html` converts a safe standalone HTML file into a `flow-document` package and rejects scripts, event handlers, forms, iframes, remote resources, `file:` resources, `data:` resources, CSS resource imports, and body-local asset references.

`htmlx to-static-html` exports a validated package into an ordinary static HTML directory. It protects existing files by default; use `--overwrite` only when replacing a previous export.

The npm package name is scoped as `@openwebdoc/cli`; only the command name is `htmlx`.
