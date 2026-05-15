# @openwebdoc/cli

Command line interface for HTMLX Document Package files. This package provides the `htmlx` binary.

## Install

```sh
npm install -g @openwebdoc/cli
```

## Usage

```sh
htmlx create document.htmlx --title "My Document"
htmlx validate document.htmlx
htmlx inspect document.htmlx --json
htmlx unpack document.htmlx ./document-package
htmlx validate ./document-package --json
```

For external coding agents, unpack the package, edit package-local files directly, validate the directory, pack it, and validate the edited `.htmlx`.

The npm package name is scoped as `@openwebdoc/cli`; only the command name is `htmlx`.
