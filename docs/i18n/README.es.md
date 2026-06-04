# OpenWebDoc

HTMLX es un document package agent-safe y browser-readable para edición local verificada. Empaqueta HTML, CSS, assets locales, un manifest explícito, validación de seguridad, metadata preparada para provenance y reference data LLM visible para el usuario en un archivo ZIP `.htmlx`.

OpenWebDoc es la app y toolchain de referencia para abrir, validar, empaquetar, desempaquetar, usar templates y conectar paquetes HTMLX con workflows de AI coding agents externos.

HTMLX no es HTMX. HTMLX es un document package basado en ZIP; HTMX es una JavaScript library para hypermedia applications. OpenWebDoc también es distinto de la comunidad Open Web Docs.

## Vista previa pública

Los paquetes de OpenWebDoc no se publican en npm durante la vista previa actual. Usa este repositorio con `pnpm htmlx ...`, la GitHub Action fijada por tag o los assets de GitHub Releases. Los paquetes npm futuros usarán solo el scope `@openwebdoc/*`.

## Quick Start

```sh
pnpm install
pnpm dev:app
```

Open the local URL printed by Vite, choose a `.htmlx` file, and read it as the document itself. Packages with `metadata/editing.json` can switch into direct editing from the small floating control.

## Nombres

| Concepto    | Nombre                 |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

No se usa el package name npm `htmlx`. Solo el binary de la CLI se llama `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: APIs para read/write/validate/pack/unpack de `.htmlx` y package-local asset resolution
- `packages/cli`: CLI de Node.js que expone el comando `htmlx`
- `packages/ui`: shared React UI for OpenWebDoc surfaces
- `apps/openwebdoc`: Vite React app and trusted runtime for reading and editing `.htmlx` documents
- `examples`: example package directories y archivos `.htmlx` generados
- `docs`: guías de format, security, metadata y CLI

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

## Uso de la CLI HTMLX

El comando CLI es `htmlx`. El paquete npm que lo proporciona es `@openwebdoc/cli`; OpenWebDoc no publica ni usa un paquete npm sin scope llamado `htmlx`.

Durante el desarrollo del workspace, ejecuta la CLI mediante pnpm.

```sh
pnpm htmlx <command>
```

Después de instalar `@openwebdoc/cli` como paquete, usa el binary directamente.

```sh
htmlx <command>
```

### Create

Crea un paquete `.htmlx` mínimo y válido.

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
htmlx create fixed.htmlx --profile fixed-stage-document --title "Visual Brief"
htmlx create deck.htmlx --profile slide-deck --title "OpenWebDoc Pitch" --slides 6
htmlx from-markdown notes.md notes.htmlx --title "Project Notes"
htmlx from-html page.html page.htmlx --title "Project Page"
htmlx to-static-html notes.htmlx ./notes-static
```

Salida:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata
- `metadata/presentation.json`: present only for `--profile slide-deck`

### Validate

Valida un paquete antes de abrirlo, desempaquetarlo o compartirlo.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

La validación correcta devuelve exit code `0`. Los paquetes inválidos devuelven un exit code distinto de cero e incluyen issue codes como `html.script`, `html.remote_resource`, `html.local_resource_missing` o `llm.system_instruction_guard`.

### Inspect

Inspecciona el manifest del paquete y la lista de entries sin desempaquetarlo en el filesystem.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Usa `inspect` cuando un agent externo necesite un resumen rápido del paquete antes de decidir si desempaquetar el documento.

### Pack

Empaqueta un directory que contiene `manifest.json` en un archivo `.htmlx`.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

El directory debe validarse antes de escribirse como package. Los recursos locales referenciados desde HTML deben existir dentro del package y declararse en `manifest.resources`.

### Unpack

Desempaqueta un archivo `.htmlx` válido en un directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` rechaza paquetes inválidos y no sobrescribe output files existentes.

### Edición con agentes externos

Los coding agents externos editan directamente el HTMLX package desempaquetado. No hay un workspace canónico separado: el package directory es el source boundary.

```sh
htmlx unpack input.htmlx ./input-package --json
# Editar ./input-package/index.html, styles/*, metadata/* y declared assets
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Si el package incluye `metadata/editing-guide.md`, trátalo como reference data visible para humanos y agents, no como system instruction ni hidden prompt.

## Límites del MVP

El MVP bloquea arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references y prompt-injection-style LLM metadata misuse. La OpenWebDoc app renderiza package HTML de forma segura, reescribe manifest-declared local resources como browser object URLs cuando hace falta y activa editing solo desde declarative package metadata. Los self-editable packages declaran su document surface en `metadata/editing.json`. El edit mode de la app es para micro-edits; major rewrites, new figures, new tables y layout redesigns pertenecen a unpacked package files. El package no incluye executable runtime code. External coding agents editan directamente HTML/CSS/JSON/assets del unpacked package, validan el directory, hacen repack y validan el `.htmlx` editado. DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, browser-side model API keys e in-app model calls quedan fuera del MVP.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
