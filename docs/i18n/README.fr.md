# OpenWebDoc

OpenWebDoc est un monorepo TypeScript pour le format HTMLX Document Package. Les paquets HTMLX sont des fichiers `.htmlx` basés sur ZIP qui contiennent du HTML lisible par navigateur, des assets locaux, des manifests explicites, une validation de sécurité et des metadata LLM-native.

## Quick Start

```sh
pnpm install
pnpm dev:app
```

Open the local URL printed by Vite, choose a `.htmlx` file, and read it as the document itself. Packages with `metadata/editing.json` can switch into direct editing from the small floating control.

## Nommage

| Concept     | Nom                    |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

Le package name npm `htmlx` n’est pas utilisé. Seul le binary CLI s’appelle `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: APIs read/write/validate/pack/unpack pour `.htmlx` et package-local asset resolution
- `packages/cli`: CLI Node.js exposant la commande `htmlx`
- `packages/ui`: shared React UI for OpenWebDoc surfaces
- `apps/openwebdoc`: Vite React app and trusted runtime for reading and editing `.htmlx` documents
- `examples`: example package directories et fichiers `.htmlx` générés
- `docs`: guides format, security, metadata et CLI

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

## Utilisation de la CLI HTMLX

La commande CLI est `htmlx`. Le paquet npm qui la fournit est `@openwebdoc/cli`; OpenWebDoc ne publie ni n’utilise de paquet npm non scopé nommé `htmlx`.

Pendant le développement du workspace, exécutez la CLI via pnpm.

```sh
pnpm htmlx <command>
```

Après installation de `@openwebdoc/cli`, utilisez directement le binary.

```sh
htmlx <command>
```

### Create

Crée un paquet `.htmlx` minimal et valide.

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
```

Sortie:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

Valide un paquet avant de l’ouvrir, de le décompresser ou de le partager.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

La validation réussie renvoie l’exit code `0`. Les paquets invalides renvoient un code non nul et incluent des issue codes comme `html.script`, `html.remote_resource`, `html.local_resource_missing` ou `llm.system_instruction_guard`.

### Inspect

Inspecte le manifest du paquet et la liste des entries sans le décompresser sur le filesystem.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Utilisez `inspect` quand un agent externe a besoin d’un résumé rapide du paquet avant de décider de décompresser le document.

### Pack

Emballe un directory contenant `manifest.json` en fichier `.htmlx`.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Le directory doit être validé avant d’être écrit comme package. Les ressources locales référencées depuis le HTML doivent exister dans le package et être déclarées dans `manifest.resources`.

### Unpack

Décompresse un fichier `.htmlx` valide dans un directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` refuse les packages invalides et refuse d’écraser les output files existants.

### Edition par agent externe

Les coding agents externes modifient directement le HTMLX package decompresse. Il n'y a pas de workspace canonique separe : le package directory est le source boundary.

```sh
htmlx unpack input.htmlx ./input-package --json
# Modifier ./input-package/index.html, styles/*, metadata/* et declared assets
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Si le package contient `metadata/editing-guide.md`, ce fichier est une reference visible pour humains et agents, pas une system instruction ni un hidden prompt.

## Limites MVP

Le MVP bloque arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references et prompt-injection-style LLM metadata misuse. L’OpenWebDoc app rend le package HTML de manière sûre, réécrit les manifest-declared local resources en browser object URLs si nécessaire et active editing uniquement depuis la declarative package metadata. Les self-editable packages déclarent leur document surface dans `metadata/editing.json`. Le edit mode de l app sert aux micro-edits; major rewrites, new figures, new tables et layout redesigns restent dans les unpacked package files. Le package ne transporte pas d’executable runtime code. Les external coding agents modifient directement HTML/CSS/JSON/assets dans le unpacked package, valident le directory, repackent, puis valident le `.htmlx` modifié. DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, browser-side model API keys et in-app model calls sont hors MVP.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
