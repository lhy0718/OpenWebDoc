# OpenWebDoc

- [한국어](docs/i18n/README.ko.md)
- [日本語](docs/i18n/README.ja.md)
- [简体中文](docs/i18n/README.zh-Hans.md)
- [Español](docs/i18n/README.es.md)
- [Français](docs/i18n/README.fr.md)
- [Deutsch](docs/i18n/README.de.md)
- [Português do Brasil](docs/i18n/README.pt-BR.md)
- [Tiếng Việt](docs/i18n/README.vi.md)
- [Bahasa Indonesia](docs/i18n/README.id.md)
- [हिन्दी](docs/i18n/README.hi.md)

OpenWebDoc is a TypeScript monorepo for the HTMLX Document Package format. HTMLX packages are `.htmlx` ZIP files built around browser-readable HTML, local assets, explicit manifests, security validation, and LLM-native metadata.

## Naming

| Concept     | Name                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

The npm package name `htmlx` is not used. Only the CLI binary is named `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: `.htmlx` read/write/validate/pack/unpack APIs and package-local asset resolution
- `packages/cli`: Node.js CLI that exposes the `htmlx` command
- `packages/ui`: shared React UI for OpenWebDoc apps
- `apps/viewer`: Vite React viewer for local `.htmlx` packages
- `apps/editor`: Vite React agent-editable editor and exporter
- `examples`: example package directories and generated `.htmlx` files
- `docs`: format, security, metadata, and CLI guides

## Commands

```sh
pnpm install
pnpm guard:repo
pnpm build
pnpm test
pnpm lint
pnpm smoke:e2e
pnpm exec htmlx validate examples/basic.htmlx
```

## HTMLX CLI Usage

The CLI command is `htmlx`. The npm package that provides it is `@openwebdoc/cli`; OpenWebDoc does not publish or use an unscoped npm package named `htmlx`.

During workspace development, run the CLI through pnpm:

```sh
pnpm exec htmlx <command>
```

After installing `@openwebdoc/cli` as a package, use the binary directly:

```sh
htmlx <command>
```

### Create

Create a minimal valid `.htmlx` package.

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

Validate a package before opening, unpacking, or sharing it.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm exec htmlx validate examples/basic.htmlx --json
```

Validation succeeds with exit code `0`. Invalid packages return a non-zero exit code and include issue codes such as `html.script`, `html.remote_resource`, `html.local_resource_missing`, or `llm.system_instruction_guard`.

### Inspect

Inspect a package manifest and entry list without unpacking it to the filesystem.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Use `inspect` when an external agent needs a quick package summary before deciding whether to unpack the document.

### Pack

Pack a directory containing `manifest.json` into a `.htmlx` file.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

The directory must validate before it is written as a package. Local resources referenced from HTML must exist inside the package and be declared in `manifest.resources`.

### Unpack

Unpack a valid `.htmlx` file into a directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` refuses invalid packages and refuses to overwrite existing output files.

### Agent Workspace

Create a file-based editing workspace for Codex, Claude Code, or another external coding agent.

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

The generated workspace contains:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: editing rules for coding agents
- `agent-edit-request.json`: document context, editable files, allowed operations, and validation commands
- `agent-edit-proposal.json`: a draft record for planned or completed changes

Suggested external-agent flow:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
htmlx validate-workspace . --json
# Edit files under package/
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

External agents should edit package-local HTML, CSS, JSON metadata, and declared assets. They should not add scripts, inline event handlers, remote resources, `file:` URLs, `javascript:` URLs, or hidden instructions in `metadata/llm.json`.

### Validate Agent Workspace

Validate an unpacked agent workspace before returning an edit.

```sh
htmlx validate-workspace ./basic-agent
htmlx validate-workspace ./basic-agent --json
```

The command checks `agent-edit-request.json`, `agent-edit-proposal.json`, and the unpacked `package/` directory.

## MVP Boundaries

MVP blocks arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references, and prompt-injection-style LLM metadata misuse. The viewer renders sanitized HTML and rewrites manifest-declared local resources to browser object URLs. It lazy-loads `@openwebdoc/core` when a user opens a file, keeping the initial viewer bundle focused on shell UI. The editor and CLI prioritize agent-editable packets so external coding agents can modify unpacked HTML/CSS/JSON files and return validated `.htmlx` packages. It does not include DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, or browser-side model API keys.

## Docs

- [Format overview](docs/format-overview.md)
- [Manifest spec](docs/manifest-spec.md)
- [Security model](docs/security-model.md)
- [LLM metadata guide](docs/llm-metadata-guide.md)
- [Agent-editable HTMLX](docs/agent-editing.md)
- [CLI usage](docs/cli-usage.md)
- [Release checklist](docs/release-checklist.md)
