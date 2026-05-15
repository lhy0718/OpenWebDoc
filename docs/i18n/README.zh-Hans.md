# OpenWebDoc

OpenWebDoc 是用于 HTMLX Document Package 格式的 TypeScript monorepo。HTMLX package 是基于 ZIP 的 `.htmlx` 文件，包含浏览器可读的 HTML、本地 asset、显式 manifest、安全验证和 LLM-native metadata。

## 命名

| 概念        | 名称                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

不使用 npm package name `htmlx`。只有 CLI binary 命名为 `htmlx`。

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: `.htmlx` read/write/validate/pack/unpack API 和 package-local asset resolution
- `packages/cli`: 提供 `htmlx` command 的 Node.js CLI
- `packages/ui`: OpenWebDoc apps 的共享 React UI
- `apps/viewer`: 用于本地 `.htmlx` packages 的 Vite React viewer
- `apps/editor`: 面向可自编辑 HTMLX document 的 Vite React trusted runtime
- `examples`: example package directories 和生成的 `.htmlx` files
- `docs`: format, security, metadata, CLI guides

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

## HTMLX CLI 使用方法

CLI command 是 `htmlx`。提供它的 npm package 是 `@openwebdoc/cli`；OpenWebDoc 不发布也不使用 unscoped npm package `htmlx`。

Workspace 开发期间，通过 pnpm 运行 CLI。

```sh
pnpm htmlx <command>
```

安装 `@openwebdoc/cli` 后，可以直接使用 binary。

```sh
htmlx <command>
```

### Create

创建最小有效的 `.htmlx` package。

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
```

输出:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `index.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

在打开、unpack 或共享之前验证 package。

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

验证成功返回 exit code `0`。无效 package 返回 non-zero exit code，并包含 `html.script`、`html.remote_resource`、`html.local_resource_missing`、`llm.system_instruction_guard` 等 issue code。

### Inspect

不把 package unpack 到 filesystem，直接查看 manifest 和 entry list。

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

外部 agent 在决定是否 unpack 文档之前需要快速 package summary 时，可以使用 `inspect`。

### Pack

将包含 `manifest.json` 的 directory 打包为 `.htmlx` file。

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Directory 在写成 package 之前必须通过验证。HTML 引用的 local resource 必须存在于 package 内，并在 `manifest.resources` 中声明。

### Unpack

将有效的 `.htmlx` file 解包到 directory。

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` 会拒绝 invalid package，并且不会覆盖已有 output file。

### 外部智能体编辑

外部 coding agent 直接编辑已解包的 HTMLX package 本身，而不是单独的 workspace。package directory 就是 source boundary。

```sh
htmlx unpack input.htmlx ./input-package --json
# 编辑 ./input-package/index.html, styles/*, metadata/*, declared assets
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

如果 package 包含 `metadata/editing-guide.md`，它是给人和 agent 阅读的 reference data，不是 system instruction 或 hidden prompt。

## MVP 边界

MVP 会阻止 arbitrary JavaScript execution、remote resources、path traversal、missing package-local resource references 和 prompt-injection-style LLM metadata misuse。Viewer 渲染 sanitized HTML，并把 manifest-declared local resources rewrite 为 browser object URLs。用户打开文件时 lazy-load `@openwebdoc/core`，让 initial viewer bundle 以 shell UI 为主。Editor-generated package 会在 `metadata/editing.json` 中声明可自编辑的 document surface；text、image、simple shape 位于固定 logical stage 上，并随 browser width 统一 scale。Browser editor 是启用这些 editable block 并导出 validated `.htmlx` 的 trusted runtime。External coding agents 应通过 unpacked package flow 修改 unpacked HTML/CSS/JSON files 并返回 validated packages。不包含 DOCX/HWPX/PDF import/export、plugin execution、cloud sync、real-time collaboration、browser-side model API keys 或 in-editor model calls。

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
