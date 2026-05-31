# @openwebdoc/cli

Command line interface for HTMLX Document Package files. This package provides the `htmlx` binary.

## Install

```sh
npm install -g @openwebdoc/cli
```

## Usage

```sh
htmlx create document.htmlx --title "My Document"
htmlx create fixed.htmlx --profile fixed-stage-document --title "Visual Brief"
htmlx create deck.htmlx --profile slide-deck --title "OpenWebDoc Pitch" --slides 6
htmlx validate document.htmlx
htmlx inspect document.htmlx --json
htmlx unpack document.htmlx ./document-package
htmlx refresh-metadata ./document-package --json
htmlx refresh-metadata ./document-package --check --json
htmlx validate ./document-package --json
```

For external coding agents, unpack the package, edit package-local files directly, refresh `metadata/llm.json`, run the metadata freshness check, validate the directory, pack it, and validate the edited `.htmlx`. The `--check` option fails without rewriting files when `metadata/llm.json`, `manifest.metadata.llm`, or the manifest resource integrity is stale.

The npm package name is scoped as `@openwebdoc/cli`; only the command name is `htmlx`.
