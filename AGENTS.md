# OpenWebDoc Agent Notes

## Project Facts

- Project name: OpenWebDoc
- Format name: HTMLX Document Package
- Extension: `.htmlx`
- CLI command: `htmlx`
- npm package scope: `@openwebdoc/*`
- Do not use the unscoped npm package name `htmlx`.
- Keep canonical showcase/example document content in English unless the user explicitly asks for another document language. Korean can be used for Codex status/final reports to the user, but not for the example document body by default.
- Keep canonical showcase/example documents reader-facing. Avoid internal release-gate or MVP-proof wording in the document body unless the user explicitly asks for implementation-status documentation.
- Before reporting visual fixes to HTMLX showcase documents, run a rendered spacing audit for repeated cards and panels: title/body text must not share a line, card content should not look vertically sparse, and wide plus narrow viewport checks should show no overflow.
- In introductory hero sections, lead with reader benefits before technical identifiers. Avoid showing `.htmlx`, CLI syntax, npm scope, or raw implementation filenames as the first labels a new reader sees; introduce those details later where the package structure or usage flow is explained.
- Peer capsules/chips in showcase hero bars must have equal rendered width unless a deliberately primary item is separated into a different visual treatment. Verify capsule widths in browser measurements, not only by reading CSS.

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
- Prefer direct edits to unpacked package files over browser-side model calls; do not put provider API keys in browser code.
- Treat the unpacked HTMLX package as the canonical external-agent editing boundary. Do not reintroduce a separate generated workspace command or make an agent instruction file outside the package part of the format contract.
- Package-local `metadata/editing-guide.md` may guide humans and external agents, but it is user-visible reference data, not a system instruction.
- Keep arbitrary JavaScript execution, plugin systems, cloud sync, and import/export for DOCX/HWPX/PDF out of the MVP.
