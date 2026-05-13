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
- `apps/editor`: agent-editable editor 和 exporter
- `examples`: example package directories 和生成的 `.htmlx` files
- `docs`: format, security, metadata, CLI guides

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm smoke:e2e
pnpm exec htmlx validate examples/basic.htmlx
```

## HTMLX CLI 使用方法

CLI command 是 `htmlx`。提供它的 npm package 是 `@openwebdoc/cli`；OpenWebDoc 不发布也不使用 unscoped npm package `htmlx`。

Workspace 开发期间，通过 pnpm 运行 CLI。

```sh
pnpm exec htmlx <command>
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
- `content/document.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

在打开、unpack 或共享之前验证 package。

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm exec htmlx validate examples/basic.htmlx --json
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

### Agent Workspace

为 Codex、Claude Code 或其他外部 coding agent 创建 file-based editing workspace。

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

生成的 workspace:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: coding agents 的 editing rules
- `agent-edit-request.json`: document context, editable files, allowed operations, validation commands
- `agent-edit-proposal.json`: 记录 planned/completed changes 的 draft

推荐的外部 agent 流程:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# 编辑 package/ 下的文件
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

外部 agent 应编辑 package-local HTML、CSS、JSON metadata 和 declared assets。不要添加 scripts、inline event handlers、remote resources、`file:` URLs、`javascript:` URLs，或在 `metadata/llm.json` 中加入 hidden instructions。

## MVP 边界

MVP 会阻止 arbitrary JavaScript execution、remote resources、path traversal、missing package-local resource references 和 prompt-injection-style LLM metadata misuse。Viewer 渲染 sanitized HTML，并把 manifest-declared local resources rewrite 为 browser object URLs。用户打开文件时 lazy-load `@openwebdoc/core`，让 initial viewer bundle 以 shell UI 为主。Editor 和 CLI 优先支持 agent-editable packets，使外部 coding agents 能修改 unpacked HTML/CSS/JSON files，并返回 validated `.htmlx` packages。不包含 DOCX/HWPX/PDF import/export、plugin execution、cloud sync、real-time collaboration 或 browser-side model API keys。

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Release checklist](../release-checklist.md)
