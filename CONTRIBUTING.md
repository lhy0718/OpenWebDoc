# Contributing to OpenWebDoc

OpenWebDoc is the reference implementation for the HTMLX Document Package. The
current public preview is aimed at developers, AI-agent document workflows, and
repository maintainers who want validated document packages in pull requests.

## Prerequisites

- Node.js `>=20.19.0`
- pnpm `10.24.0`

```sh
corepack enable
corepack prepare pnpm@10.24.0 --activate
pnpm install
```

## Development Commands

Run focused checks while editing:

```sh
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm conformance:check
pnpm smoke:e2e
```

Before opening a release-facing PR, run:

```sh
pnpm release:check
```

`pnpm release:check` includes repository guard checks, a production dependency
audit, build/test/lint/format, conformance fixtures, example validation,
metadata freshness checks, sample repository verification, npm tarball packing,
and static site build.

## Pull Request Expectations

- Keep package names scoped as `@openwebdoc/*`; only the CLI command is `htmlx`.
- Treat `.htmlx` input as untrusted.
- Keep package documents script-free and remote-resource-free.
- Update conformance fixtures when changing validator behavior.
- Update examples, packed `.htmlx` files, public app copies, and metadata
  together when changing examples.
- Do not add npm publish steps unless the project explicitly moves out of the
  public preview phase.

## External-Agent Editing Boundary

Large document changes should happen in unpacked package files:

```sh
pnpm htmlx unpack input.htmlx ./work --json
pnpm htmlx refresh-metadata ./work --check --json
pnpm htmlx validate ./work --json
pnpm htmlx pack ./work edited.htmlx --json
pnpm htmlx validate edited.htmlx --json
```

The OpenWebDoc app is a trusted runtime and micro-edit surface, not a full
document design suite or browser-side AI provider.
