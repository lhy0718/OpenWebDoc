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
- `packages/ui`: OpenWebDoc apps के लिए shared React UI
- `apps/viewer`: local `.htmlx` packages के लिए Vite React viewer
- `apps/editor`: agent-editable editor और exporter
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
pnpm site:build
pnpm pack:packages
pnpm release:check
pnpm htmlx validate examples/basic.htmlx
```

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
- `content/document.html`: default HTML entry
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

### Agent Workspace

Codex, Claude Code, या किसी अन्य external coding agent के लिए file-based editing workspace बनाता है।

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

Generated workspace:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: coding agents के लिए editing rules
- `agent-edit-request.json`: document context, editable files, allowed operations, validation commands
- `agent-edit-proposal.json`: planned/completed changes के लिए draft record

Suggested external-agent flow:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# package/ के अंदर files edit करें
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

External agents को package-local HTML, CSS, JSON metadata, और declared assets edit करने चाहिए। scripts, inline event handlers, remote resources, `file:` URLs, `javascript:` URLs, या `metadata/llm.json` में hidden instructions न जोड़ें।

## MVP Boundaries

MVP arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references, और prompt-injection-style LLM metadata misuse को block करता है। Viewer sanitized HTML render करता है और manifest-declared local resources को browser object URLs में rewrite करता है। User जब file खोलता है तब यह `@openwebdoc/core` को lazy-load करता है, जिससे initial viewer bundle shell UI पर focused रहता है। Editor और CLI agent-editable packets को प्राथमिकता देते हैं ताकि external coding agents unpacked HTML/CSS/JSON files modify कर सकें और validated `.htmlx` packages return कर सकें। इसमें DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, या browser-side model API keys शामिल नहीं हैं।

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
