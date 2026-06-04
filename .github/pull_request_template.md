## Summary

## Validation

- [ ] `pnpm audit:prod`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm format`
- [ ] `pnpm conformance:check`
- [ ] `pnpm smoke:e2e`
- [ ] `pnpm release:check` when release-facing

## Package Boundary Checklist

- [ ] Public package names remain scoped as `@openwebdoc/*`
- [ ] The CLI command remains `htmlx`
- [ ] `.htmlx` input remains treated as untrusted
- [ ] No scripts, remote resources, private paths, tokens, or sensitive data were added
- [ ] Example source directories, packed `.htmlx` files, metadata, and public copies stay in sync when touched
