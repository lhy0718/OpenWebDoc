# OpenWebDoc

OpenWebDoc là TypeScript monorepo cho định dạng HTMLX Document Package. HTMLX packages là các file `.htmlx` dựa trên ZIP, gồm HTML có thể đọc bằng trình duyệt, local assets, manifest rõ ràng, kiểm tra bảo mật và LLM-native metadata.

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
- `packages/ui`: React UI dùng chung cho OpenWebDoc apps
- `apps/viewer`: Vite React viewer cho local `.htmlx` packages
- `apps/editor`: Vite React trusted runtime cho HTMLX document tự chỉnh sửa
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
```

Output:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

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
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Neu package co `metadata/editing-guide.md`, hay xem no la reference data hien thi cho con nguoi va agent, khong phai system instruction hay hidden prompt.

## Ranh giới MVP

MVP chặn arbitrary JavaScript execution, remote resources, path traversal, missing package-local resource references và prompt-injection-style LLM metadata misuse. Viewer render sanitized HTML và rewrite manifest-declared local resources thành browser object URLs. Khi người dùng mở file, viewer lazy-load `@openwebdoc/core` để giữ initial viewer bundle tập trung vào shell UI. Package do editor tạo ra khai báo self-editable document surface trong `metadata/editing.json`; text, image và simple shape nằm trên logical stage cố định và scale đồng đều theo browser width. Browser editor là trusted runtime kích hoạt các editable block này và export `.htmlx` đã validate. External coding agents nên dùng unpacked package flow để sửa unpacked HTML/CSS/JSON files và trả về validated packages. Không bao gồm DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration hoặc browser-side model API keys.

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
