# OpenWebDoc

OpenWebDoc adalah TypeScript monorepo untuk format HTMLX Document Package. HTMLX packages adalah file `.htmlx` berbasis ZIP yang berisi HTML yang bisa dibaca browser, local assets, manifest eksplisit, validasi keamanan, dan LLM-native metadata.

## Penamaan

| Konsep      | Nama                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

npm package name `htmlx` tidak digunakan. Hanya CLI binary yang bernama `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: API read/write/validate/pack/unpack untuk `.htmlx` dan package-local asset resolution
- `packages/cli`: Node.js CLI yang menyediakan command `htmlx`
- `packages/ui`: React UI bersama untuk OpenWebDoc apps
- `apps/viewer`: Vite React viewer untuk local `.htmlx` packages
- `apps/editor`: agent-editable editor dan exporter
- `examples`: example package directories dan file `.htmlx` yang dibuat
- `docs`: panduan format, security, metadata, dan CLI

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm smoke:e2e
pnpm exec htmlx validate examples/basic.htmlx
```

## Penggunaan HTMLX CLI

CLI command adalah `htmlx`. npm package yang menyediakannya adalah `@openwebdoc/cli`; OpenWebDoc tidak menerbitkan atau menggunakan unscoped npm package bernama `htmlx`.

Selama pengembangan workspace, jalankan CLI melalui pnpm.

```sh
pnpm exec htmlx <command>
```

Setelah memasang `@openwebdoc/cli` sebagai package, gunakan binary secara langsung.

```sh
htmlx <command>
```

### Create

Membuat package `.htmlx` minimal yang valid.

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

Validasi package sebelum dibuka, di-unpack, atau dibagikan.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm exec htmlx validate examples/basic.htmlx --json
```

Validasi yang berhasil mengembalikan exit code `0`. Package tidak valid mengembalikan non-zero exit code dan menyertakan issue codes seperti `html.script`, `html.remote_resource`, `html.local_resource_missing`, atau `llm.system_instruction_guard`.

### Inspect

Inspect package manifest dan entry list tanpa unpack ke filesystem.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Gunakan `inspect` ketika external agent membutuhkan package summary cepat sebelum memutuskan apakah document perlu di-unpack.

### Pack

Pack directory yang berisi `manifest.json` menjadi file `.htmlx`.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Directory harus valid sebelum ditulis sebagai package. Local resources yang dirujuk dari HTML harus ada di dalam package dan dideklarasikan di `manifest.resources`.

### Unpack

Unpack file `.htmlx` yang valid ke directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` menolak invalid package dan menolak menimpa output files yang sudah ada.

### Agent Workspace

Membuat file-based editing workspace untuk Codex, Claude Code, atau external coding agent lain.

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

Workspace yang dibuat berisi:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: editing rules untuk coding agents
- `agent-edit-request.json`: document context, editable files, allowed operations, validation commands
- `agent-edit-proposal.json`: draft record untuk planned/completed changes

Alur external-agent yang disarankan:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# Edit files under package/
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

External agents harus mengedit package-local HTML, CSS, JSON metadata, dan declared assets. Jangan menambahkan scripts, inline event handlers, remote resources, `file:` URLs, `javascript:` URLs, atau hidden instructions di `metadata/llm.json`.

## Batas MVP

MVP memblokir arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references, dan prompt-injection-style LLM metadata misuse. Viewer merender sanitized HTML dan me-rewrite manifest-declared local resources menjadi browser object URLs. Viewer melakukan lazy-load `@openwebdoc/core` saat pengguna membuka file, sehingga initial viewer bundle tetap berfokus pada shell UI. Editor dan CLI memprioritaskan agent-editable packets agar external coding agents dapat memodifikasi unpacked HTML/CSS/JSON files dan mengembalikan validated `.htmlx` packages. Tidak termasuk DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, atau browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Release checklist](../release-checklist.md)
