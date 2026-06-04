# OpenWebDoc

HTMLX la agent-safe, browser-readable document package cho verified local editing. No dong goi HTML, CSS, local assets, explicit manifest, security validation, provenance-ready metadata va user-visible LLM reference data trong file ZIP `.htmlx`.

OpenWebDoc la reference app va toolchain de mo, validate, pack, unpack, dung template va ket noi HTMLX packages voi external AI coding agent workflows.

HTMLX khong phai HTMX. HTMLX la ZIP-based document package; HTMX la JavaScript library cho hypermedia applications. OpenWebDoc cung tach biet voi Open Web Docs community.

## Public Preview

Trong preview hiện tại, OpenWebDoc packages chưa được publish lên npm. Hãy dùng repository checkout này với `pnpm htmlx ...`, GitHub Action được pin theo tag, hoặc GitHub release assets. Các npm packages sau này sẽ chỉ dùng scope `@openwebdoc/*`.

## Quick Start

```sh
pnpm install
pnpm dev:app
```

Open the local URL printed by Vite, choose a `.htmlx` file, and read it as the document itself. Packages with `metadata/editing.json` can switch into direct editing from the small floating control.

## Đặt tên

| Khái niệm   | Tên                    |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

Không dùng npm package name `htmlx`. Chỉ CLI binary được đặt tên `htmlx`.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: API read/write/validate/pack/unpack cho `.htmlx` và package-local asset resolution
- `packages/cli`: Node.js CLI cung cấp command `htmlx`
- `packages/ui`: shared React UI for OpenWebDoc surfaces
- `apps/openwebdoc`: Vite React app and trusted runtime for reading and editing `.htmlx` documents
- `examples`: example package directories và các file `.htmlx` đã tạo
- `docs`: hướng dẫn format, security, metadata và CLI

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

## Cách dùng HTMLX CLI

CLI command là `htmlx`. npm package cung cấp nó là `@openwebdoc/cli`; OpenWebDoc không phát hành hoặc dùng unscoped npm package tên `htmlx`.

Khi phát triển workspace, chạy CLI qua pnpm.

```sh
pnpm htmlx <command>
```

Sau khi cài `@openwebdoc/cli` như một package, dùng binary trực tiếp.

```sh
htmlx <command>
```

### Create

Tạo package `.htmlx` tối thiểu và hợp lệ.

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
htmlx create fixed.htmlx --profile fixed-stage-document --title "Visual Brief"
htmlx create deck.htmlx --profile slide-deck --title "OpenWebDoc Pitch" --slides 6
htmlx from-markdown notes.md notes.htmlx --title "Project Notes"
htmlx from-html page.html page.htmlx --title "Project Page"
htmlx to-static-html notes.htmlx ./notes-static
```

Output:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata
- `metadata/presentation.json`: present only for `--profile slide-deck`

### Validate

Validate package trước khi mở, unpack hoặc chia sẻ.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

Validate thành công trả về exit code `0`. Package không hợp lệ trả về non-zero exit code và issue codes như `html.script`, `html.remote_resource`, `html.local_resource_missing`, hoặc `llm.system_instruction_guard`.

### Inspect

Inspect package manifest và entry list mà không unpack vào filesystem.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

Dùng `inspect` khi external agent cần package summary nhanh trước khi quyết định unpack document.

### Pack

Pack một directory có `manifest.json` thành file `.htmlx`.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Directory phải validate trước khi được ghi thành package. Local resources được HTML tham chiếu phải tồn tại trong package và được khai báo trong `manifest.resources`.

### Unpack

Unpack file `.htmlx` hợp lệ vào directory.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` từ chối invalid package và không ghi đè output files đã tồn tại.

### Chinh sua bang agent ben ngoai

External coding agents chinh sua truc tiep HTMLX package da unpack. Khong co canonical workspace rieng: package directory la source boundary.

```sh
htmlx unpack input.htmlx ./input-package --json
# Chinh sua ./input-package/index.html, styles/*, metadata/* va declared assets
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Neu package co `metadata/editing-guide.md`, hay xem no la reference data hien thi cho con nguoi va agent, khong phai system instruction hay hidden prompt.

## Ranh giới MVP

MVP chặn arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references và prompt-injection-style LLM metadata misuse. OpenWebDoc app render package HTML an toàn, rewrite manifest-declared local resources thành browser object URLs khi cần, và chỉ kích hoạt editing từ declarative package metadata. Self-editable packages khai báo document surface trong `metadata/editing.json`. App edit mode chi dành cho micro-edits; major rewrites, new figures, new tables, and layout redesigns thuộc về unpacked package files. Package không chứa executable runtime code. External coding agents chỉnh sửa trực tiếp HTML/CSS/JSON/assets của unpacked package, validate directory, repack, rồi validate `.htmlx` đã sửa. DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, browser-side model API keys, và in-app model calls nằm ngoài MVP.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
