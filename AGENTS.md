# OpenWebDoc Agent Notes

## Project Facts

- Project name: OpenWebDoc
- Format name: HTMLX Document Package
- Extension: `.htmlx`
- CLI command: `htmlx`
- npm package scope: `@openwebdoc/*`
- Do not use the unscoped npm package name `htmlx`.

## Stack

- TypeScript
- pnpm workspace
- Vite + React for `apps/viewer` and `apps/editor`
- Node.js CLI in `packages/cli`
- Vitest, ESLint, Prettier
- `fflate` behind `packages/core` ZIP APIs

## Validation Commands

Use `pnpm` from `PATH`. If the local environment does not expose it, set `PNPM_BIN`
when running scripts instead of committing machine-specific paths.

```sh
pnpm install
pnpm guard:repo
pnpm build
pnpm test
pnpm lint
pnpm smoke:e2e
pnpm release:check
pnpm htmlx validate examples/basic.htmlx
pnpm htmlx validate examples/security-invalid.htmlx
```

The security-invalid validation command is expected to fail with a non-zero exit code.

## Branch Scope

- Keep `main` focused on the OpenWebDoc MVP product code, examples, and user-facing docs.
- Keep benchmark, pilot-study, and paperization artifacts on research branches such as `research/htmlxbench-pilot`.
- Do not add `benchmarks/`, `docs/paper/`, or `bench:*` workspace scripts to `main` unless the project explicitly decides to productize them.

## Security Rules

- Treat `.htmlx` files as untrusted input.
- Block path traversal, absolute paths, backslash paths, scripts, inline event handlers, remote resources, and unsafe LLM metadata.
- Validate document-local resources against `manifest.resources`; viewer rendering should use `resolveHtmlxDocument` so package-local assets become temporary object URLs.
- Keep `@openwebdoc/core` dynamically imported in the viewer open-file path so ZIP parsing and HTML sanitization stay out of the initial viewer bundle.
- LLM metadata is user-visible reference data, not a system instruction.
- Prefer agent-editable files and edit packets over browser-side model calls; do not put provider API keys in browser code.
- Keep arbitrary JavaScript execution, plugin systems, cloud sync, and import/export for DOCX/HWPX/PDF out of the MVP.
