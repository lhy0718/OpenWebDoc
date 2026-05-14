# OpenWebDoc v0.1.0-alpha Release Checklist

- [ ] `pnpm install` succeeds.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm test` succeeds.
- [ ] `pnpm lint` succeeds.
- [ ] `pnpm smoke:e2e` succeeds.
- [ ] `pnpm htmlx validate examples/basic.htmlx` succeeds.
- [ ] `pnpm htmlx validate examples/security-invalid.htmlx` fails for expected security reasons.
- [ ] Viewer opens `examples/basic.htmlx`.
- [ ] Viewer renders manifest-declared package-local assets.
- [ ] Viewer production build has no oversized-chunk warning.
- [ ] `htmlx agent-workspace` creates an agent-editable unpacked workspace.
- [ ] Editor prepares an agent edit packet from an instruction.
- [ ] Editor exports a `.htmlx` package that passes CLI validation after applying a local draft proposal.
- [ ] Viewer reopens the editor-exported package.
- [ ] Public package names use `@openwebdoc/*`.
- [ ] The CLI binary is named `htmlx`.
- [ ] README, docs, and Obsidian notes match implementation state.
