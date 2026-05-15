# OpenWebDoc

OpenWebDoc ist ein TypeScript-Monorepo für das HTMLX Document Package Format. HTMLX packages sind ZIP-basierte `.htmlx` Dateien mit browserlesbarem HTML, lokalen assets, expliziten manifests, Sicherheitsvalidierung und LLM-native metadata.

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
- `packages/ui`: gemeinsame React UI für OpenWebDoc apps
- `apps/viewer`: Vite React viewer für lokale `.htmlx` packages
- `apps/editor`: vertrauenswürdige Vite React Runtime für selbst editierbare HTMLX documents
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
pnpm site:build
pnpm pack:packages
pnpm release:check
pnpm htmlx validate examples/basic.htmlx
```

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

Das MVP blockiert arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references und prompt-injection-style LLM metadata misuse. Der viewer rendert sanitized HTML und rewritet manifest-declared local resources zu browser object URLs. Beim Öffnen einer file lädt er `@openwebdoc/core` lazy, damit das initial viewer bundle auf shell UI fokussiert bleibt. Vom Editor erzeugte packages deklarieren eine selbst editierbare document surface in `metadata/editing.json`; text, image und simple shape liegen auf einer festen logical stage und skalieren einheitlich mit der browser width. Der browser editor ist die trusted runtime, die diese editable blocks aktiviert und ein validiertes `.htmlx` exportiert. Externe coding agents sollten den unpacked package flow nutzen, um unpacked HTML/CSS/JSON files zu ändern und validated packages zurückzugeben. Nicht enthalten sind DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration und browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
