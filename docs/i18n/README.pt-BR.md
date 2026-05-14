# OpenWebDoc

OpenWebDoc é um monorepo TypeScript para o formato HTMLX Document Package. Pacotes HTMLX são arquivos `.htmlx` baseados em ZIP com HTML legível por navegador, assets locais, manifests explícitos, validação de segurança e metadata LLM-native.

## Nomes

| Conceito    | Nome                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

O npm package name `htmlx` não é usado. Apenas o binary da CLI se chama `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: APIs de read/write/validate/pack/unpack para `.htmlx` e package-local asset resolution
- `packages/cli`: CLI Node.js que expõe o comando `htmlx`
- `packages/ui`: React UI compartilhada para apps OpenWebDoc
- `apps/viewer`: Vite React viewer para packages `.htmlx` locais
- `apps/editor`: editor e exporter agent-editable
- `examples`: example package directories e arquivos `.htmlx` gerados
- `docs`: guias de format, security, metadata e CLI

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

## Uso da CLI HTMLX

O comando da CLI é `htmlx`. O pacote npm que o fornece é `@openwebdoc/cli`; OpenWebDoc não publica nem usa um pacote npm sem scope chamado `htmlx`.

Durante o desenvolvimento do workspace, execute a CLI via pnpm.

```sh
pnpm htmlx <command>
```

Depois de instalar `@openwebdoc/cli` como pacote, use o binary diretamente.

```sh
htmlx <command>
```

### Create

Cria um pacote `.htmlx` mínimo e válido.

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
```

Saída:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `content/document.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

Valida um pacote antes de abrir, descompactar ou compartilhar.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

A validação bem-sucedida retorna exit code `0`. Pacotes inválidos retornam non-zero exit code e incluem issue codes como `html.script`, `html.remote_resource`, `html.local_resource_missing` ou `llm.system_instruction_guard`.

### Inspect

Inspeciona o manifest do pacote e a lista de entries sem descompactar no filesystem.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Use `inspect` quando um agent externo precisa de um resumo rápido do pacote antes de decidir se deve descompactar o documento.

### Pack

Empacota um directory contendo `manifest.json` em um arquivo `.htmlx`.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

O directory deve validar antes de ser gravado como package. Recursos locais referenciados pelo HTML devem existir dentro do package e ser declarados em `manifest.resources`.

### Unpack

Descompacta um arquivo `.htmlx` válido em um directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` recusa invalid packages e não sobrescreve output files existentes.

### Agent Workspace

Cria um file-based editing workspace para Codex, Claude Code ou outro coding agent externo.

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

O workspace gerado contém:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: editing rules para coding agents
- `agent-edit-request.json`: document context, editable files, allowed operations e validation commands
- `agent-edit-proposal.json`: draft record para planned/completed changes

Fluxo sugerido para agents externos:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# Edit files under package/
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Agents externos devem editar HTML, CSS, JSON metadata e declared assets package-local. Eles não devem adicionar scripts, inline event handlers, remote resources, URLs `file:`, URLs `javascript:` ou hidden instructions em `metadata/llm.json`.

## Limites do MVP

O MVP bloqueia arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references e prompt-injection-style LLM metadata misuse. O viewer renderiza sanitized HTML e reescreve manifest-declared local resources como browser object URLs. Ele lazy-loads `@openwebdoc/core` quando o usuário abre um arquivo, mantendo o initial viewer bundle focado na shell UI. O editor e a CLI priorizam agent-editable packets para que coding agents externos possam modificar unpacked HTML/CSS/JSON files e retornar validated `.htmlx` packages. Não inclui DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration ou browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
