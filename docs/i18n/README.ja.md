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
- `apps/editor`: 自己編集可能な HTMLX document のための Vite React trusted runtime
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
- `index.html`: default HTML entry
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

### 外部エージェント編集

外部 coding agent は別の workspace ではなく、unpack された HTMLX package 自体を編集します。package directory が source boundary です。

```sh
htmlx unpack input.htmlx ./input-package --json
# ./input-package/index.html, styles/*, metadata/*, declared assets を編集
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Package に `metadata/editing-guide.md` がある場合、人間と agent のための reference data として扱います。system instruction や hidden prompt ではありません。

## MVP 境界

MVP は arbitrary JavaScript execution、remote resources、path traversal、missing package-local resource references、prompt-injection-style LLM metadata misuse をブロックします。Viewer は sanitized HTML をレンダリングし、manifest-declared local resources を browser object URLs に rewrite します。ユーザーが file を開くときに `@openwebdoc/core` を lazy-load し、initial viewer bundle を shell UI 中心に保ちます。Editor-generated package は `metadata/editing.json` で自己編集可能な document surface を宣言し、text, image, simple shape は固定 logical stage 上で browser width に合わせて均一に scale されます。Browser editor は editable block を有効化し、validated `.htmlx` を export する trusted runtime です。External coding agents は unpacked package flow で unpacked HTML/CSS/JSON files を変更し validated packages を返します。DOCX/HWPX/PDF import/export、plugin execution、cloud sync、real-time collaboration、browser-side model API keys は含みません。

## Docs

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
