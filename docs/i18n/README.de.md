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
- `apps/editor`: agent-editable editor und exporter
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
- `content/document.html`: default HTML entry
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

### Agent Workspace

Erstellt einen file-based editing workspace für Codex, Claude Code oder einen anderen externen coding agent.

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

Der erzeugte workspace enthält:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: editing rules für coding agents
- `agent-edit-request.json`: document context, editable files, allowed operations und validation commands
- `agent-edit-proposal.json`: draft record für planned/completed changes

Empfohlener externer-agent flow:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# Edit files under package/
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Externe agents sollen package-local HTML, CSS, JSON metadata und declared assets bearbeiten. Sie dürfen keine scripts, inline event handlers, remote resources, `file:` URLs, `javascript:` URLs oder hidden instructions in `metadata/llm.json` hinzufügen.

## MVP-Grenzen

Das MVP blockiert arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references und prompt-injection-style LLM metadata misuse. Der viewer rendert sanitized HTML und rewritet manifest-declared local resources zu browser object URLs. Beim Öffnen einer file lädt er `@openwebdoc/core` lazy, damit das initial viewer bundle auf shell UI fokussiert bleibt. Editor und CLI priorisieren agent-editable packets, damit externe coding agents unpacked HTML/CSS/JSON files ändern und validated `.htmlx` packages zurückgeben können. Nicht enthalten sind DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration und browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
