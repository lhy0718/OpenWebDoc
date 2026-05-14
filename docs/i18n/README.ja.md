# OpenWebDoc

OpenWebDoc は HTMLX Document Package フォーマットのための TypeScript monorepo です。HTMLX パッケージは、ブラウザで読める HTML、ローカル asset、明示的な manifest、セキュリティ検証、LLM-native metadata を ZIP ベースの `.htmlx` ファイルにまとめます。

## 命名

| 概念        | 名前                   |
| ----------- | ---------------------- |
| Project     | OpenWebDoc             |
| Format      | HTMLX Document Package |
| Extension   | `.htmlx`               |
| CLI command | `htmlx`                |
| npm scope   | `@openwebdoc/*`        |

npm package name `htmlx` は使用しません。CLI binary の名前だけが `htmlx` です。

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: `.htmlx` read/write/validate/pack/unpack API と package-local asset resolution
- `packages/cli`: `htmlx` command を公開する Node.js CLI
- `packages/ui`: OpenWebDoc apps 用の共有 React UI
- `apps/viewer`: ローカル `.htmlx` packages 用の Vite React viewer
- `apps/editor`: agent-editable editor と exporter
- `examples`: example package directories と生成済み `.htmlx` files
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

## HTMLX CLI の使い方

CLI command は `htmlx` です。これを提供する npm package は `@openwebdoc/cli` で、OpenWebDoc は unscoped npm package `htmlx` を公開または使用しません。

Workspace 開発中は pnpm 経由で実行します。

```sh
pnpm htmlx <command>
```

`@openwebdoc/cli` を package としてインストールした後は binary を直接使えます。

```sh
htmlx <command>
```

### Create

最小構成の有効な `.htmlx` package を作成します。

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
```

出力:

- `document.htmlx`: ZIP-based HTMLX Document Package
- `content/document.html`: default HTML entry
- `styles/document.css`: default local stylesheet
- `metadata/llm.json`: user-visible LLM metadata
- `metadata/provenance.json`: creation metadata

### Validate

Package を開く、unpack する、共有する前に検証します。

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

検証に成功すると exit code `0` を返します。無効な package は non-zero exit code を返し、`html.script`, `html.remote_resource`, `html.local_resource_missing`, `llm.system_instruction_guard` などの issue code を含みます。

### Inspect

Package を filesystem に unpack せず、manifest と entry list を確認します。

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

外部 agent が document を unpack するか判断する前に package summary が必要な場合は `inspect` を使います。

### Pack

`manifest.json` を含む directory を `.htmlx` file に pack します。

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

Directory は package として書き込まれる前に検証されます。HTML から参照される local resource は package 内に存在し、`manifest.resources` に宣言されている必要があります。

### Unpack

有効な `.htmlx` file を directory に展開します。

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack` は invalid package を拒否し、既存の output file を上書きしません。

### Agent Workspace

Codex、Claude Code、または他の外部 coding agent のための file-based editing workspace を作成します。

```sh
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx agent-workspace examples/basic.htmlx ./basic-agent --json
```

生成される workspace:

- `package/`: unpacked HTMLX package files
- `AGENT_EDITING.md`: coding agents 向け editing rules
- `agent-edit-request.json`: document context, editable files, allowed operations, validation commands
- `agent-edit-proposal.json`: planned/completed changes を記録する draft

推奨される外部 agent flow:

```sh
htmlx agent-workspace input.htmlx ./input-agent
cd ./input-agent
# package/ 配下の files を編集
htmlx pack package edited.htmlx --json
htmlx validate edited.htmlx --json
```

外部 agent は package-local HTML, CSS, JSON metadata, declared assets を編集します。scripts、inline event handlers、remote resources、`file:` URLs、`javascript:` URLs、または `metadata/llm.json` の hidden instructions を追加してはいけません。

## MVP 境界

MVP は arbitrary JavaScript execution、remote resources、path traversal、missing package-local resource references、prompt-injection-style LLM metadata misuse をブロックします。Viewer は sanitized HTML をレンダリングし、manifest-declared local resources を browser object URLs に rewrite します。ユーザーが file を開くときに `@openwebdoc/core` を lazy-load し、initial viewer bundle を shell UI 中心に保ちます。Editor と CLI は、外部 coding agents が unpacked HTML/CSS/JSON files を変更し validated `.htmlx` packages を返せるように agent-editable packets を優先します。DOCX/HWPX/PDF import/export、plugin execution、cloud sync、real-time collaboration、browser-side model API keys は含みません。

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [Agent-editable HTMLX](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
