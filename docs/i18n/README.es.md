# OpenWebDoc

OpenWebDoc es un monorepo TypeScript para el formato HTMLX Document Package. Los paquetes HTMLX son archivos `.htmlx` basados en ZIP que contienen HTML legible por el navegador, assets locales, manifests explícitos, validación de seguridad y metadata LLM-native.

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
- `packages/ui`: React UI compartida para las apps de OpenWebDoc
- `apps/viewer`: Vite React viewer para paquetes `.htmlx` locales
- `apps/editor`: runtime confiable Vite React para documentos HTMLX autoeditables
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
```

Salida:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

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
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Si el package incluye `metadata/editing-guide.md`, trátalo como reference data visible para humanos y agents, no como system instruction ni hidden prompt.

## Límites del MVP

El MVP bloquea arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references y prompt-injection-style LLM metadata misuse. El viewer renderiza HTML sanitized y reescribe los manifest-declared local resources como browser object URLs. Carga `@openwebdoc/core` de forma lazy cuando el usuario abre un archivo, manteniendo el initial viewer bundle centrado en la shell UI. Los paquetes generados por el editor declaran una superficie de documento autoeditable en `metadata/editing.json`; text, image y simple shape viven en un logical stage fijo y escalan de forma uniforme con el ancho del browser. El browser editor es el trusted runtime que activa esos editable blocks y exporta un `.htmlx` validado. Los coding agents externos deben usar el unpacked package flow para modificar unpacked HTML/CSS/JSON files y devolver validated packages. No incluye DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration ni browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
