# HTMLX CLI Usage

The CLI binary is named `htmlx` and is provided by `@openwebdoc/cli`.

OpenWebDoc does not publish npm packages during the public preview phase. The
examples below assume a repository checkout using `pnpm htmlx ...`, a
project-specific local wrapper, or a future published `@openwebdoc/cli`
installation. External repositories can adopt validation first through the
tag-pinned GitHub Action without installing an npm package.

```sh
htmlx create document.htmlx --title "My Document"
htmlx create fixed.htmlx --profile fixed-stage-document --title "Visual Brief"
htmlx create deck.htmlx --profile slide-deck --title "OpenWebDoc Pitch" --slides 6
htmlx from-markdown notes.md notes.htmlx --title "Project Notes"
htmlx from-html page.html page.htmlx --title "Project Page"
htmlx to-static-html notes.htmlx ./notes-static
htmlx validate document.htmlx
htmlx inspect document.htmlx --json
htmlx pack examples/basic examples/basic.htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx refresh-metadata ./basic-htmlx --json
htmlx refresh-metadata ./basic-htmlx --check --json
htmlx validate ./basic-htmlx --json
```

Validation exits with a non-zero status for invalid packages. `htmlx validate` accepts either a `.htmlx` file or an unpacked package directory. Use `--json` for machine-readable output.

`htmlx create` defaults to `--profile flow-document`. Use `--profile fixed-stage-document` for proportional visual documents and `--profile slide-deck` to create an HTMLX-native 16:9 slide deck with `metadata/presentation.json`. The legacy alias `--profile document` is accepted and normalized to `flow-document`. Slide decks are not `.pptx` import/export; they remain browser-readable HTML, CSS, local assets, and package metadata.

`htmlx from-markdown` converts a local Markdown file into a validated `flow-document` package. The MVP converter supports headings, paragraphs, lists, blockquotes, fenced code blocks, inline code, bold, and italic text. Markdown links are flattened into visible text instead of remote `href` attributes so the generated package remains script-free, remote-resource-free, and valid by default.

`htmlx from-html` converts a safe standalone HTML file into a validated `flow-document` package. It wraps the source body in the standard flow-document shell and assigns `data-htmlx-block-id` attributes to common headings, paragraphs, lists, blockquotes, code blocks, tables, figures, and sections when they are missing. Source files with scripts, inline event handlers, forms, iframes, `javascript:` URLs, remote resources, `file:` resources, `data:` resources, CSS resource imports, or body-local asset references are rejected. Add assets later in an unpacked package until asset import options are introduced.

`htmlx to-static-html` exports a validated `.htmlx` package into an ordinary static HTML directory. By default it writes `index.html` plus non-metadata local resources such as stylesheets, images, and fonts. Use `--include-metadata` when the static directory should also carry `manifest.json` and `metadata/*`. Existing output files are protected unless `--overwrite` is passed.

External coding agents edit unpacked package directories directly:

```sh
htmlx unpack input.htmlx ./input-package --json
# Edit ./input-package/index.html, styles/*, metadata/*, and declared assets.
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

`htmlx refresh-metadata` regenerates `metadata/llm.json` from the current package HTML and metadata. Use it after visible text, block IDs, profile declarations, or edit boundaries change. Use `--check` in CI and pre-release checks to fail without rewriting files when `metadata/llm.json`, `manifest.metadata.llm`, or the manifest resource integrity is stale.

If the package includes `metadata/editing-guide.md`, treat it as document-owned reference data for humans and agents, not as a hidden instruction channel.

During workspace development, run the binary through pnpm:

```sh
pnpm audit:prod
pnpm htmlx validate examples/basic.htmlx
```

Run the conformance fixture suite after building the CLI when checking validator compatibility:

```sh
pnpm build
pnpm conformance:check
```

See [HTMLX Conformance](conformance.md) for fixture coverage and expected issue codes.
