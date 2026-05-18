# OpenWebDoc

OpenWebDoc ist ein TypeScript-Monorepo für das HTMLX Document Package Format. HTMLX packages sind ZIP-basierte `.htmlx` Dateien mit browserlesbarem HTML, lokalen assets, expliziten manifests, Sicherheitsvalidierung und LLM-native metadata.

## Quick Start

```sh
pnpm install
pnpm dev:app
```

Open the local URL printed by Vite, choose a `.htmlx` file, and read it as the document itself. Packages with `metadata/editing.json` can switch into direct editing from the small floating control.

## Benennung

| Konzept     | Name                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

Der npm package name `htmlx` wird nicht verwendet. Nur das CLI binary heißt `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: `.htmlx` read/write/validate/pack/unpack APIs und package-local asset resolution
- `packages/cli`: Node.js CLI mit dem command `htmlx`
- `packages/ui`: shared React UI for OpenWebDoc surfaces
- `apps/openwebdoc`: Vite React app and trusted runtime for reading and editing `.htmlx` documents
- `examples`: example package directories und generierte `.htmlx` files
- `docs`: format, security, metadata und CLI guides

## Commands

```sh
pnpm install
pnpm guard:repo
pnpm build
pnpm test
pnpm lint
pnpm smoke:e2e
pnpm dev:app
pnpm site:build
pnpm pack:packages
pnpm release:check
pnpm htmlx validate examples/basic.htmlx
```

## OpenWebDoc App Usage

The app has one document-first flow.

1. Open the app with `pnpm dev:app`.
2. Choose a local `.htmlx` package.
3. Read the document without sidebars or inspection chrome.
4. If the package declares `metadata/editing.json`, use the floating edit control to edit on the same surface.
5. Export a validated `.htmlx` package and confirm it with `pnpm htmlx validate path/to/file.htmlx`.

`examples/basic.htmlx` opens as a readable package. `examples/openwebdoc-introduction.htmlx` opens in reading mode and can switch into direct editing for paragraph edits, inline text formatting, typography tweaks, grouped figures, semantic tables, and document-owned microcopy.

## HTMLX CLI Verwendung

Der CLI command ist `htmlx`. Das npm package dafür ist `@openwebdoc/cli`; OpenWebDoc veröffentlicht und verwendet kein unscoped npm package namens `htmlx`.

Während der Workspace-Entwicklung wird die CLI über pnpm ausgeführt.

```sh
pnpm htmlx <command>
```

Nach der Installation von `@openwebdoc/cli` als package kann das binary direkt verwendet werden.

```sh
htmlx <command>
```

### Create

Erstellt ein minimales gültiges `.htmlx` package.

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
```

Output:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

Validiert ein package vor dem Öffnen, Unpacken oder Teilen.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

Erfolgreiche Validierung gibt exit code `0` zurück. Ungültige packages geben einen non-zero exit code zurück und enthalten issue codes wie `html.script`, `html.remote_resource`, `html.local_resource_missing` oder `llm.system_instruction_guard`.

### Inspect

Inspectiert package manifest und entry list, ohne es ins filesystem zu unpacken.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Verwende `inspect`, wenn ein externer agent eine schnelle package summary braucht, bevor er entscheidet, ob er das document unpackt.

### Pack

Packt ein directory mit `manifest.json` in eine `.htmlx` file.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Das directory muss validiert werden, bevor es als package geschrieben wird. Lokale resources, die aus HTML referenziert werden, müssen im package vorhanden und in `manifest.resources` deklariert sein.

### Unpack

Unpackt eine gültige `.htmlx` file in ein directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` verweigert invalid packages und überschreibt keine vorhandenen output files.

### Externe Agent-Bearbeitung

Externe coding agents bearbeiten direkt das entpackte HTMLX package. Es gibt keinen separaten kanonischen workspace: Das package directory ist die source boundary.

```sh
htmlx unpack input.htmlx ./input-package --json
# ./input-package/index.html, styles/*, metadata/* und declared assets bearbeiten
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Wenn das package `metadata/editing-guide.md` enthaelt, ist es sichtbare reference data fuer Menschen und agents, keine system instruction und kein hidden prompt.

## MVP-Grenzen

MVP blocks arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references, and prompt-injection-style LLM metadata misuse. The OpenWebDoc app renders package HTML safely, rewrites manifest-declared local resources to browser object URLs when needed, and activates editing only from declarative package metadata. Self-editable packages declare their document surface in `metadata/editing.json`. The app edit mode is for micro-edits; major rewrites, new figures, new tables, and layout redesigns belong in unpacked package files. The package itself does not carry executable runtime code. External coding agents should edit unpacked package HTML/CSS/JSON/assets directly, validate the directory, repack it, and validate the edited `.htmlx`. DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, browser-side model API keys, and in-app model calls are outside the MVP.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
