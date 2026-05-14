# OpenWebDoc

OpenWebDoc est un monorepo TypeScript pour le format HTMLX Document Package. Les paquets HTMLX sont des fichiers `.htmlx` basés sur ZIP qui contiennent du HTML lisible par navigateur, des assets locaux, des manifests explicites, une validation de sécurité et des metadata LLM-native.

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
- `packages/ui`: React UI partagée pour les apps OpenWebDoc
- `apps/viewer`: Vite React viewer pour les packages `.htmlx` locaux
- `apps/editor`: editor et exporter agent-editable
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
pnpm exec htmlx validate examples/basic.htmlx
```

## Utilisation de la CLI HTMLX

La commande CLI est `htmlx`. Le paquet npm qui la fournit est `@openwebdoc/cli`; OpenWebDoc ne publie ni n’utilise de paquet npm non scopé nommé `htmlx`.

Pendant le développement du workspace, exécutez la CLI via pnpm.

```sh
pnpm exec htmlx <command>
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
- `content/document.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

Valide un paquet avant de l’ouvrir, de le décompresser ou de le partager.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm exec htmlx validate examples/basic.htmlx --json
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

### Agent Workspace

Crée un file-based editing workspace pour Codex, Claude Code ou un autre coding agent externe.

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

Le workspace généré contient:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: editing rules pour coding agents
- `agent-edit-request.json`: document context, editable files, allowed operations, validation commands
- `agent-edit-proposal.json`: draft record pour planned/completed changes

Flux suggéré pour un agent externe:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# Edit files under package/
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Les agents externes doivent modifier le HTML, le CSS, les JSON metadata et les declared assets package-local. Ils ne doivent pas ajouter de scripts, inline event handlers, remote resources, URLs `file:`, URLs `javascript:` ni hidden instructions dans `metadata/llm.json`.

## Limites MVP

Le MVP bloque arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references et prompt-injection-style LLM metadata misuse. Le viewer rend du HTML sanitized et réécrit les manifest-declared local resources en browser object URLs. Il lazy-load `@openwebdoc/core` quand l’utilisateur ouvre un fichier, afin de garder l’initial viewer bundle centré sur la shell UI. L’editor et la CLI privilégient les agent-editable packets pour permettre aux coding agents externes de modifier les unpacked HTML/CSS/JSON files et de retourner des validated `.htmlx` packages. Le MVP n’inclut pas DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration ni browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Release checklist](../release-checklist.md)
