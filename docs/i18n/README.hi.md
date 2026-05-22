# OpenWebDoc

OpenWebDoc HTMLX Document Package format के लिए TypeScript monorepo है। HTMLX packages ZIP-based `.htmlx` files हैं जिनमें browser-readable HTML, local assets, explicit manifests, security validation, और LLM-native metadata शामिल होते हैं।

## Naming

| Concept     | Name                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

npm package name `htmlx` इस्तेमाल नहीं होता। केवल CLI binary का नाम `htmlx` है।

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: `.htmlx` read/write/validate/pack/unpack APIs और package-local asset resolution
- `packages/cli`: Node.js CLI जो `htmlx` command expose करती है
- `packages/ui`: shared React UI for OpenWebDoc surfaces
- `apps/openwebdoc`: Vite React app and trusted runtime for reading and editing `.htmlx` documents
- `examples`: example package directories और generated `.htmlx` files
- `docs`: format, security, metadata, और CLI guides

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

## HTMLX CLI उपयोग

CLI command `htmlx` है। इसे provide करने वाला npm package `@openwebdoc/cli` है; OpenWebDoc unscoped npm package `htmlx` publish या use नहीं करता।

Workspace development के दौरान CLI को pnpm से चलाएँ।

```sh
pnpm htmlx <command>
```

`@openwebdoc/cli` को package के रूप में install करने के बाद binary सीधे चलाएँ।

```sh
htmlx <command>
```

### Create

Minimal valid `.htmlx` package बनाता है।

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

Package खोलने, unpack करने, या share करने से पहले validate करें।

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

Validation सफल होने पर exit code `0` लौटता है। Invalid packages non-zero exit code लौटाते हैं और `html.script`, `html.remote_resource`, `html.local_resource_missing`, या `llm.system_instruction_guard` जैसे issue codes शामिल करते हैं।

### Inspect

Package को filesystem में unpack किए बिना package manifest और entry list inspect करें।

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

जब external agent को document unpack करने से पहले quick package summary चाहिए, तब `inspect` उपयोग करें।

### Pack

`manifest.json` वाली directory को `.htmlx` file में pack करें।

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Directory को package के रूप में लिखने से पहले validate होना चाहिए। HTML से referenced local resources package के अंदर होने चाहिए और `manifest.resources` में declared होने चाहिए।

### Unpack

Valid `.htmlx` file को directory में unpack करें।

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` invalid packages को reject करता है और existing output files को overwrite नहीं करता।

### External agent editing

External coding agents unpacked HTMLX package को सीधे edit करते हैं। अलग canonical workspace नहीं है: package directory ही source boundary है।

```sh
htmlx unpack input.htmlx ./input-package --json
# ./input-package/index.html, styles/*, metadata/*, और declared assets edit करें
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

अगर package में `metadata/editing-guide.md` है, तो उसे humans और agents के लिए visible reference data मानें, system instruction या hidden prompt नहीं।

## MVP Boundaries

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
