# OpenWebDoc

OpenWebDoc은 HTMLX Document Package 포맷을 위한 TypeScript monorepo입니다. HTMLX 패키지는 브라우저에서 읽을 수 있는 HTML, 로컬 asset, 명시적 manifest, 보안 검증, LLM-native metadata를 ZIP 기반 `.htmlx` 파일로 묶습니다.

## 빠른 시작

```sh
pnpm install
pnpm dev:app
```

Vite가 출력하는 로컬 URL을 열고 `.htmlx` 파일을 선택합니다. 문서는 먼저 읽기 화면으로 열리며, `metadata/editing.json`이 있는 패키지는 작은 floating control로 같은 표면에서 편집 모드로 전환할 수 있습니다.

## 명명 규칙

| 개념       | 이름                   |
| ---------- | ---------------------- |
| 프로젝트   | OpenWebDoc             |
| 포맷       | HTMLX Document Package |
| 확장자     | `.htmlx`               |
| CLI 명령어 | `htmlx`                |
| npm scope  | `@openwebdoc/*`        |

npm 패키지 이름 `htmlx`는 사용하지 않습니다. CLI binary 이름만 `htmlx`입니다.

## Workspace

- `packages/spec`: format constants, TypeScript types, JSON Schemas, fixtures
- `packages/core`: `.htmlx` read/write/validate/pack/unpack API와 package-local asset resolution
- `packages/cli`: `htmlx` 명령어를 제공하는 Node.js CLI
- `packages/ui`: OpenWebDoc 표면을 위한 공통 React UI
- `apps/openwebdoc`: `.htmlx` 문서를 읽고 편집하는 Vite React 앱과 신뢰 런타임
- `examples`: 예제 package directory와 생성된 `.htmlx` 파일
- `docs`: format, security, metadata, CLI guide

## 명령

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

## OpenWebDoc 앱 사용법

OpenWebDoc 앱은 하나의 문서 중심 흐름을 사용합니다.

1. `pnpm dev:app`으로 앱을 엽니다.
2. 로컬 `.htmlx` 패키지를 선택합니다.
3. sidebar나 inspection chrome 없이 문서를 읽습니다.
4. 패키지가 `metadata/editing.json`을 선언하면 floating edit control로 같은 표면에서 직접 편집합니다.
5. 검증된 `.htmlx`로 export하고 `pnpm htmlx validate path/to/file.htmlx`로 확인합니다.

`examples/basic.htmlx`는 읽기 문서로 열립니다. `examples/openwebdoc-introduction.htmlx`는 읽기 모드로 열린 뒤 문단 보정, inline bold/italic/underline, font-size와 text color 조정, grouped figure, semantic table, 문서 소유 microcopy를 직접 보정할 수 있습니다. 새 figure, 새 table, 큰 layout redesign은 unpacked package files에서 외부 agent가 수행하는 흐름이 기본입니다.

## HTMLX CLI 사용법

CLI 명령어는 `htmlx`입니다. 이를 제공하는 npm 패키지는 `@openwebdoc/cli`이며, OpenWebDoc은 unscoped npm 패키지 `htmlx`를 배포하거나 사용하지 않습니다.

Workspace 개발 중에는 pnpm으로 실행합니다.

```sh
pnpm htmlx <command>
```

`@openwebdoc/cli`를 패키지로 설치한 뒤에는 binary를 직접 사용할 수 있습니다.

```sh
htmlx <command>
```

### Create

최소 유효 `.htmlx` 패키지를 만듭니다.

```sh
htmlx create document.htmlx --title "My Document" --language en
htmlx create document.htmlx --title "My Document" --language en --json
```

출력:

- `document.htmlx`: ZIP 기반 HTMLX Document Package
- `index.html`: 기본 HTML entry
- `styles/document.css`: 기본 로컬 stylesheet
- `metadata/llm.json`: 사용자에게 보이는 LLM metadata
- `metadata/provenance.json`: 생성 metadata

### Validate

패키지를 열거나 unpack하거나 공유하기 전에 검증합니다.

```sh
htmlx validate document.htmlx
htmlx validate document.htmlx --json
pnpm htmlx validate examples/basic.htmlx --json
```

검증에 성공하면 exit code `0`을 반환합니다. 유효하지 않은 패키지는 non-zero exit code를 반환하고 `html.script`, `html.remote_resource`, `html.local_resource_missing`, `llm.system_instruction_guard` 같은 issue code를 포함합니다.

### Inspect

파일을 filesystem에 unpack하지 않고 package manifest와 entry list를 확인합니다.

```sh
htmlx inspect document.htmlx
htmlx inspect document.htmlx --json
```

외부 agent가 문서를 unpack할지 결정하기 전에 빠른 package summary가 필요할 때 `inspect`를 사용합니다.

### Pack

`manifest.json`이 있는 directory를 `.htmlx` 파일로 pack합니다.

```sh
htmlx pack examples/basic examples/basic.htmlx
htmlx pack examples/basic examples/basic.htmlx --json
```

directory는 package로 쓰이기 전에 검증되어야 합니다. HTML에서 참조하는 local resource는 package 내부에 존재하고 `manifest.resources`에 선언되어야 합니다.

### Unpack

유효한 `.htmlx` 파일을 directory로 풉니다.

```sh
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx --json
```

`unpack`은 invalid package를 거부하고 기존 output file을 덮어쓰지 않습니다.

### 외부 에이전트 편집

외부 coding agent는 별도 workspace가 아니라 unpack된 HTMLX package 자체를 편집합니다. package directory가 source boundary입니다.

```sh
htmlx unpack input.htmlx ./input-package --json
# ./input-package/index.html, styles/*, metadata/*, declared assets 수정
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Package에 `metadata/editing-guide.md`가 있으면 사람과 agent가 함께 읽는 reference data로 취급합니다. system instruction이나 hidden prompt가 아닙니다.

## MVP 경계

MVP는 임의 JavaScript 실행, remote resources, path traversal, 누락된 package-local resource reference, prompt-injection-style LLM metadata misuse를 차단합니다. OpenWebDoc 앱은 package HTML을 안전하게 렌더링하고, 필요할 때 manifest-declared local resource를 browser object URL로 rewrite하며, declarative package metadata가 있을 때만 편집을 활성화합니다. Self-editable package는 `metadata/editing.json`에 document surface를 선언합니다. 앱 edit mode는 micro-editing surface이며, 대량 rewrite, 새 figure, 새 table, layout redesign은 unpacked package files에서 수행합니다. 패키지 자체에는 executable runtime code를 넣지 않습니다. External coding agents는 unpacked package의 HTML/CSS/JSON/assets를 직접 수정하고, directory validation, repack, file validation을 거쳐야 합니다. DOCX/HWPX/PDF import/export, plugin execution, cloud sync, real-time collaboration, browser-side model API key, in-app model call은 포함하지 않습니다.

## 문서

- [Format overview](../format-overview.md)
- [Manifest spec](../manifest-spec.md)
- [Security model](../security-model.md)
- [LLM metadata guide](../llm-metadata-guide.md)
- [External agent editing](../agent-editing.md)
- [CLI usage](../cli-usage.md)
- [Deployment](../deployment.md)
- [Release checklist](../release-checklist.md)
